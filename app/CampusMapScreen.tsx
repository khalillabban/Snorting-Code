import { logUsabilityEvent } from "@/utils/usabilityAnalytics";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import { DirectionStepsPanel } from "../components/DirectionStepsPanel";
import NavigationBar from "../components/NavigationBar";
import NextClassDirectionsPanel from "../components/NextClassDirectionsPanel";
import { ShuttleSchedulePanel } from "../components/ShuttleSchedulePanel";
import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { CAMPUSES } from "../constants/campuses";
import { WALKING_STRATEGY } from "../constants/strategies";
import { colors, spacing } from "../constants/theme";
import { Buildings, RouteStep, ScheduleItem } from "../constants/type";
import { USABILITY_TESTING_ENABLED } from "../constants/usabilityConfig";
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
import { getDistanceToPolygon } from "../utils/pointInPolygon";
import {
  parseTransitionPayload,
  serializeTransitionPayload,
} from "../utils/routeTransition";

type FocusTarget = CampusKey | "user";

function normalizeRoomQuery(buildingCode: string, room: string): string {
  const trimmed = room.trim();
  if (!trimmed) return "";
  const prefix = `${buildingCode.toUpperCase()}-`;
  if (trimmed.toUpperCase().startsWith(prefix)) return trimmed;
  return `${prefix}${trimmed}`;
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
    () =>
      parseTransitionPayload(
        typeof transition === "string" ? transition : undefined,
      ),
    [transition],
  );

  // If the user planned a cross-building trip with indoor rooms at both ends from the
  // navigation drawer, immediately jump into the origin building's indoor navigation.
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
        floors: "1", // IndoorMapScreen will normalize if the building has different floors.
        navOrigin: transitionPayload.originIndoorRoomQuery,
        // We set navDest to the destination building code to force the origin-building
        // indoor leg to route to a good exit. (IndoorMapScreen will *not* do cross-building
        // room navigation.)
        navDest: destCode,
        outdoorDestBuilding: destCode,
        outdoorStrategy: transitionPayload.strategy
          ? JSON.stringify(transitionPayload.strategy)
          : undefined,
        outdoorAccessibleOnly: transitionPayload.accessibleOnly
          ? "true"
          : "false",
        // Carry the final indoor query for later (CampusMapScreen will use it to offer
        // a "Continue indoors" option near the destination building).
        destinationRoomQuery: transitionPayload.destinationIndoorRoomQuery,
        accessibleOnly: String(Boolean(transitionPayload.accessibleOnly)),
      },
    });
  }, [transitionPayload]);

  //  Usability Testing: Session + Task timers
  const sessionId = useRef(`session_${Date.now()}_${Crypto.randomUUID()}`);
  const mapLoadTime = useRef<number>(Date.now());
  const taskTimers = useRef<Record<string, number>>({});

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
    const duration_ms = start ? Date.now() - start : 0;
    delete taskTimers.current[taskId];

    await logUsabilityEvent("task_completed", {
      session_id: sessionId.current,
      task_id: taskId,
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
  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);

  // Usability Testing: Nav bar timing (Task 5)
  const navStartTime = useRef<number | null>(null);
  const navOpenCount = useRef<number>(0);

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

    if (navOpenCount.current === 1) {
      startTask("task_5");
    }
  };

  // Next class state
  const destinationRoomQueryText = useMemo(() => {
    if (
      typeof destinationRoomQuery === "string" &&
      destinationRoomQuery.trim()
    ) {
      return destinationRoomQuery;
    }
    // If we arrived via a transition payload (ex: indoor_to_outdoor), prefer the payload field.
    if (
      transitionPayload?.mode === "indoor_to_outdoor" &&
      typeof transitionPayload.destinationIndoorRoomQuery === "string"
    ) {
      return transitionPayload.destinationIndoorRoomQuery;
    }
    return "";
  }, [destinationRoomQuery, transitionPayload]);

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

    // Force the campus toggle to the destination campus so the user sees the correct map.
    const destCampus =
      destBuilding.campusName === "loyola"
        ? ("loyola" as const)
        : ("sgw" as const);
    setCurrentCampus(destCampus);
    setFocusTarget((prev) => (prev === "user" ? prev : destCampus));

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

  useEffect(() => {
    mapLoadTime.current = Date.now();
    startTask("task_1");
    const run = async () => {
      await logUsabilityEvent("map_screen_loaded", {
        session_id: sessionId.current,
        campus: campus ?? "sgw",
        timestamp: new Date().toISOString(),
      });
    };
    run();
  }, []);

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
      await endTask("task_2", { campus_switched_to: campusKey });
      console.log(`Firebase: Logged switch to ${campusKey} (Modular API)`);
    } catch (error) {
      console.error("Firebase Analytics Error: ", error);
    }
  };

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
          ...(navDest ? { navDest } : {}),
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

      type CrossBuildingIndoorTransition = {
        mode: "cross_building_indoor";
        originBuildingCode: string;
        originIndoorRoomQuery: string;
        destinationBuildingCode: string;
        destinationIndoorRoomQuery: string;
        strategy: RouteStrategy;
        accessibleOnly: boolean;
      };

      // Cross-building indoor-to-indoor trip (Option A): plan it from Campus Map.
      // When both endpoints are rooms but buildings differ, we kick off the origin indoor leg.
      if (
        start?.name &&
        dest?.name &&
        startRoom &&
        endRoom &&
        start.name !== dest.name
      ) {
        const originBuildingCode = start.name.trim().toUpperCase();
        const destinationBuildingCode = dest.name.trim().toUpperCase();
        const payload: CrossBuildingIndoorTransition = {
          mode: "cross_building_indoor",
          originBuildingCode,
          originIndoorRoomQuery: startRoom.label,
          destinationBuildingCode,
          destinationIndoorRoomQuery: endRoom.label,
          strategy,
          accessibleOnly: !!accessible,
        };

        router.push({
          pathname: "/CampusMapScreen",
          params: {
            campus: (start.campusName ?? "sgw") as CampusKey,
            transition: serializeTransitionPayload(payload),
          },
        });
        return;
      }

      if (
        start?.name &&
        dest?.name &&
        start.name === dest.name &&
        startRoom &&
        endRoom
      ) {
        setIsNavVisible(false);
        openIndoorMap(
          start.name,
          undefined,
          startRoom.label,
          endRoom.label,
          accessible,
        );
        return;
      }

      if (start?.name && dest?.name && start.name === dest.name && endRoom) {
        setIsNavVisible(false);
        openIndoorMap(
          dest.name,
          endRoom.label,
          undefined,
          undefined,
          accessible,
        );
        return;
      }

      setSelectedRoute({ start, dest });
      setSelectedStrategy(strategy);
      setIsNavVisible(false);
      setRouteFocusTrigger((c) => (start ? c + 1 : c));

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

  // Shuttle
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
  const showStepsPanel =
    hasActiveRoute && (mergedSteps?.length || routeSteps.length) > 0;

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

  const canContinueIndoors = Boolean(continueIndoorsBuildingCode);

  const nextClassIndoorAccess = useMemo(
    () => getIndoorAccessState(nextClass?.building),
    [nextClass?.building],
  );
  const canOpenNextClassIndoorMap = Boolean(
    nextClassIndoorAccess.hasSearchableRooms && nextClass?.room.trim(),
  );
  const handleRouteSteps = useCallback(async (steps: RouteStep[]) => {
    setRouteSteps(steps);
    console.log("[Task 6] steps_panel_viewed — step_count:", steps.length);

    if (steps.length > 0) {
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
  }, [
    mergedSteps,
    routeSteps,
    canContinueIndoors,
    continueIndoorsBuildingCode,
    destinationRoomQueryText,
    openIndoorMap,
  ]);

  // Render

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
        onRouteSteps={handleRouteSteps}
        onSetAsStart={(building) => {
          setInitialStart(building);
          setIsNavVisible(true);
          console.log(
            "[Task 4] set_as_start pressed — building:",
            building?.name,
          );
          logUsabilityEvent("set_as_start_from_popup", {
            session_id: sessionId.current,
            building_name: building?.name ?? "unknown",
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
        }}
        onSetAsMyLocation={(building) => setDemoCurrentBuilding(building)}
        onViewIndoorMap={handleViewBuildingIndoorMap}
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
          testID="next-class-button"
          accessibilityLabel="Navigate to next class"
          onPress={async () => {
            setIsNextClassVisible(true);
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

            openNavigationBar("change_route").catch((error) => {
              console.error("Firebase Analytics Error: ", error);
            });
            logUsabilityEvent("route_change_requested", {
              session_id: sessionId.current,
              from_start: selectedRoute.start?.name ?? "unknown",
              from_dest: selectedRoute.dest?.name ?? "unknown",
            }).catch((error) => {
              console.error("Firebase Analytics Error: ", error);
            });
          }}
          onDismiss={async () => {
            setSelectedRoute({ start: null, dest: null });
            setRouteSteps([]);

            try {
              await logUsabilityEvent("steps_panel_dismissed", {
                session_id: sessionId.current,
              });
            } catch (error) {
              console.error("Firebase Analytics Error: ", error);
            }
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
        autoStartBuilding={demoCurrentBuilding ?? autoStartBuilding}
        initialStart={initialStart}
        onInitialStartApplied={() => setInitialStart(null)}
        initialDestination={initialDestination}
        onInitialDestinationApplied={() => setInitialDestination(null)}
        currentCampus={currentCampus}
        onUseMyLocation={() => {
          logUsabilityEvent("nav_used_my_location", {
            session_id: sessionId.current,
            field: "start",
          }).catch((error) => {
            console.error("Firebase Analytics Error: ", error);
          });
          return demoCurrentBuilding ?? autoStartBuilding ?? null;
        }}
        accessibleOnly={accessibleOnly}
        onAccessibleOnlyChange={setAccessibleOnly}
      />

      <NextClassDirectionsPanel
        visible={isNextClassVisible}
        onClose={() => setIsNextClassVisible(false)}
        onConfirm={handleConfirmRoute}
        nextClass={nextClass}
        scheduleItems={scheduleItems}
        autoStartBuilding={demoCurrentBuilding ?? autoStartBuilding}
        currentCampus={currentCampus}
        onUseMyLocation={() => demoCurrentBuilding ?? autoStartBuilding ?? null}
        canOpenIndoorMap={canOpenNextClassIndoorMap}
        onOpenIndoorMap={handleOpenNextClassIndoorMap}
      />
    </View>
  );
}
