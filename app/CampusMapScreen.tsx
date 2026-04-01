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

import {
  USABILITY_TESTING_ENABLED,
  getSessionId,
} from "../constants/usabilityConfig";
import { getDistanceToPolygon } from "../utils/pointInPolygon";

const buildCrossBuildingIndoorParams = ({
  params,
  startRoom,
  startBuilding,
  destBuilding,
  strategy,
  accessible,
  usabilityTaskId,
  usabilityTaskStartedAtMs,
}: {
  params: Record<string, string | undefined>;
  startRoom: IndoorRoomRecord;
  startBuilding: Buildings;
  destBuilding: Buildings;
  strategy?: RouteStrategy;
  accessible: boolean;
  usabilityTaskId?: "task_13" | "task_14";
  usabilityTaskStartedAtMs?: number;
}) => ({
  ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? ""])),
  navOrigin: startRoom.label,
  navDest: startBuilding.name.trim().toUpperCase(),
  outdoorDestBuilding: destBuilding.name.trim().toUpperCase(),
  outdoorStrategy: strategy ? JSON.stringify(strategy) : undefined,
  outdoorAccessibleOnly: accessible ? "true" : "false",
  accessibleOnly: String(accessible),
  ...(usabilityTaskId ? { usabilityTaskId } : {}),
  ...(typeof usabilityTaskStartedAtMs === "number"
    ? { usabilityTaskStartedAtMs: String(usabilityTaskStartedAtMs) }
    : {}),
});

type FocusTarget = CampusKey | "user";

export function toBuildingCode(value: unknown): string | null {
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

export function getCampusByCode(buildingCode: string | null): CampusKey | null {
  if (!buildingCode) return null;
  const found = BUILDINGS.find(
    (b) => b.name.trim().toUpperCase() === buildingCode,
  );
  if (!found?.campusName) return null;
  return found.campusName === "loyola" ? "loyola" : "sgw";
}

export function classifyIndoorOutdoorTask(
  start: unknown,
  dest: unknown,
): "task_13" | "task_14" | null {
  const campusFromValue = (value: unknown): CampusKey | null => {
    const code = toBuildingCode(value);
    const fromCode = getCampusByCode(code);
    if (fromCode) return fromCode;

    if (
      value &&
      typeof value === "object" &&
      "campusName" in value &&
      typeof (value as { campusName?: unknown }).campusName === "string"
    ) {
      const campusName = ((value as { campusName: string }).campusName ?? "")
        .trim()
        .toLowerCase();
      if (campusName === "sgw") return "sgw";
      if (campusName === "loyola") return "loyola";
    }

    return null;
  };

  const startCode = toBuildingCode(start);
  const destCode = toBuildingCode(dest);
  if (!startCode || !destCode || startCode === destCode) return null;

  const startCampus = campusFromValue(start);
  const destCampus = campusFromValue(dest);
  if (!startCampus || !destCampus) return null;

  return startCampus === destCampus ? "task_13" : "task_14";
}

export function parseStartedAtMs(value: unknown): number | null {
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

export function buildRouteConfirmIntent({
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

// Task 15 / 16 sub-step tracking helpers

type Task15Snapshot = {
  startedAtMs: number;
  rangeChangeCount: number;
  categoryToggleCount: number;
  openedListView: boolean;
  tappedMapPin: boolean;
  finalRangeMeters: number;
  resultsCount: number;
};

type Task16Snapshot = {
  startedAtMs: number;
  poiName: string;
  poiCategoryId: string;
  viewedStepsPanel: boolean;
  stepCount: number;
  estimatedDistanceMeters: number;
  outcome: "success" | "change_route" | "dismissed" | "abandoned";
};

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

  // Usability Testing
  const sessionId = useRef(getSessionId());
  const mapLoadTime = useRef<number>(Date.now());
  const taskTimers = useRef<Record<string, number>>({});
  const completedIndoorOutdoorTasks = useRef<Set<string>>(new Set());
  const finalizedIndoorOutdoorTasks = useRef<Set<string>>(new Set());

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

  const task15Snapshot = useRef<Task15Snapshot | null>(null);
  const wasPOIListOpenRef = useRef(false);

  const ensureTask15Started = useCallback(
    (initialRangeMeters: number, initialResultsCount: number) => {
      if (task15Snapshot.current) return; // already running
      task15Snapshot.current = {
        startedAtMs: Date.now(),
        rangeChangeCount: 0,
        categoryToggleCount: 0,
        openedListView: false,
        tappedMapPin: false,
        finalRangeMeters: initialRangeMeters,
        resultsCount: initialResultsCount,
      };
      startTask("task_15");
    },
    [],
  );

  const finalizeTask15 = useCallback(
    async (
      outcome:
        | "poi_selected_from_list"
        | "poi_selected_from_map"
        | "dismissed_without_selection"
        | "filter_closed",
      overrides: Partial<Task15Snapshot> & {
        poi_name?: string;
        poi_category?: string;
      } = {},
    ) => {
      const snap = task15Snapshot.current;
      if (!snap) return;
      task15Snapshot.current = null;

      const duration_ms = Date.now() - snap.startedAtMs;

      delete taskTimers.current["task_15"];

      const payload = {
        session_id: sessionId.current,
        task_id: "task_15",
        duration_ms,
        outcome,
        range_change_count: overrides.rangeChangeCount ?? snap.rangeChangeCount,
        category_toggle_count:
          overrides.categoryToggleCount ?? snap.categoryToggleCount,
        opened_list_view: overrides.openedListView ?? snap.openedListView,
        tapped_map_pin: overrides.tappedMapPin ?? snap.tappedMapPin,
        final_range_meters: overrides.finalRangeMeters ?? snap.finalRangeMeters,
        results_count: overrides.resultsCount ?? snap.resultsCount,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
        ...(overrides.poi_name ? { poi_name: overrides.poi_name } : {}),
        ...(overrides.poi_category
          ? { poi_category: overrides.poi_category }
          : {}),
      };

      await logUsabilityEvent("task_completed", payload);
      await logUsabilityEvent("task_finished", {
        ...payload,
        finished_task_id: "task_15",
      });
      await logUsabilityEvent("task_15_detail", payload);
    },
    [],
  );

  const task16Snapshot = useRef<Task16Snapshot | null>(null);
  const task16EndedRef = useRef(false);

  const ensureTask16Started = useCallback(
    (poiName: string, poiCategoryId: string) => {
      if (task16Snapshot.current) return;
      task16Snapshot.current = {
        startedAtMs: Date.now(),
        poiName,
        poiCategoryId,
        viewedStepsPanel: false,
        stepCount: 0,
        estimatedDistanceMeters: 0,
        outcome: "abandoned",
      };
      task16EndedRef.current = false;
      startTask("task_16");
    },
    [],
  );

  const finalizeTask16 = useCallback(
    async (
      outcome: Task16Snapshot["outcome"],
      overrides: Partial<Task16Snapshot> = {},
    ) => {
      if (task16EndedRef.current) return;
      const snap = task16Snapshot.current;
      if (!snap) return;

      task16EndedRef.current = true;
      task16Snapshot.current = null;
      delete taskTimers.current["task_16"];

      const duration_ms = Date.now() - snap.startedAtMs;

      const payload = {
        session_id: sessionId.current,
        task_id: "task_16",
        duration_ms,
        outcome,
        poi_name: overrides.poiName ?? snap.poiName,
        poi_category_id: overrides.poiCategoryId ?? snap.poiCategoryId,
        viewed_steps_panel: overrides.viewedStepsPanel ?? snap.viewedStepsPanel,
        step_count: overrides.stepCount ?? snap.stepCount,
        estimated_distance_meters:
          overrides.estimatedDistanceMeters ?? snap.estimatedDistanceMeters,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      };

      await logUsabilityEvent("task_completed", payload);
      await logUsabilityEvent("task_finished", {
        ...payload,
        finished_task_id: "task_16",
      });
      await logUsabilityEvent("task_16_detail", payload);
    },
    [],
  );

  const syncNearbyPOIs = useCallback(() => {
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
    activePOICategories,
    clearPOIs,
    poiRange.meters,
    poiSearchLocation,
    searchPOIs,
    showPOIFilter,
  ]);

  useEffect(() => {
    syncNearbyPOIs();
  }, [syncNearbyPOIs]);

  const retryPOISearch = useCallback(() => {
    syncNearbyPOIs();
  }, [syncNearbyPOIs]);

  useEffect(() => {
    if (!showPOIList) {
      wasPOIListOpenRef.current = false;
      return;
    }

    if (wasPOIListOpenRef.current || !task15Snapshot.current) return;

    wasPOIListOpenRef.current = true;
    task15Snapshot.current.openedListView = true;
    logUsabilityEvent("task_15_list_opened", {
      session_id: sessionId.current,
      results_count: nearbyPOIs.length,
      active_categories: Array.from(activePOICategories).join(","),
      range_meters: poiRange.meters,
      time_since_map_load_ms: Date.now() - mapLoadTime.current,
    }).catch(console.error);
  }, [showPOIList, activePOICategories, nearbyPOIs.length, poiRange.meters]);

  const handleTogglePOICategory = useCallback(
    (id: OutdoorPOICategoryId) => {
      setActivePOICategories((prev) => {
        const next = new Set(prev);
        const isFirstCategory = prev.size === 0 && !prev.has(id);

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
          if (isFirstCategory) {
            ensureTask15Started(poiRange.meters, nearbyPOIs.length);
          }
        }

        if (task15Snapshot.current) {
          task15Snapshot.current.categoryToggleCount += 1;
        }

        return next;
      });
    },
    [ensureTask15Started, nearbyPOIs.length, poiRange.meters],
  );

  const navStartTime = useRef<number | null>(null);
  const navOpenCount = useRef<number>(0);

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
    setAccessibleOnly(Boolean(transitionPayload.accessibleOnly));
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
  }, [campus, findNearestBuilding]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!shuttleStatus.available && showShuttle) setShowShuttle(false);
  }, [shuttleStatus.available, showShuttle]);

  const selectCampus = async (campusKey: CampusKey) => {
    setCurrentCampus(campusKey);
    setFocusTarget(campusKey);

    if (task15Snapshot.current) {
      await finalizeTask15("filter_closed", {
        resultsCount: nearbyPOIs.length,
        finalRangeMeters: poiRange.meters,
      });
    }
    if (task16Snapshot.current && !task16EndedRef.current) {
      await finalizeTask16("abandoned");
    }

    try {
      await logUsabilityEvent("campus_switch", {
        session_id: sessionId.current,
        campus_name: campusKey,
        screen: "CampusMapScreen",
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
        timestamp: new Date().toISOString(),
      });
      await endTask("task_2", { campus_switched_to: campusKey });
    } catch (error) {
      console.error("Firebase Analytics Error: ", error);
    }
  };

  const handlePOIRangeChange = useCallback(
    async (option: POIRangeOption) => {
      const previousMeters = poiRange.meters;
      setPOIRange(option);

      ensureTask15Started(option.meters, nearbyPOIs.length);

      if (task15Snapshot.current) {
        task15Snapshot.current.rangeChangeCount += 1;
        task15Snapshot.current.finalRangeMeters = option.meters;
      }

      await logUsabilityEvent("task_15_range_changed", {
        session_id: sessionId.current,
        previous_range_meters: previousMeters,
        new_range_meters: option.meters,
        active_categories: Array.from(activePOICategories).join(","),
        results_count: nearbyPOIs.length,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
    },
    [
      activePOICategories,
      ensureTask15Started,
      nearbyPOIs.length,
      poiRange.meters,
    ],
  );

  const handleSelectOutdoorPOI = useCallback(
    async (poi: PlacePOI, source: "list" | "map" = "map") => {
      setSelectedOutdoorPOI(poi);
      setPOIRouteError(null);
      setFocusPOIId(poi.placeId);
      setFocusPOITrigger((c) => c + 1);
      setShowPOIList(false);

      if (task15Snapshot.current) {
        if (source === "map") task15Snapshot.current.tappedMapPin = true;
      }

      const poiCategory = OUTDOOR_POI_CATEGORY_MAP[poi.categoryId];
      await finalizeTask15(
        source === "list" ? "poi_selected_from_list" : "poi_selected_from_map",
        {
          resultsCount: nearbyPOIs.length,
          finalRangeMeters: poiRange.meters,
          poi_name: poi.name,
          poi_category: poiCategory?.id ?? poi.categoryId ?? "unknown",
        },
      );

      await logUsabilityEvent("task_15_poi_detail_viewed", {
        session_id: sessionId.current,
        poi_name: poi.name,
        poi_category: poiCategory?.id ?? poi.categoryId ?? "unknown",
        source,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });

      setActiveOutdoorPOIRoute((previousRoutePOI) => {
        if (!previousRoutePOI || previousRoutePOI.placeId === poi.placeId)
          return previousRoutePOI;
        setRouteFocusTrigger((c) => c + 1);
        return poi;
      });
    },
    [finalizeTask15, nearbyPOIs.length, poiRange.meters],
  );

  const handleSelectOutdoorPOIFromMap = useCallback(
    (poi: PlacePOI) => handleSelectOutdoorPOI(poi, "map"),
    [handleSelectOutdoorPOI],
  );

  const clearOutdoorPOIRouteState = useCallback(async () => {
    if (task16Snapshot.current && !task16EndedRef.current) {
      await finalizeTask16("dismissed", {
        poiName: selectedOutdoorPOI?.name ?? "unknown",
      });
    }

    setSelectedOutdoorPOI(null);
    setActiveOutdoorPOIRoute(null);
    setPOIRouteError(null);
    setRouteSteps([]);
  }, [finalizeTask16, selectedOutdoorPOI]);

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

        const indoorOutdoorTaskId = classifyIndoorOutdoorTask(
          intent.startBuilding,
          intent.destBuilding,
        );
        const taskStartedAtMs = indoorOutdoorTaskId ? Date.now() : undefined;
        const startCode = toBuildingCode(intent.startBuilding);
        const destCode = toBuildingCode(intent.destBuilding);

        if (indoorOutdoorTaskId) {
          completedIndoorOutdoorTasks.current.delete(indoorOutdoorTaskId);
          finalizedIndoorOutdoorTasks.current.delete(indoorOutdoorTaskId);
          startTask(indoorOutdoorTaskId);
          try {
            await logUsabilityEvent("indoor_outdoor_route_requested", {
              session_id: sessionId.current,
              task_id: indoorOutdoorTaskId,
              start_building_code: startCode ?? "unknown",
              destination_building_code: destCode ?? "unknown",
              same_campus: indoorOutdoorTaskId === "task_13",
              cross_campus: indoorOutdoorTaskId === "task_14",
              travel_mode: intent.strategy.mode,
              time_since_map_load_ms: Date.now() - mapLoadTime.current,
            });
          } catch (error) {
            console.error("Firebase Analytics Error: ", error);
          }
        }

        router.push({
          pathname: "/IndoorMapScreen",
          params: buildCrossBuildingIndoorParams({
            params,
            startRoom: intent.startRoom,
            startBuilding: intent.startBuilding,
            destBuilding: intent.destBuilding,
            strategy: intent.strategy,
            accessible: intent.accessibleOnly,
            usabilityTaskId: indoorOutdoorTaskId ?? undefined,
            usabilityTaskStartedAtMs: taskStartedAtMs,
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
        finalizedIndoorOutdoorTasks.current.delete(indoorOutdoorTaskId);
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

        await endTask("task_5", {
          start_location: start?.name ?? "My Location",
          dest_location: dest?.name ?? "Unknown",
          travel_mode: strategy.mode,
        });

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

  const resolveActiveIndoorOutdoorTaskContext = useCallback(
    (destinationOverride?: string) => {
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
      const taskId = payloadTaskId ?? fallbackTaskId;
      if (!taskId) return null;

      const payloadStartedAtMs =
        transitionPayload?.mode === "indoor_to_outdoor"
          ? parseStartedAtMs(transitionPayload.usabilityTaskStartedAtMs)
          : null;
      const timerStartedAtMs = taskTimers.current[taskId] ?? null;

      return {
        taskId,
        startedAtMs: payloadStartedAtMs ?? timerStartedAtMs,
        startCode: toBuildingCode(selectedRoute.start) ?? "unknown",
        destinationCode:
          destinationOverride ??
          toBuildingCode(selectedRoute.dest) ??
          "unknown",
      };
    },
    [selectedRoute.dest, selectedRoute.start, transitionPayload],
  );

  const finalizeActiveIndoorOutdoorTask = useCallback(
    (destinationOverride?: string) => {
      const context =
        resolveActiveIndoorOutdoorTaskContext(destinationOverride);
      if (!context) return;
      if (finalizedIndoorOutdoorTasks.current.has(context.taskId)) return;

      finalizedIndoorOutdoorTasks.current.add(context.taskId);
      finalizeIndoorOutdoorTask(
        context.taskId,
        context.startCode,
        context.destinationCode,
        context.startedAtMs,
      );
    },
    [finalizeIndoorOutdoorTask, resolveActiveIndoorOutdoorTaskContext],
  );

  const handleRouteSteps = useCallback(
    async (steps: RouteStep[]) => {
      setRouteSteps(steps);

      // Task 16: route + steps panel appeared
      if (steps.length > 0 && activeOutdoorPOIRoute && task16Snapshot.current) {
        const estimatedDistance = steps.length * 40;
        task16Snapshot.current.viewedStepsPanel = true;
        task16Snapshot.current.stepCount = steps.length;
        task16Snapshot.current.estimatedDistanceMeters = estimatedDistance;

        // Sub-step: steps panel became visible
        await logUsabilityEvent("task_16_steps_panel_viewed", {
          session_id: sessionId.current,
          poi_name: activeOutdoorPOIRoute.name,
          poi_category_id: activeOutdoorPOIRoute.categoryId ?? "unknown",
          step_count: steps.length,
          estimated_distance_meters: estimatedDistance,
          time_since_map_load_ms: Date.now() - mapLoadTime.current,
        });

        // Mark Task 16 as successfully completed once route details are visible.
        await finalizeTask16("success", {
          poiName: activeOutdoorPOIRoute.name,
          poiCategoryId: activeOutdoorPOIRoute.categoryId ?? "unknown",
          viewedStepsPanel: true,
          stepCount: steps.length,
          estimatedDistanceMeters: estimatedDistance,
          outcome: "success",
        });
      }

      // Task 6
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
    },
    [activeOutdoorPOIRoute, finalizeTask16],
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

    const steps: InteractiveRouteStep[] = [...built.steps];
    const lastIndex = steps.length - 1;
    if (lastIndex >= 0) {
      steps[lastIndex] = {
        ...steps[lastIndex],
        onPress: () => {
          finalizeActiveIndoorOutdoorTask(built.openArgs.buildingCode);

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
    finalizeActiveIndoorOutdoorTask,
    openIndoorMap,
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

  const startOutdoorPOIRoute = useCallback(async () => {
    if (!selectedOutdoorPOI) return;

    // Task 16: user tapped "Get directions"
    ensureTask16Started(
      selectedOutdoorPOI.name,
      selectedOutdoorPOI.categoryId ?? "unknown",
    );

    // Sub-step: "Get directions" button tapped
    await logUsabilityEvent("task_16_get_directions_tapped", {
      session_id: sessionId.current,
      poi_name: selectedOutdoorPOI.name,
      poi_category_id: selectedOutdoorPOI.categoryId ?? "unknown",
      time_since_map_load_ms: Date.now() - mapLoadTime.current,
    });

    const routeStart = userLocation
      ? findNearestBuilding(userLocation.latitude, userLocation.longitude)
      : effectiveCurrentBuilding;

    if (!routeStart) {
      setPOIRouteError(
        "Unable to resolve a starting location. Enable location services or set your location on the map.",
      );
      // Task 16 failed immediately — no starting location
      await finalizeTask16("abandoned", {
        poiName: selectedOutdoorPOI.name,
        poiCategoryId: selectedOutdoorPOI.categoryId ?? "unknown",
      });
      await logUsabilityEvent("task_16_error", {
        session_id: sessionId.current,
        poi_name: selectedOutdoorPOI.name,
        error_reason: "no_starting_location",
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
      return;
    }

    setPOIRouteError(null);
    setActiveOutdoorPOIRoute(selectedOutdoorPOI);
    setSelectedRoute({ start: routeStart, dest: null });
    setRouteFocusTrigger((c) => c + 1);
  }, [
    effectiveCurrentBuilding,
    ensureTask16Started,
    finalizeTask16,
    findNearestBuilding,
    selectedOutdoorPOI,
    userLocation,
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
        // Use the map-source wrapper so tapping a map pin is correctly attributed
        onSelectPOI={handleSelectOutdoorPOIFromMap}
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

      {showPOIFilter && (
        <View style={styles.poiPanel}>
          <OutdoorPOIFilter
            activeCategories={activePOICategories}
            onToggle={handleTogglePOICategory}
          />
          {/*
           * Route the range selector through handlePOIRangeChange so every
           * range adjustment is captured in the Task 15 snapshot.
           */}
          <POIRangeSelector
            selected={poiRange}
            onSelect={handlePOIRangeChange}
          />
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
          onPress={async () => {
            setShowPOIFilter((v) => {
              const closing = v; // if currently open, we are closing it
              if (closing) {
                clearPOIs();
                setShowPOIList(false);
                setActivePOICategories(new Set());

                // Finalize Task 15 when the filter panel is closed without
                // selecting a POI — fire async outside the setState callback.
                if (task15Snapshot.current) {
                  finalizeTask15("filter_closed", {
                    resultsCount: nearbyPOIs.length,
                    finalRangeMeters: poiRange.meters,
                    openedListView: task15Snapshot.current.openedListView,
                  }).catch(console.error);
                }
              } else {
                logUsabilityEvent("task_15_filter_opened", {
                  session_id: sessionId.current,
                  time_since_map_load_ms: Date.now() - mapLoadTime.current,
                }).catch(console.error);
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
          onClose={() => {
            setShowPOIList(false);
            // Sub-step: user closed the list panel without selecting
            if (task15Snapshot.current) {
              logUsabilityEvent("task_15_list_closed_without_selection", {
                session_id: sessionId.current,
                results_shown: nearbyPOIs.length,
                time_since_map_load_ms: Date.now() - mapLoadTime.current,
              }).catch(console.error);
            }
          }}
          onSelect={(poi) => handleSelectOutdoorPOI(poi, "list")}
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
          onChangeRoute={async () => {
            //  Task 16: user tapped "Change route"
            if (task16Snapshot.current && !task16EndedRef.current) {
              await logUsabilityEvent("task_16_change_route_tapped", {
                session_id: sessionId.current,
                poi_name: task16Snapshot.current.poiName,
                poi_category_id: task16Snapshot.current.poiCategoryId,
                step_count: task16Snapshot.current.stepCount,
                viewed_steps_panel: task16Snapshot.current.viewedStepsPanel,
                time_since_map_load_ms: Date.now() - mapLoadTime.current,
              });
              await finalizeTask16("change_route");
            }

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
            finalizeActiveIndoorOutdoorTask();

            // ── Task 16: user dismissed the steps panel ───────────────────
            if (task16Snapshot.current && !task16EndedRef.current) {
              await finalizeTask16("dismissed", {
                poiName:
                  selectedOutdoorPOI?.name ?? task16Snapshot.current.poiName,
              });
            }

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
        accessibleOnly={accessibleOnly}
        onAccessibleOnlyChange={setAccessibleOnly}
      />
    </View>
  );
}
