import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import { DirectionStepsPanel } from "../components/DirectionStepsPanel";
import NavigationBar from "../components/NavigationBar";
import NextClassDirectionsPanel from "../components/NextClassDirectionsPanel";
import { OutdoorPOIFilter } from "../components/OutdoorPOIFilter";
import { POIListPanel } from "../components/POIListPanel";
import { POIRangeSelector } from "../components/POIRangeSelector";
import { ShuttleSchedulePanel } from "../components/ShuttleSchedulePanel";
import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { CAMPUSES } from "../constants/campuses";
import type { OutdoorPOICategoryId } from "../constants/outdoorPOI";
import { DEFAULT_POI_RANGE, type POIRangeOption } from "../constants/poiRange";
import { WALKING_STRATEGY } from "../constants/strategies";
import { colors, spacing } from "../constants/theme";
import { Buildings, RouteStep, ScheduleItem } from "../constants/type";
import { useNearbyPOIs } from "../hooks/useNearbyPOIs";
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/CampusMapScreen.styles";
import {
  buildContinueIndoorsStep,
  getContinueIndoorsBuildingCode,
} from "../utils/continueIndoors";
import {
  buildIndoorMapRouteParams,
  getIndoorAccessState,
} from "../utils/indoorAccess";
import { IndoorRoomRecord } from "../utils/indoorBuildingPlan";
import {
  getIndoorNavigationRouteFromNode,
  indoorRouteToSteps,
} from "../utils/indoorNavigation";
import { getBuildingPlanAsset } from "../utils/mapAssets";
import {
  getNextClassFromItems,
  loadCachedSchedule,
} from "../utils/parseCourseEvents";
import { parseTransitionPayload, serializeTransitionPayload } from "../utils/routeTransition";

import { getDistanceToPolygon } from "../utils/pointInPolygon";

const buildCrossBuildingIndoorParams = ({
  params,
  startRoom,
  startBuilding,
  destBuilding,
  strategy,
  accessible,
}: {
  params: Record<string, string | undefined>;
  startRoom: IndoorRoomRecord;
  startBuilding: Buildings;
  destBuilding: Buildings;
  strategy?: RouteStrategy;
  accessible: boolean;
}) => ({
  ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? ""])),
  navOrigin: startRoom.label,
  navDest: startBuilding.name.trim().toUpperCase(),
  outdoorDestBuilding: destBuilding.name.trim().toUpperCase(),
  outdoorStrategy: strategy ? JSON.stringify(strategy) : undefined,
  outdoorAccessibleOnly: accessible ? "true" : "false",
  accessibleOnly: String(accessible),
});

type FocusTarget = CampusKey | "user";

function normalizeRoomQuery(buildingCode: string, room: string): string {
  const trimmed = room.trim();
  if (!trimmed) return "";
  const prefix = `${buildingCode.toUpperCase()}-`;
  if (trimmed.toUpperCase().startsWith(prefix)) return trimmed;
  return `${prefix}${trimmed}`;
}

type RouteConfirmIntent =
  | {
    kind: "cross_building_indoor_to_indoor";
    originBuildingCode: string;
    destinationBuildingCode: string;
    originIndoorRoomQuery: string;
    destinationIndoorRoomQuery: string;
    strategy: RouteStrategy;
    accessibleOnly: boolean;
    campus: CampusKey;
  }
  | {
    kind: "cross_building_indoor_to_outdoor";
    startBuilding: Buildings;
    destBuilding: Buildings;
    startRoom: IndoorRoomRecord;
    strategy: RouteStrategy;
    accessibleOnly: boolean;
  }
  | {
    kind: "same_building_indoor_room_to_room";
    buildingCode: string;
    navOrigin: string;
    navDest: string;
    accessibleOnly?: boolean;
  }
  | {
    kind: "same_building_indoor_to_room";
    buildingCode: string;
    roomQuery: string;
    accessibleOnly?: boolean;
  }
  | { kind: "outdoor_route" };

function buildRouteConfirmIntent({
  start,
  dest,
  strategy,
  startRoom,
  endRoom,
  accessible,
}: {
  start: Buildings | null;
  dest: Buildings | null;
  strategy: RouteStrategy;
  startRoom?: IndoorRoomRecord | null;
  endRoom?: IndoorRoomRecord | null;
  accessible?: boolean;
}): RouteConfirmIntent {
  const hasStartName = Boolean(start?.name);
  const hasDestName = Boolean(dest?.name);
  const isCrossBuilding = hasStartName && hasDestName && start?.name !== dest?.name;
  const isSameBuilding = hasStartName && hasDestName && start?.name === dest?.name;

  if (isCrossBuilding && startRoom && endRoom && start?.name && dest?.name) {
    return {
      kind: "cross_building_indoor_to_indoor",
      originBuildingCode: start.name.trim().toUpperCase(),
      destinationBuildingCode: dest.name.trim().toUpperCase(),
      originIndoorRoomQuery: startRoom.label,
      destinationIndoorRoomQuery: endRoom.label,
      strategy,
      accessibleOnly: Boolean(accessible),
      campus: (start.campusName ?? "sgw") as CampusKey,
    };
  }

  if (isCrossBuilding && startRoom && !endRoom && start && dest) {
    return {
      kind: "cross_building_indoor_to_outdoor",
      startBuilding: start,
      destBuilding: dest,
      startRoom,
      strategy,
      accessibleOnly: Boolean(accessible),
    };
  }

  if (isSameBuilding && startRoom && endRoom && start?.name) {
    return {
      kind: "same_building_indoor_room_to_room",
      buildingCode: start.name,
      navOrigin: startRoom.label,
      navDest: endRoom.label,
      accessibleOnly: accessible,
    };
  }

  if (isSameBuilding && endRoom && dest?.name) {
    return {
      kind: "same_building_indoor_to_room",
      buildingCode: dest.name,
      roomQuery: endRoom.label,
      accessibleOnly: accessible,
    };
  }

  return { kind: "outdoor_route" };
}

export default function CampusMapScreen() {
  // Accessibility mode state
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const { campus, transition, destinationRoomQuery } = useLocalSearchParams<{
    campus?: CampusKey;
    transition?: string;
    destinationRoomQuery?: string;
  }>();

  const transitionPayload = useMemo(
    () => parseTransitionPayload(typeof transition === "string" ? transition : undefined),
    [transition],
  );

  // If the user planned a cross-building trip with indoor rooms at both ends from the
  // navigation drawer, immediately jump into the origin building's indoor navigation.
  useEffect(() => {
    if (transitionPayload?.mode !== "cross_building_indoor") return;

    const originCode = transitionPayload.originBuildingCode.trim().toUpperCase();
    const destCode = transitionPayload.destinationBuildingCode.trim().toUpperCase();

    router.push({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: originCode,
        floors: "1", // IndoorMapScreen will normalize if the building has different floors.
        navOrigin: transitionPayload.originIndoorRoomQuery,
        // We set navDest to the destination building code to force the origin-building
        // indoor leg to route to a good exit. (IndoorMapScreen will *not* do cross-building
        // room navigation.)
        navDest: destCode,
        outdoorDestBuilding: destCode,
        outdoorStrategy: transitionPayload.strategy ? JSON.stringify(transitionPayload.strategy) : undefined,
        outdoorAccessibleOnly: transitionPayload.accessibleOnly ? "true" : "false",
        // Carry the final indoor query for later (CampusMapScreen will use it to offer
        // a "Continue indoors" option near the destination building).
        destinationRoomQuery: transitionPayload.destinationIndoorRoomQuery,
        accessibleOnly: String(Boolean(transitionPayload.accessibleOnly)),
      },
    });
  }, [transitionPayload]);

  const findNearestBuilding = useCallback((lat: number, lon: number) => {
    let nearest = BUILDINGS[0];
    let minDist = Infinity;
    const userPoint = { latitude: lat, longitude: lon };
    for (const b of BUILDINGS) {
      if (!b.boundingBox || b.boundingBox.length < 3) continue;
      const d = getDistanceToPolygon(userPoint, b.boundingBox);
      if (d < minDist) {
        minDist = d;
        nearest = b;
      }
    }
    return nearest;
  }, []);

  const [currentCampus, setCurrentCampus] = useState<CampusKey>(
    campus === "loyola" ? "loyola" : "sgw",
  );
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(
    campus === "loyola" ? "loyola" : "sgw",
  );
  const [userFocusCounter, setUserFocusCounter] = useState(0);
  const [routeFocusTrigger, setRouteFocusTrigger] = useState(0);
  const [autoStartBuilding, setAutoStartBuilding] = useState<Buildings | null>(
    null,
  );
  const [isNavVisible, setIsNavVisible] = useState(false);
  const [initialStart, setInitialStart] = useState<Buildings | null>(null);
  const [initialDestination, setInitialDestination] =
    useState<Buildings | null>(null);
  const [demoCurrentBuilding, setDemoCurrentBuilding] =
    useState<Buildings | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<{
    start: Buildings | null;
    dest: Buildings | null;
  }>({ start: null, dest: null });
  const [selectedRouteEndRoom, setSelectedRouteEndRoom] = useState<IndoorRoomRecord | null>(null);
  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [showPOIFilter, setShowPOIFilter] = useState(false);
  const [showPOIList, setShowPOIList] = useState(false);
  const [focusPOIId, setFocusPOIId] = useState<string | null>(null);
  const [focusPOITrigger, setFocusPOITrigger] = useState(0);
  const [activePOICategories, setActivePOICategories] = useState<Set<OutdoorPOICategoryId>>(new Set());
  const [poiRange, setPOIRange] = useState<POIRangeOption>(DEFAULT_POI_RANGE);
  const [poiSearchTrigger, setPoiSearchTrigger] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const { pois: nearbyPOIs, loading: poisLoading, error: poisError, search: searchPOIs, clear: clearPOIs } = useNearbyPOIs();

  // Fall back to the current campus center when GPS is unavailable.
  const poiSearchLocation = userLocation ?? CAMPUSES[currentCampus].coordinates;

  // Stable string key for the active categories so we can use it as an effect dep.
  const activePOICategoryKey = useMemo(
    () => Array.from(activePOICategories).sort((a, b) => a.localeCompare(b)).join(","),
    [activePOICategories],
  );

  // Auto-search whenever category, range, or location changes while the POI panel is open.
  useEffect(() => {
    if (!showPOIFilter) return;
    if (activePOICategories.size === 0) {
      clearPOIs();
      return;
    }
    searchPOIs(poiSearchLocation, poiRange.meters, Array.from(activePOICategories));
    setShowPOIList(true);
  // searchPOIs and clearPOIs are refs from useNearbyPOIs. Intentionally excluding them
  // to avoid re-triggering the search when the hook instance changes. Basically, only the user-facing 
  // inputs should drive re-fetches. Do not try to 'fix' this please.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePOICategoryKey, poiRange.meters, poiSearchLocation, showPOIFilter, poiSearchTrigger]);

  const retryPOISearch = useCallback(() => {
    setPoiSearchTrigger((c) => c + 1);
  }, []);

  const handleTogglePOICategory = useCallback((id: OutdoorPOICategoryId) => {
    setActivePOICategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const destinationRoomQueryText = useMemo(() => {
    // Preferred source: an explicit query param (ex: app launched with a room destination).
    if (typeof destinationRoomQuery === "string" && destinationRoomQuery.trim()) {
      return destinationRoomQuery;
    }

    // Next best: when arriving from indoor navigation (indoor -> outdoor -> indoor), the
    // final indoor room query is carried in the transition payload.
    if (transitionPayload?.mode === "indoor_to_outdoor") {
      const payloadRoom = transitionPayload.destinationIndoorRoomQuery;
      if (typeof payloadRoom === "string" && payloadRoom.trim()) return payloadRoom;
    }

    // Fallback: if the user planned a route from a building to an indoor room on the campus map
    // itself (without a URL param), `handleConfirmRoute` stores the room record in state.
    const endRoomLabel = selectedRouteEndRoom?.label;
    if (typeof endRoomLabel === "string" && endRoomLabel.trim()) return endRoomLabel;

    return "";
  }, [destinationRoomQuery, transitionPayload, selectedRouteEndRoom]);

  // If we arrived from indoor navigation, auto-select the outdoor route so the map
  // immediately renders a path (instead of waiting for the user to pick buildings).
  useEffect(() => {
    if (transitionPayload?.mode !== "indoor_to_outdoor") return;

    const destCode = transitionPayload.destinationBuildingCode
      ?.trim()
      .toUpperCase();
    if (!destCode) return;

    const destBuilding = BUILDINGS.find(
      (b) => b.name.trim().toUpperCase() === destCode,
    );
    if (!destBuilding) return;

    const originCode = transitionPayload.originBuildingCode
      ?.trim()
      .toUpperCase();
    const originBuilding = originCode
      ? BUILDINGS.find((b) => b.name.trim().toUpperCase() === originCode)
      : null;

    // If we can’t resolve the origin building by code (or if the code is stale),
    // fall back to the building nearest to the exitOutdoor coordinate.
    const originByExit = transitionPayload.exitOutdoor
      ? findNearestBuilding(
        transitionPayload.exitOutdoor.latitude,
        transitionPayload.exitOutdoor.longitude,
      )
      : null;

    // Prefer showing the origin building's campus so the map initially centers on the start
    // building/exit (the outdoor leg should start from the origin). If the origin can't be
    // resolved, fall back to showing the destination campus.
    const effectiveOrigin = originBuilding ?? originByExit ?? null;

    let originCampus: CampusKey | null = null;
    if (effectiveOrigin) {
      originCampus = effectiveOrigin.campusName === "loyola" ? "loyola" : "sgw";
    }

    const destinationCampus: CampusKey =
      destBuilding.campusName === "loyola" ? "loyola" : "sgw";

    const campusToShow = originCampus ?? destinationCampus;
    setCurrentCampus(campusToShow);

    // Only override focusTarget when the user hasn't explicitly focused on their location.
    setFocusTarget((prev) => (prev === "user" ? prev : campusToShow));

    // Ensure both endpoints are set so CampusMap computes a route immediately.
    setSelectedRoute({
      start: originBuilding ?? originByExit ?? null,
      dest: destBuilding,
    });
    setSelectedStrategy(transitionPayload.strategy ?? WALKING_STRATEGY);
    setRouteFocusTrigger((c) => c + 1);

    // Show the navigation drawer so the user can pick walk/bike/drive/transit/shuttle.
    setIsNavVisible(true);
  }, [transitionPayload, findNearestBuilding]);

  // When we came from indoor navigation and the payload contains a final indoor destination,
  // we can show a single merged step list (indoor + outdoor + indoor).
  const mergedSteps = useMemo(() => {
    if (transitionPayload?.mode !== "indoor_to_outdoor") return null;
    const destRoom = transitionPayload.destinationIndoorRoomQuery?.trim();
    if (!destRoom) return null;

    const prefix: RouteStep[] = [
      {
        instruction: `Exit ${transitionPayload.originBuildingCode} to the selected entrance`,
      },
    ];

    const destCode = transitionPayload.destinationBuildingCode;
    const asset = getBuildingPlanAsset(destCode);

    // Attempt to compute a real indoor leg inside the destination building.
    // We pick the closest entry/exit node (by outdoorLatLng) to the building's outdoor coordinate.
    let finalIndoorSteps: RouteStep[] = [];
    try {
      const destBuilding = BUILDINGS.find(
        (b) => b.name.trim().toUpperCase() === destCode.trim().toUpperCase(),
      );
      const destOutdoor = destBuilding?.coordinates;

      type EntryExitNode = {
        id: string;
        type: string;
        outdoorLatLng?: {
          latitude: number;
          longitude: number;
        };
      };

      const entryNodes: EntryExitNode[] = (asset?.nodes ?? []).filter(
        (node: EntryExitNode) =>
          node.type === "building_entry_exit" && Boolean(node.outdoorLatLng),
      );

      if (destOutdoor && entryNodes.length > 0) {
        const bestNode = entryNodes
          .map((node) => {
            const ll = node.outdoorLatLng;
            if (!ll) return { node, d: Number.POSITIVE_INFINITY };
            const dx = ll.latitude - destOutdoor.latitude;
            const dy = ll.longitude - destOutdoor.longitude;
            return { node, d: dx * dx + dy * dy };
          })
          .sort((a, b) => a.d - b.d)[0]?.node;

        if (bestNode?.id) {
          const indoorLeg = getIndoorNavigationRouteFromNode(
            destCode,
            bestNode.id,
            destRoom,
            { accessibleOnly: Boolean(transitionPayload.accessibleOnly) },
          );
          if (indoorLeg.success) {
            finalIndoorSteps = indoorRouteToSteps(indoorLeg.route);
          }
        }
      }
    } catch {
      // If anything goes wrong, fall back to a single final hint line.
      finalIndoorSteps = [];
    }

    const suffix: RouteStep[] =
      finalIndoorSteps.length > 0
        ? [{ instruction: `Enter ${destCode}` }, ...finalIndoorSteps]
        : [{ instruction: `Enter ${destCode} and continue to ${destRoom}` }];

    return [...prefix, ...routeSteps, ...suffix];
  }, [routeSteps, transitionPayload]);

  // Optional origin override when arriving from indoor navigation.
  const startOverride =
    transitionPayload?.mode === "indoor_to_outdoor"
      ? transitionPayload.exitOutdoor
      : null;
  const [isNextClassVisible, setIsNextClassVisible] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

  const nextClass = useMemo(
    () => getNextClassFromItems(scheduleItems),
    [scheduleItems],
  );

  useEffect(() => {
    loadCachedSchedule()
      .then((items) => {
        if (items) setScheduleItems(items);
      })
      .catch(() => {
        setScheduleItems([]);
      });
  }, []);

  useEffect(() => {
    const campusValue = campus === "loyola" ? "loyola" : "sgw";
    setCurrentCampus(campusValue);
    setFocusTarget((prev) => (prev === "user" ? prev : campusValue));
  }, [campus]);

  useEffect(() => {
    const getUserBuilding = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      setAutoStartBuilding(findNearestBuilding(latitude, longitude));
    };
    getUserBuilding();
  }, [findNearestBuilding]);

  const selectCampus = (campusKey: CampusKey) => {
    setCurrentCampus(campusKey);
    setFocusTarget(campusKey);
  };

  const focusUserLocation = () => {
    setFocusTarget("user");
    setUserFocusCounter((c) => c + 1);
  };

  // ── Indoor map ─────────────────────────────────────────────────────────────

  const openIndoorMap = useCallback(
    (
      buildingCode?: string | null,
      roomQuery?: string,
      navOrigin?: string,
      navDest?: string,
      accessibleOnlyOverride?: boolean,
    ) => {
      const params = buildIndoorMapRouteParams(buildingCode, roomQuery);
      if (!params) return;
      router.push({
        pathname: "/IndoorMapScreen",
        params: {
          ...params,
          // If we're routing *to* a room from an implicit entrance ("Continue indoors"),
          // ensure IndoorMapScreen gets a real navDest even when `params` already contains
          // a roomQuery (which is only for search / highlight).
          ...(navOrigin ? { navOrigin } : {}),
          ...(navDest
            ? {
              navDest,
              // Keep the "To" input in sync with the final destination room.
              // (Do not overwrite a roomQuery passed explicitly by callers.)
              ...(roomQuery ? {} : { roomQuery: navDest }),
            }
            : {}),
          accessibleOnly: String(accessibleOnlyOverride ?? accessibleOnly),
        },
      });
    },
    [accessibleOnly],
  );

  const handleConfirmRoute = useCallback(
    (
      start: Buildings | null,
      dest: Buildings | null,
      strategy: RouteStrategy,
      startRoom?: IndoorRoomRecord | null,
      endRoom?: IndoorRoomRecord | null,
      accessible?: boolean,
    ) => {
      setAccessibleOnly(!!accessible);
      setSelectedRouteEndRoom(endRoom ?? null);

      type CrossBuildingIndoorTransition = {
        mode: "cross_building_indoor";
        originBuildingCode: string;
        originIndoorRoomQuery: string;
        destinationBuildingCode: string;
        destinationIndoorRoomQuery: string;
        strategy: RouteStrategy;
        accessibleOnly: boolean;
      };

      const intent = buildRouteConfirmIntent({
        start,
        dest,
        strategy,
        startRoom,
        endRoom,
        accessible,
      });

      if (intent.kind === "cross_building_indoor_to_indoor") {
        const payload: CrossBuildingIndoorTransition = {
          mode: "cross_building_indoor",
          originBuildingCode: intent.originBuildingCode,
          originIndoorRoomQuery: intent.originIndoorRoomQuery,
          destinationBuildingCode: intent.destinationBuildingCode,
          destinationIndoorRoomQuery: intent.destinationIndoorRoomQuery,
          strategy: intent.strategy,
          accessibleOnly: intent.accessibleOnly,
        };

        router.push({
          pathname: "/CampusMapScreen",
          params: {
            campus: intent.campus,
            transition: serializeTransitionPayload(payload),
          },
        });
        return;
      }

      if (intent.kind === "cross_building_indoor_to_outdoor") {
        setIsNavVisible(false);
        const params = buildIndoorMapRouteParams(intent.startBuilding.name);
        if (!params) return;
        router.push({
          pathname: "/IndoorMapScreen",
          params: buildCrossBuildingIndoorParams({
            params,
            startRoom: intent.startRoom,
            startBuilding: intent.startBuilding,
            destBuilding: intent.destBuilding,
            strategy: intent.strategy,
            accessible: intent.accessibleOnly,
          }),
        });
        return;
      }

      if (intent.kind === "same_building_indoor_room_to_room") {
        setIsNavVisible(false);
        openIndoorMap(
          intent.buildingCode,
          undefined,
          intent.navOrigin,
          intent.navDest,
          intent.accessibleOnly,
        );
        return;
      }

      if (intent.kind === "same_building_indoor_to_room") {
        setIsNavVisible(false);
        openIndoorMap(
          intent.buildingCode,
          intent.roomQuery,
          undefined,
          undefined,
          intent.accessibleOnly,
        );
        return;
      }

      setSelectedRoute({ start, dest });
      setSelectedStrategy(strategy);
      setIsNavVisible(false);
      setRouteFocusTrigger((c) => (start ? c + 1 : c));
    },
    [openIndoorMap],
  );

  const handleOpenNextClassIndoorMap = useCallback(() => {
    if (!nextClass?.room.trim()) return;
    setIsNextClassVisible(false);
    const roomQuery = normalizeRoomQuery(nextClass.building, nextClass.room);
    openIndoorMap(nextClass.building, roomQuery);
  }, [nextClass, openIndoorMap]);

  const handleViewBuildingIndoorMap = useCallback(
    (building: Buildings) => {
      openIndoorMap(building.name);
    },
    [openIndoorMap],
  );

  // ── Shuttle ────────────────────────────────────────────────────────────────

  const [showShuttle, setShowShuttle] = useState(false);
  const [showShuttleSchedulePanel, setShowShuttleSchedulePanel] =
    useState(false);
  const shuttleStatus = useShuttleAvailability(currentCampus);

  let accessibilityLabel: string;
  if (!shuttleStatus.available) {
    accessibilityLabel = "Shuttle not available";
  } else if (showShuttle) {
    accessibilityLabel = "Hide shuttle";
  } else {
    accessibilityLabel = "Show shuttle";
  }

  useEffect(() => {
    if (!shuttleStatus.available && showShuttle) setShowShuttle(false);
  }, [shuttleStatus.available, showShuttle]);

  const hasActiveRoute =
    selectedRoute.start != null && selectedRoute.dest != null;
  const showStepsPanel = hasActiveRoute && (mergedSteps?.length || routeSteps.length) > 0;

  // Destination building code for the "Continue indoors" affordance.
  // In production, indoor floor metadata may not be loaded here, so we only gate
  // on having a destination building code.
  const continueIndoorsBuildingCode = useMemo(
    () =>
      getContinueIndoorsBuildingCode({
        selectedDest: selectedRoute.dest,
        transitionPayload,
      }),
    [selectedRoute.dest, transitionPayload],
  );

  // Only show "Continue indoors" when the *final* destination is a room.
  // Accept either the explicit query param (building → room use-case) or a
  // transition payload indoor destination (indoor → outdoor → indoor use-case).
  const hasIndoorRoomDestination = Boolean(destinationRoomQueryText.trim());

  // (Outdoor building → outdoor building should not offer an indoor CTA.)
  const canContinueIndoors = Boolean(
    continueIndoorsBuildingCode && hasIndoorRoomDestination,
  );

  const nextClassIndoorAccess = useMemo(
    () => getIndoorAccessState(nextClass?.building),
    [nextClass?.building],
  );
  const canOpenNextClassIndoorMap = Boolean(
    nextClassIndoorAccess.hasSearchableRooms && nextClass?.room.trim(),
  );

  type InteractiveRouteStep = RouteStep & {
    onPress?: () => void;
  };

  const routeStepsWithContinueIndoors = useMemo<InteractiveRouteStep[]>(() => {
    const baseSteps: InteractiveRouteStep[] = mergedSteps ?? routeSteps;
    if (!canContinueIndoors) return baseSteps;

    const built = buildContinueIndoorsStep({
      baseSteps,
      destinationBuildingCode: continueIndoorsBuildingCode,
      destinationRoomQuery: destinationRoomQueryText,
    });
    if (!built) return baseSteps;

    // Attach the press handler here (keeps helper pure for easy 100% tests).
    const steps: InteractiveRouteStep[] = [...built.steps];
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      steps[lastIndex] = {
        ...steps[lastIndex],
        onPress: () => {
          openIndoorMap(
            built.openArgs.buildingCode,
            undefined,
            built.openArgs.navOrigin,
            built.openArgs.navDest,
          );
        },
      };
    }

    return steps;
  }, [mergedSteps, routeSteps, canContinueIndoors, continueIndoorsBuildingCode, destinationRoomQueryText, openIndoorMap]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Extracted variable for demoCurrentBuilding ?? autoStartBuilding
  const effectiveCurrentBuilding = demoCurrentBuilding ?? autoStartBuilding;

  return (
    <View style={{ flex: 1 }}>
      <CampusMap
        coordinates={CAMPUSES[currentCampus].coordinates}
        focusTarget={focusTarget}
        userFocusCounter={userFocusCounter}
        routeFocusTrigger={routeFocusTrigger}
        startPoint={selectedRoute.start}
        startOverride={startOverride}
        destinationPoint={selectedRoute.dest}
        showShuttle={showShuttle}
        strategy={selectedStrategy}
        demoCurrentBuilding={demoCurrentBuilding}
        onRouteSteps={setRouteSteps}
        onSetAsStart={(building) => {
          setInitialStart(building);
          setIsNavVisible(true);
        }}
        onSetAsDestination={(building) => {
          setInitialDestination(building);
          setIsNavVisible(true);
        }}
        onSetAsMyLocation={(building) => setDemoCurrentBuilding(building)}
        onViewIndoorMap={handleViewBuildingIndoorMap}
        onUserLocationResolved={setUserLocation}
        nearbyPOIs={nearbyPOIs}
        focusPOIId={focusPOIId}
        focusPOITrigger={focusPOITrigger}
      />

      <View style={styles.campusToggleContainer} pointerEvents="box-none">
        <View style={styles.campusToggle}>
          <Pressable
            onPress={() => selectCampus("sgw")}
            testID="campus-toggle-sgw"
            style={[
              styles.campusToggleOption,
              styles.campusToggleOptionLeft,
              currentCampus === "sgw" && styles.campusToggleOptionActive,
            ]}
          >
            <Text
              style={[
                styles.campusToggleText,
                currentCampus === "sgw" && styles.campusToggleTextActive,
              ]}
            >
              SGW
            </Text>
          </Pressable>
          <Pressable
            onPress={() => selectCampus("loyola")}
            testID="campus-toggle-loyola"
            style={[
              styles.campusToggleOption,
              currentCampus === "loyola" && styles.campusToggleOptionActive,
            ]}
          >
            <Text
              style={[
                styles.campusToggleText,
                currentCampus === "loyola" && styles.campusToggleTextActive,
              ]}
            >
              Loyola
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Continue indoors is rendered as the final step inside the directions panel. */}

      {showPOIFilter && (
        <View style={styles.poiPanel}>
          <OutdoorPOIFilter
            activeCategories={activePOICategories}
            onToggle={handleTogglePOICategory}
          />
          <POIRangeSelector selected={poiRange} onSelect={setPOIRange} />
        </View>
      )}

      {/* Left button stack */}
      <View
        style={[styles.buttonStack, { left: spacing.md, right: undefined }]}
      >
        <Pressable
          testID="show-shuttle-button"
          onPress={() => {
            if (shuttleStatus.available) setShowShuttle(!showShuttle);
          }}
          style={[
            styles.actionButton,
            (!showShuttle || !shuttleStatus.available) &&
            styles.shuttleDisabled,
          ]}
          accessibilityState={{ disabled: !shuttleStatus.available }}
          accessibilityLabel={accessibilityLabel}
        >
          <MaterialCommunityIcons
            name={showShuttle ? "bus-clock" : "bus-stop"}
            size={24}
            color={colors.white}
          />
        </Pressable>
        <Pressable
          testID="shuttle-schedule-button"
          accessibilityLabel="shuttle-schedule-button"
          onPress={() => setShowShuttleSchedulePanel(true)}
          style={[styles.actionButton]}
        >
          <MaterialCommunityIcons
            name="calendar-clock"
            size={24}
            color={colors.white}
          />
        </Pressable>
      </View>

      {/* Right button stack */}
      <View style={styles.buttonStack}>
        <Pressable
          testID="poi-filter-button"
          accessibilityLabel={showPOIFilter ? "Hide nearby places" : "Show nearby places"}
          onPress={() => {
            setShowPOIFilter((v) => {
              if (v) {
                clearPOIs();
                setShowPOIList(false);
                setActivePOICategories(new Set());
              }
              return !v;
            });
          }}
          style={[
            styles.actionButton,
            showPOIFilter && { backgroundColor: colors.secondary, borderColor: colors.secondaryDark },
          ]}
        >
          <MaterialIcons name="place" size={24} color={colors.white} />
        </Pressable>
        <Pressable
          testID="next-class-button"
          accessibilityLabel="Navigate to next class"
          onPress={() => setIsNextClassVisible(true)}
          disabled={nextClass === null}
          style={[
            styles.actionButton,
            styles.nextClassButton,
            nextClass === null && styles.nextClassButtonDisabled,
          ]}
        >
          <MaterialIcons name="school" size={24} color={colors.white} />
        </Pressable>
        <Pressable
          testID="directions-button"
          accessibilityLabel="directions-button"
          onPress={() => setIsNavVisible(true)}
          style={styles.actionButton}
        >
          <MaterialIcons
            name="directions"
            size={24}
            color={colors.white}
            importantForAccessibility="no-hide-descendants"
          />
        </Pressable>
        <Pressable
          testID="my-location-button"
          accessibilityLabel="my-location-button"
          onPress={focusUserLocation}
          style={[
            styles.actionButton,
            focusTarget === "user" && styles.myLocationButtonActive,
          ]}
        >
          <MaterialIcons name="my-location" size={22} color={colors.white} />
        </Pressable>
      </View>

      {showPOIList && (
        <POIListPanel
          pois={nearbyPOIs}
          origin={poiSearchLocation}
          onClose={() => setShowPOIList(false)}
          onSelect={(poi) => {
            setFocusPOIId(poi.placeId);
            setFocusPOITrigger((c) => c + 1);
          }}
          loading={poisLoading}
          error={poisError}
          locationUnavailable={!userLocation}
          onRetry={retryPOISearch}
        />
      )}

      {showShuttleSchedulePanel && (
        <ShuttleSchedulePanel
          onClose={() => setShowShuttleSchedulePanel(false)}
        />
      )}

      {showStepsPanel && (
        <DirectionStepsPanel
          steps={routeStepsWithContinueIndoors}
          strategy={selectedStrategy}
          onChangeRoute={() => {
            setInitialStart(selectedRoute.start);
            setInitialDestination(selectedRoute.dest);
            setIsNavVisible(true);
          }}
          onDismiss={() => {
            setSelectedRoute({ start: null, dest: null });
            setRouteSteps([]);
          }}
          onFocusUser={focusUserLocation}
        />
      )}

      <NavigationBar
        visible={isNavVisible}
        onClose={() => {
          setIsNavVisible(false);
          setInitialStart(null);
          setInitialDestination(null);
        }}
        onConfirm={handleConfirmRoute}
        autoStartBuilding={effectiveCurrentBuilding}
        initialStart={initialStart}
        onInitialStartApplied={() => setInitialStart(null)}
        initialDestination={initialDestination}
        onInitialDestinationApplied={() => setInitialDestination(null)}
        currentCampus={currentCampus}
        onUseMyLocation={() => effectiveCurrentBuilding ?? null}
        accessibleOnly={accessibleOnly}
        onAccessibleOnlyChange={setAccessibleOnly}
      />

      <NextClassDirectionsPanel
        visible={isNextClassVisible}
        onClose={() => setIsNextClassVisible(false)}
        onConfirm={handleConfirmRoute}
        nextClass={nextClass}
        scheduleItems={scheduleItems}
        autoStartBuilding={effectiveCurrentBuilding}
        currentCampus={currentCampus}
        onUseMyLocation={() => effectiveCurrentBuilding ?? null}
        canOpenIndoorMap={canOpenNextClassIndoorMap}
        onOpenIndoorMap={handleOpenNextClassIndoorMap}
      />
    </View>
  );
}
