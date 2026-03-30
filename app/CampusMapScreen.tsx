import { getSessionId } from "@/constants/usabilityConfig";
import { logUsabilityEvent } from "@/utils/usabilityAnalytics";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  OUTDOOR_POI_CATEGORY_MAP,
  type OutdoorPOICategoryId,
} from "../constants/outdoorPOI";
import { DEFAULT_POI_RANGE, type POIRangeOption } from "../constants/poiRange";
import { WALKING_STRATEGY } from "../constants/strategies";
import { colors, spacing } from "../constants/theme";
import { Buildings, RouteStep, ScheduleItem } from "../constants/type";
import { USABILITY_TESTING_ENABLED } from "../constants/usabilityConfig";
import { useNearbyPOIs } from "../hooks/useNearbyPOIs";
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import type { PlacePOI } from "../services/GooglePlacesService";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/CampusMapScreen.styles";
import {
  buildContinueIndoorsStep,
  getContinueIndoorsBuildingCode,
} from "../utils/continueIndoors";
import {
  buildIndoorMapRouteParams,
  getIndoorAccessState,
  normalizeRoomQuery,
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
import {
  parseTransitionPayload,
  serializeTransitionPayload,
} from "../utils/routeTransition";

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

function toBuildingCode(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const code = value.trim().toUpperCase();
    return code || null;
  }
  if (
    typeof value === "object" &&
    "name" in value &&
    typeof (value as { name?: unknown }).name === "string"
  ) {
    const code = ((value as { name: string }).name ?? "").trim().toUpperCase();
    return code || null;
  }
  return null;
}

function getCampusByCode(buildingCode: string | null): CampusKey | null {
  if (!buildingCode) return null;
  const found = BUILDINGS.find(
    (b) => b.name.trim().toUpperCase() === buildingCode,
  );
  if (!found?.campusName) return null;
  return found.campusName === "loyola" ? "loyola" : "sgw";
}

function classifyIndoorOutdoorTask(
  start: unknown,
  dest: unknown,
): "task_13" | "task_14" | null {
  const startCode = toBuildingCode(start);
  const destCode = toBuildingCode(dest);
  if (!startCode || !destCode || startCode === destCode) return null;

  const startCampus = getCampusByCode(startCode);
  const destCampus = getCampusByCode(destCode);
  if (!startCampus || !destCampus) return null;

  return startCampus === destCampus ? "task_13" : "task_14";
}

function parseStartedAtMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
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

type IndoorRouteIntent =
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
    };

type OpenIndoorMapFn = (
  buildingCode?: string | null,
  roomQuery?: string,
  navOrigin?: string,
  navDest?: string,
  accessibleOnlyOverride?: boolean,
) => void;

export function handleIndoorRouteIntent({
  intent,
  openIndoorMap,
  setIsNavVisible,
}: {
  intent: IndoorRouteIntent;
  openIndoorMap: OpenIndoorMapFn;
  setIsNavVisible: (visible: boolean) => void;
}): void {
  setIsNavVisible(false);

  if (intent.kind === "same_building_indoor_room_to_room") {
    openIndoorMap(
      intent.buildingCode,
      undefined,
      intent.navOrigin,
      intent.navDest,
      intent.accessibleOnly,
    );
    return;
  }

  openIndoorMap(
    intent.buildingCode,
    intent.roomQuery,
    undefined,
    undefined,
    intent.accessibleOnly,
  );
}

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
  const isCrossBuilding =
    hasStartName && hasDestName && start?.name !== dest?.name;
  const isSameBuilding =
    hasStartName && hasDestName && start?.name === dest?.name;

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
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const { campus, transition, destinationRoomQuery } = useLocalSearchParams<{
    campus?: CampusKey;
    transition?: string;
    destinationRoomQuery?: string;
  }>();

  const transitionPayload = useMemo(
    () =>
      parseTransitionPayload(
        typeof transition === "string" ? transition : undefined,
      ),
    [transition],
  );

  useEffect(() => {
    if (transitionPayload?.mode !== "cross_building_indoor") return;

    const originCode = transitionPayload.originBuildingCode
      .trim()
      .toUpperCase();
    const destCode = transitionPayload.destinationBuildingCode
      .trim()
      .toUpperCase();

    router.push({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: originCode,
        floors: "1",
        navOrigin: transitionPayload.originIndoorRoomQuery,
        navDest: destCode,
        outdoorDestBuilding: destCode,
        outdoorStrategy: transitionPayload.strategy
          ? JSON.stringify(transitionPayload.strategy)
          : undefined,
        outdoorAccessibleOnly: transitionPayload.accessibleOnly
          ? "true"
          : "false",
        destinationRoomQuery: transitionPayload.destinationIndoorRoomQuery,
        accessibleOnly: String(Boolean(transitionPayload.accessibleOnly)),
        ...(transitionPayload.usabilityTaskId
          ? { usabilityTaskId: transitionPayload.usabilityTaskId }
          : {}),
        ...(typeof transitionPayload.usabilityTaskStartedAtMs === "number"
          ? {
              usabilityTaskStartedAtMs: String(
                transitionPayload.usabilityTaskStartedAtMs,
              ),
            }
          : {}),
      },
    });
  }, [transitionPayload]);

  // ── Usability Testing ────────────────────────────────────────────────────
  const sessionId = useRef(getSessionId());
  const mapLoadTime = useRef<number>(Date.now());
  const taskTimers = useRef<Record<string, number>>({});
  const completedIndoorOutdoorTasks = useRef<Set<string>>(new Set());

  // FIX: guard against endTask firing without a matching startTask — prevents
  // bogus 0ms durations for tasks that were never started.
  const startTask = (taskId: string) => {
    if (!USABILITY_TESTING_ENABLED) return;
    taskTimers.current[taskId] = Date.now();
  };

  const endTask = async (
    taskId: string,
    extraParams: Record<string, unknown> = {},
  ) => {
    if (!USABILITY_TESTING_ENABLED) return;
    const start = taskTimers.current[taskId];
    // Skip if no matching startTask — avoids ghost 0ms completions
    if (!start) return;
    const duration_ms = Date.now() - start;
    delete taskTimers.current[taskId];

    await logUsabilityEvent("task_completed", {
      session_id: sessionId.current,
      task_id: taskId,
      duration_ms,
      ...extraParams,
    });

    await logUsabilityEvent("task_finished", {
      session_id: sessionId.current,
      finished_task_id: taskId,
      duration_ms,
      ...extraParams,
    });
  };

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
  const [selectedRouteEndRoom, setSelectedRouteEndRoom] =
    useState<IndoorRoomRecord | null>(null);
  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [showPOIFilter, setShowPOIFilter] = useState(false);
  const [showPOIList, setShowPOIList] = useState(false);
  const [focusPOIId, setFocusPOIId] = useState<string | null>(null);
  const [focusPOITrigger, setFocusPOITrigger] = useState(0);
  const [selectedOutdoorPOI, setSelectedOutdoorPOI] = useState<PlacePOI | null>(
    null,
  );
  const [activeOutdoorPOIRoute, setActiveOutdoorPOIRoute] =
    useState<PlacePOI | null>(null);
  const [poiRouteError, setPOIRouteError] = useState<string | null>(null);
  const [activePOICategories, setActivePOICategories] = useState<
    Set<OutdoorPOICategoryId>
  >(new Set());
  const [poiRange, setPOIRange] = useState<POIRangeOption>(DEFAULT_POI_RANGE);
  const [poiSearchTrigger, setPoiSearchTrigger] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showShuttle, setShowShuttle] = useState(false);
  const [showShuttleSchedulePanel, setShowShuttleSchedulePanel] =
    useState(false);

  const {
    pois: nearbyPOIs,
    loading: poisLoading,
    error: poisError,
    search: searchPOIs,
    clear: clearPOIs,
  } = useNearbyPOIs();
  const shuttleStatus = useShuttleAvailability(currentCampus);

  const poiSearchLocation = userLocation ?? CAMPUSES[currentCampus].coordinates;

  const activePOICategoryKey = useMemo(
    () =>
      Array.from(activePOICategories)
        .sort((a, b) => a.localeCompare(b))
        .join(","),
    [activePOICategories],
  );

  useEffect(() => {
    if (!showPOIFilter) return;
    if (activePOICategories.size === 0) {
      clearPOIs();
      return;
    }
    searchPOIs(
      poiSearchLocation,
      poiRange.meters,
      Array.from(activePOICategories),
    );
    setShowPOIList(true);
  }, [
    activePOICategoryKey,
    poiRange.meters,
    poiSearchLocation,
    showPOIFilter,
    poiSearchTrigger,
  ]);

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

  const navStartTime = useRef<number | null>(null);
  const navOpenCount = useRef<number>(0);

  // FIX task_6: guard so endTask fires only once per confirmed route,
  // not on every map re-render that produces steps.
  const task6EndedRef = useRef(false);

  const openNavigationBar = async (trigger: string = "directions_button") => {
    navStartTime.current = Date.now();
    navOpenCount.current += 1;
    setIsNavVisible(true);
    await logUsabilityEvent("nav_bar_opened", {
      session_id: sessionId.current,
      trigger,
      open_count: navOpenCount.current,
      time_since_map_load_ms: Date.now() - mapLoadTime.current,
    });
    // task_5 is now started in onSetAsDestination / onSetAsStart so we don't
  };

  const destinationRoomQueryText = useMemo(() => {
    if (
      typeof destinationRoomQuery === "string" &&
      destinationRoomQuery.trim()
    ) {
      return destinationRoomQuery;
    }

    if (transitionPayload?.mode === "indoor_to_outdoor") {
      const payloadRoom = transitionPayload.destinationIndoorRoomQuery;
      if (typeof payloadRoom === "string" && payloadRoom.trim())
        return payloadRoom;
    }

    const endRoomLabel = selectedRouteEndRoom?.label;
    if (typeof endRoomLabel === "string" && endRoomLabel.trim())
      return endRoomLabel;

    return "";
  }, [destinationRoomQuery, transitionPayload, selectedRouteEndRoom]);

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

    const originByExit = transitionPayload.exitOutdoor
      ? findNearestBuilding(
          transitionPayload.exitOutdoor.latitude,
          transitionPayload.exitOutdoor.longitude,
        )
      : null;

    const effectiveOrigin = originBuilding ?? originByExit ?? null;

    let originCampus: CampusKey | null = null;
    if (effectiveOrigin) {
      originCampus = effectiveOrigin.campusName === "loyola" ? "loyola" : "sgw";
    }

    const destinationCampus: CampusKey =
      destBuilding.campusName === "loyola" ? "loyola" : "sgw";

    const campusToShow = originCampus ?? destinationCampus;
    setCurrentCampus(campusToShow);

    setFocusTarget((prev) => (prev === "user" ? prev : campusToShow));

    setSelectedRoute({
      start: originBuilding ?? originByExit ?? null,
      dest: destBuilding,
    });
    setSelectedStrategy(transitionPayload.strategy ?? WALKING_STRATEGY);
    setRouteFocusTrigger((c) => c + 1);
    setIsNavVisible(true);
  }, [transitionPayload, findNearestBuilding]);

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

    let finalIndoorSteps: RouteStep[] = [];
    try {
      const destBuilding = BUILDINGS.find(
        (b) => b.name.trim().toUpperCase() === destCode.trim().toUpperCase(),
      );
      const destOutdoor = destBuilding?.coordinates;

      type EntryExitNode = {
        id: string;
        type: string;
        outdoorLatLng?: { latitude: number; longitude: number };
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
      finalIndoorSteps = [];
    }

    const suffix: RouteStep[] =
      finalIndoorSteps.length > 0
        ? [{ instruction: `Enter ${destCode}` }, ...finalIndoorSteps]
        : [{ instruction: `Enter ${destCode} and continue to ${destRoom}` }];

    return [...prefix, ...routeSteps, ...suffix];
  }, [routeSteps, transitionPayload]);

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
      .catch(() => setScheduleItems([]));
  }, []);

  useEffect(() => {
    const campusValue = campus === "loyola" ? "loyola" : "sgw";
    setCurrentCampus(campusValue);
    setFocusTarget((prev) => {
      if (prev === "user") return prev;
      return campusValue;
    });
  }, [campus]);

  useEffect(() => {
    const getUserBuilding = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      const building = findNearestBuilding(latitude, longitude);
      setAutoStartBuilding(building);

      await logUsabilityEvent("user_building_detected", {
        session_id: sessionId.current,
        building_name: building?.name ?? "unknown",
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
    };
    getUserBuilding();
  }, [findNearestBuilding]);

  // Map load: start timers for task_1, task_2, task_3
  useEffect(() => {
    mapLoadTime.current = Date.now();
    startTask("task_1");
    startTask("task_2");
    startTask("task_3");
    const run = async () => {
      await logUsabilityEvent("map_screen_loaded", {
        session_id: sessionId.current,
        campus: campus ?? "sgw",
        timestamp: new Date().toISOString(),
      });
    };
    run();
  }, []);

  useEffect(() => {
    if (!shuttleStatus.available && showShuttle) setShowShuttle(false);
  }, [shuttleStatus.available, showShuttle]);

  const selectCampus = async (campusKey: CampusKey) => {
    setCurrentCampus(campusKey);
    setFocusTarget(campusKey);

    try {
      await logUsabilityEvent("campus_switch", {
        session_id: sessionId.current,
        campus_name: campusKey,
        screen: "CampusMapScreen",
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
        timestamp: new Date().toISOString(),
      });
      //task_2: now has a matching startTask so duration is non-zero.
      await endTask("task_2", { campus_switched_to: campusKey });
    } catch (error) {
      console.error("Firebase Analytics Error: ", error);
    }
  };

  const handleSelectOutdoorPOI = useCallback((poi: PlacePOI) => {
    setSelectedOutdoorPOI(poi);
    setPOIRouteError(null);
    setFocusPOIId(poi.placeId);
    setFocusPOITrigger((c) => c + 1);
    setShowPOIList(false);

    setActiveOutdoorPOIRoute((previousRoutePOI) => {
      if (!previousRoutePOI || previousRoutePOI.placeId === poi.placeId)
        return previousRoutePOI;
      setRouteFocusTrigger((c) => c + 1);
      return poi;
    });
  }, []);

  const clearOutdoorPOIRouteState = useCallback(() => {
    setSelectedOutdoorPOI(null);
    setActiveOutdoorPOIRoute(null);
    setPOIRouteError(null);
    setRouteSteps([]);
  }, []);

  const focusUserLocation = useCallback(async () => {
    setFocusTarget("user");
    setUserFocusCounter((c) => c + 1);

    try {
      await logUsabilityEvent("current_location_pressed", {
        session_id: sessionId.current,
        screen: "CampusMapScreen",
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
      await endTask("task_1");
    } catch (error) {
      console.error("Firebase Analytics Error: ", error);
    }
  }, []);

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

          ...(navOrigin ? { navOrigin } : {}),
          ...(navDest
            ? {
                navDest,
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
    async (
      start: Buildings | null,
      dest: Buildings | null,
      strategy: RouteStrategy,
      startRoom?: IndoorRoomRecord | null,
      endRoom?: IndoorRoomRecord | null,
      accessible?: boolean,
    ): Promise<void> => {
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
        usabilityTaskId?: "task_13" | "task_14";
        usabilityTaskStartedAtMs?: number;
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
          usabilityTaskId: classifyIndoorOutdoorTask(start, dest) ?? undefined,
          usabilityTaskStartedAtMs: Date.now(),
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

      if (
        intent.kind === "same_building_indoor_room_to_room" ||
        intent.kind === "same_building_indoor_to_room"
      ) {
        handleIndoorRouteIntent({
          intent,
          openIndoorMap,
          setIsNavVisible,
        });
        return;
      }

      setActiveOutdoorPOIRoute(null);
      setPOIRouteError(null);
      setSelectedRoute({ start, dest });
      setSelectedStrategy(strategy);
      setIsNavVisible(false);
      setRouteFocusTrigger((c) => (start ? c + 1 : c));

      task6EndedRef.current = false;

      const indoorOutdoorTaskId = classifyIndoorOutdoorTask(start, dest);
      const startCode = toBuildingCode(start);
      const destCode = toBuildingCode(dest);

      if (indoorOutdoorTaskId) {
        completedIndoorOutdoorTasks.current.delete(indoorOutdoorTaskId);
        startTask(indoorOutdoorTaskId);
        await logUsabilityEvent("indoor_outdoor_route_requested", {
          session_id: sessionId.current,
          task_id: indoorOutdoorTaskId,
          start_building_code: startCode ?? "unknown",
          destination_building_code: destCode ?? "unknown",
          same_campus: indoorOutdoorTaskId === "task_13",
          cross_campus: indoorOutdoorTaskId === "task_14",
          travel_mode: strategy.mode,
          time_since_map_load_ms: Date.now() - mapLoadTime.current,
        });
      }

      try {
        const timeSpent = navStartTime.current
          ? Date.now() - navStartTime.current
          : 0;
        await logUsabilityEvent("route_generated", {
          session_id: sessionId.current,
          start_location: start?.name ?? "My Location",
          dest_location: dest?.name ?? "Unknown",
          travel_mode: strategy.mode,
          time_spent_ms: timeSpent,
          nav_open_count: navOpenCount.current,
        });
        navStartTime.current = null;

        // FIX task_5: end here — tester has successfully confirmed a route
        await endTask("task_5", {
          start_location: start?.name ?? "My Location",
          dest_location: dest?.name ?? "Unknown",
          travel_mode: strategy.mode,
        });

        // task_6 starts the moment route is confirmed, ends when steps panel appears
        startTask("task_6");
      } catch (error) {
        console.error("Firebase Analytics Error: ", error);
      }
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

  const accessibilityLabel = useMemo(() => {
    if (!shuttleStatus.available) return "Shuttle not available";
    if (showShuttle) return "Hide shuttle";
    return "Show shuttle";
  }, [shuttleStatus.available, showShuttle]);

  const effectiveCurrentBuilding = demoCurrentBuilding ?? autoStartBuilding;

  const outdoorPOIRouteStart = useMemo(() => {
    if (!activeOutdoorPOIRoute) return null;
    if (userLocation) {
      return findNearestBuilding(userLocation.latitude, userLocation.longitude);
    }
    return effectiveCurrentBuilding;
  }, [
    activeOutdoorPOIRoute,
    userLocation,
    findNearestBuilding,
    effectiveCurrentBuilding,
  ]);

  const hasActiveRoute =
    (selectedRoute.start != null && selectedRoute.dest != null) ||
    (activeOutdoorPOIRoute != null && outdoorPOIRouteStart != null);
  const showStepsPanel =
    hasActiveRoute && (mergedSteps?.length || routeSteps.length) > 0;

  const continueIndoorsBuildingCode = useMemo(
    () =>
      getContinueIndoorsBuildingCode({
        selectedDest: selectedRoute.dest,
        transitionPayload,
      }),
    [selectedRoute.dest, transitionPayload],
  );

  const hasIndoorRoomDestination = Boolean(destinationRoomQueryText.trim());

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
  const activeIndoorOutdoorTask = useMemo(
    () => classifyIndoorOutdoorTask(selectedRoute.start, selectedRoute.dest),
    [selectedRoute.dest, selectedRoute.start],
  );

  const finalizeIndoorOutdoorTask = useCallback(
    (
      taskId: "task_13" | "task_14",
      startBuildingCode: string,
      destinationBuildingCode: string,
      startedAtMs: number | null,
    ) => {
      const durationMs =
        typeof startedAtMs === "number" && startedAtMs > 0
          ? Math.max(Date.now() - startedAtMs, 0)
          : 0;

      completedIndoorOutdoorTasks.current.add(taskId);
      delete taskTimers.current[taskId];

      logUsabilityEvent("indoor_outdoor_task_completed", {
        session_id: sessionId.current,
        task_id: taskId,
        start_building_code: startBuildingCode,
        destination_building_code: destinationBuildingCode,
        same_campus: taskId === "task_13",
        cross_campus: taskId === "task_14",
        duration_ms: durationMs,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      }).catch(console.error);

      logUsabilityEvent("task_completed", {
        session_id: sessionId.current,
        task_id: taskId,
        duration_ms: durationMs,
        start_building_code: startBuildingCode,
        destination_building_code: destinationBuildingCode,
      }).catch(console.error);

      logUsabilityEvent("task_finished", {
        session_id: sessionId.current,
        finished_task_id: taskId,
        duration_ms: durationMs,
        start_building_code: startBuildingCode,
        destination_building_code: destinationBuildingCode,
      }).catch(console.error);
    },
    [],
  );

  const handleRouteSteps = useCallback(async (steps: RouteStep[]) => {
    setRouteSteps(steps);

    if (steps.length > 0 && !task6EndedRef.current) {
      task6EndedRef.current = true;
      try {
        await logUsabilityEvent("steps_panel_viewed", {
          session_id: sessionId.current,
          step_count: steps.length,
        });
        await endTask("task_6", { step_count: steps.length });
      } catch (error) {
        console.error("Firebase Analytics Error: ", error);
      }
    }
  }, []);

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

    const steps: InteractiveRouteStep[] = [...built.steps];
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      steps[lastIndex] = {
        ...steps[lastIndex],
        onPress: () => {
          const payloadTaskId =
            transitionPayload?.mode === "indoor_to_outdoor" &&
            (transitionPayload.usabilityTaskId === "task_13" ||
              transitionPayload.usabilityTaskId === "task_14")
              ? transitionPayload.usabilityTaskId
              : null;
          const fallbackTaskId = classifyIndoorOutdoorTask(
            selectedRoute.start,
            selectedRoute.dest,
          );
          const effectiveTaskId = payloadTaskId ?? fallbackTaskId;

          if (effectiveTaskId) {
            const payloadStartedAtMs =
              transitionPayload?.mode === "indoor_to_outdoor"
                ? parseStartedAtMs(transitionPayload.usabilityTaskStartedAtMs)
                : null;
            const timerStartedAtMs =
              taskTimers.current[effectiveTaskId] ?? null;
            const effectiveStartedAtMs = payloadStartedAtMs ?? timerStartedAtMs;
            const startCode = toBuildingCode(selectedRoute.start) ?? "unknown";
            const destCode =
              built.openArgs.buildingCode ??
              toBuildingCode(selectedRoute.dest) ??
              "unknown";

            finalizeIndoorOutdoorTask(
              effectiveTaskId,
              startCode,
              destCode,
              effectiveStartedAtMs,
            );
          }

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
  }, [
    mergedSteps,
    routeSteps,
    canContinueIndoors,
    continueIndoorsBuildingCode,
    destinationRoomQueryText,
    finalizeIndoorOutdoorTask,
    openIndoorMap,
    selectedRoute.dest,
    selectedRoute.start,
    transitionPayload,
  ]);

  useEffect(() => {
    const hasOutdoorSegment = routeSteps.length > 0;
    const hasIndoorSuffix =
      routeStepsWithContinueIndoors.length > routeSteps.length;
    const isCombinedDirectionsVisible =
      showStepsPanel && hasOutdoorSegment && hasIndoorSuffix;

    if (!activeIndoorOutdoorTask || !isCombinedDirectionsVisible) return;
    if (completedIndoorOutdoorTasks.current.has(activeIndoorOutdoorTask))
      return;

    completedIndoorOutdoorTasks.current.add(activeIndoorOutdoorTask);

    const startCode = toBuildingCode(selectedRoute.start) ?? "unknown";
    const destCode = toBuildingCode(selectedRoute.dest) ?? "unknown";

    const run = async () => {
      await logUsabilityEvent("indoor_outdoor_combined_directions_viewed", {
        session_id: sessionId.current,
        task_id: activeIndoorOutdoorTask,
        start_building_code: startCode,
        destination_building_code: destCode,
        same_campus: activeIndoorOutdoorTask === "task_13",
        cross_campus: activeIndoorOutdoorTask === "task_14",
        outdoor_step_count: routeSteps.length,
        total_step_count: routeStepsWithContinueIndoors.length,
        indoor_segment_step_count:
          routeStepsWithContinueIndoors.length - routeSteps.length,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
    };

    run().catch(console.error);
  }, [
    activeIndoorOutdoorTask,
    routeSteps,
    routeStepsWithContinueIndoors,
    selectedRoute.dest,
    selectedRoute.start,
    showStepsPanel,
  ]);
  const activeOutdoorPOIDestination = useMemo(
    () =>
      activeOutdoorPOIRoute
        ? {
            latitude: activeOutdoorPOIRoute.latitude,
            longitude: activeOutdoorPOIRoute.longitude,
          }
        : null,
    [activeOutdoorPOIRoute],
  );

  const selectedOutdoorPOICategory = selectedOutdoorPOI
    ? OUTDOOR_POI_CATEGORY_MAP[selectedOutdoorPOI.categoryId]
    : null;

  const startOutdoorPOIRoute = useCallback(() => {
    if (!selectedOutdoorPOI) return;

    const routeStart = userLocation
      ? findNearestBuilding(userLocation.latitude, userLocation.longitude)
      : effectiveCurrentBuilding;

    if (!routeStart) {
      setPOIRouteError(
        "Unable to resolve a starting location. Enable location services or set your location on the map.",
      );
      return;
    }

    setPOIRouteError(null);
    setActiveOutdoorPOIRoute(selectedOutdoorPOI);
    setSelectedRoute({ start: routeStart, dest: null });
    setRouteFocusTrigger((c) => c + 1);
  }, [
    selectedOutdoorPOI,
    userLocation,
    findNearestBuilding,
    effectiveCurrentBuilding,
  ]);

  return (
    <View style={styles.rootContainer}>
      <CampusMap
        coordinates={CAMPUSES[currentCampus].coordinates}
        focusTarget={focusTarget}
        userFocusCounter={userFocusCounter}
        routeFocusTrigger={routeFocusTrigger}
        startPoint={
          activeOutdoorPOIRoute ? outdoorPOIRouteStart : selectedRoute.start
        }
        startOverride={
          activeOutdoorPOIRoute && userLocation ? userLocation : startOverride
        }
        destinationPoint={activeOutdoorPOIRoute ? null : selectedRoute.dest}
        destinationOverride={activeOutdoorPOIDestination}
        showShuttle={showShuttle}
        strategy={selectedStrategy}
        demoCurrentBuilding={demoCurrentBuilding}
        onRouteSteps={handleRouteSteps}
        onBuildingSelected={async (building) => {
          if (!building) return;
          await endTask("task_3", { building_name: building.name });
          startTask("task_4");
          await logUsabilityEvent("building_popup_opened", {
            session_id: sessionId.current,
            building_name: building.name,
            time_since_map_load_ms: Date.now() - mapLoadTime.current,
          });
        }}
        onRouteError={setPOIRouteError}
        onSetAsStart={(building) => {
          setInitialStart(building);
          setIsNavVisible(true);
          logUsabilityEvent("set_as_start_from_popup", {
            session_id: sessionId.current,
            building_name: building?.name ?? "unknown",
          }).catch(console.error);

          endTask("task_4", {
            building_name: building?.name ?? "unknown",
            action: "set_as_start",
          }).catch(console.error);
          startTask("task_5");
        }}
        onSetAsDestination={(building) => {
          setInitialDestination(building);
          setIsNavVisible(true);
          logUsabilityEvent("set_as_destination_from_popup", {
            session_id: sessionId.current,
            building_name: building?.name ?? "unknown",
          }).catch(console.error);
          endTask("task_4", {
            building_name: building?.name ?? "unknown",
            action: "set_as_destination",
          }).catch(console.error);
          startTask("task_5");
        }}
        onSetAsMyLocation={(building) => setDemoCurrentBuilding(building)}
        onViewIndoorMap={handleViewBuildingIndoorMap}
        onUserLocationResolved={setUserLocation}
        nearbyPOIs={nearbyPOIs}
        focusPOIId={focusPOIId}
        focusPOITrigger={focusPOITrigger}
        onSelectPOI={handleSelectOutdoorPOI}
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
          onPress={async () => {
            if (shuttleStatus.available) {
              const newState = !showShuttle;
              setShowShuttle(newState);
              try {
                await logUsabilityEvent("shuttle_stops_toggled", {
                  session_id: sessionId.current,
                  state: newState ? "visible" : "hidden",
                  time_since_map_load_ms: Date.now() - mapLoadTime.current,
                });
              } catch (error) {
                console.error("Firebase Analytics Error: ", error);
              }
            }
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
          onPress={async () => {
            setShowShuttleSchedulePanel(true);
            startTask("task_7");
            await logUsabilityEvent("shuttle_schedule_viewed", {
              session_id: sessionId.current,
              screen: "CampusMapScreen",
              time_since_map_load_ms: Date.now() - mapLoadTime.current,
              timestamp: new Date().toISOString(),
            });
          }}
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
          accessibilityLabel={
            showPOIFilter ? "Hide nearby places" : "Show nearby places"
          }
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
            showPOIFilter && {
              backgroundColor: colors.secondary,
              borderColor: colors.secondaryDark,
            },
          ]}
        >
          <MaterialIcons name="place" size={24} color={colors.white} />
        </Pressable>
        <Pressable
          testID="next-class-button"
          accessibilityLabel="Navigate to next class"
          onPress={async () => {
            setIsNextClassVisible(true);

            startTask("task_8_next_class");
            await logUsabilityEvent("next_class_directions_requested", {
              session_id: sessionId.current,
              screen: "CampusMapScreen",
              has_next_class: nextClass !== null,
              timestamp: new Date().toISOString(),
            });
          }}
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
          onPress={() => {
            openNavigationBar("directions_button");

            startTask("task_5");
          }}
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
          onSelect={handleSelectOutdoorPOI}
          loading={poisLoading}
          error={poisError}
          locationUnavailable={!userLocation}
          onRetry={retryPOISearch}
        />
      )}

      {selectedOutdoorPOI && (
        <View style={styles.selectedPOIPanel}>
          <View style={styles.selectedPOITextWrap}>
            <Text style={styles.selectedPOITitle} numberOfLines={1}>
              {selectedOutdoorPOI.name}
            </Text>
            <Text style={styles.selectedPOISubtitle} numberOfLines={1}>
              {selectedOutdoorPOICategory?.label ?? "Point of interest"}
            </Text>
          </View>
          <View style={styles.selectedPOIActions}>
            <Pressable
              testID="clear-selected-poi-button"
              onPress={clearOutdoorPOIRouteState}
              style={[
                styles.selectedPOIButton,
                styles.selectedPOIButtonSecondary,
              ]}
            >
              <Text
                style={[
                  styles.selectedPOIButtonText,
                  styles.selectedPOIButtonTextSecondary,
                ]}
              >
                Clear
              </Text>
            </Pressable>
            <Pressable
              testID="poi-get-directions-button"
              onPress={startOutdoorPOIRoute}
              style={styles.selectedPOIButton}
            >
              <Text style={styles.selectedPOIButtonText}>Get directions</Text>
            </Pressable>
          </View>
        </View>
      )}

      {poiRouteError && (
        <View style={styles.poiRouteErrorBanner}>
          <Text style={styles.poiRouteErrorText}>{poiRouteError}</Text>
        </View>
      )}

      {showShuttleSchedulePanel && (
        <ShuttleSchedulePanel
          onClose={() => {
            setShowShuttleSchedulePanel(false);
            endTask("task_7");
          }}
        />
      )}

      {showStepsPanel && (
        <DirectionStepsPanel
          steps={routeStepsWithContinueIndoors}
          strategy={selectedStrategy}
          onChangeRoute={() => {
            setInitialStart(selectedRoute.start);
            setInitialDestination(selectedRoute.dest);
            openNavigationBar("change_route").catch(console.error);
            logUsabilityEvent("route_change_requested", {
              session_id: sessionId.current,
              from_start: selectedRoute.start?.name ?? "unknown",
              from_dest: selectedRoute.dest?.name ?? "unknown",
            }).catch(console.error);
          }}
          onDismiss={async () => {
            setSelectedRoute({ start: null, dest: null });
            setActiveOutdoorPOIRoute(null);
            setRouteSteps([]);
            try {
              await logUsabilityEvent("steps_panel_dismissed", {
                session_id: sessionId.current,
              });
            } catch (error) {
              console.error("Firebase Analytics Error: ", error);
            }
            setPOIRouteError(null);
          }}
          onFocusUser={focusUserLocation}
        />
      )}

      <NavigationBar
        visible={isNavVisible}
        onClose={async () => {
          setIsNavVisible(false);
          setInitialStart(null);
          setInitialDestination(null);
          if (navStartTime.current) {
            try {
              await logUsabilityEvent("route_generation_abandoned", {
                session_id: sessionId.current,
                time_spent_ms: Date.now() - navStartTime.current,
                nav_open_count: navOpenCount.current,
              });
            } catch (error) {
              console.error("Firebase Analytics Error: ", error);
            }
            navStartTime.current = null;
          }
        }}
        onConfirm={handleConfirmRoute}
        autoStartBuilding={effectiveCurrentBuilding}
        initialStart={initialStart}
        onInitialStartApplied={() => setInitialStart(null)}
        initialDestination={initialDestination}
        onInitialDestinationApplied={() => setInitialDestination(null)}
        currentCampus={currentCampus}
        onUseMyLocation={() => {
          logUsabilityEvent("nav_used_my_location", {
            session_id: sessionId.current,
            field: "start",
          }).catch(console.error);
          return demoCurrentBuilding ?? autoStartBuilding ?? null;
        }}
        accessibleOnly={accessibleOnly}
        onAccessibleOnlyChange={setAccessibleOnly}
      />

      <NextClassDirectionsPanel
        visible={isNextClassVisible}
        onClose={() => {
          setIsNextClassVisible(false);
          endTask("task_8_next_class", { outcome: "dismissed" }).catch(
            console.error,
          );
        }}
        onConfirm={async (...args) => {
          await endTask("task_8_next_class", { outcome: "confirmed" }).catch(
            console.error,
          );
          handleConfirmRoute(...args);
        }}
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
