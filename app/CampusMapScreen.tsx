import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { getAnalytics, logEvent } from "@react-native-firebase/analytics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import { DirectionStepsPanel } from "../components/DirectionStepsPanel";
import NavigationBar from "../components/NavigationBar";
import NextClassDirectionsPanel from "../components/NextClassDirectionsPanel";
import { ShuttleSchedulePanel } from "../components/ShuttleSchedulePanel";
import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { CAMPUSES } from "../constants/campuses";
import { WALKING_STRATEGY } from "../constants/strategies";
import { colors, spacing, typography } from "../constants/theme";
import { Buildings, RouteStep, ScheduleItem } from "../constants/type";
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import { RouteStrategy } from "../services/Routing";
import {
  getNextClassFromItems,
  loadCachedSchedule,
} from "../utils/parseCourseEvents";
import { getDistanceToPolygon } from "../utils/pointInPolygon";

type FocusTarget = CampusKey | "user";

export default function CampusMapScreen() {
  const { campus } = useLocalSearchParams<{ campus?: CampusKey }>();

  // ─── Usability Testing: Session + Task timers ────────────────────────────
  // A unique session ID tags every event so you can reconstruct per-participant
  // journeys in BigQuery with: WHERE session_id = 'session_P01_...'
  const sessionId = useRef(
    `session_${Date.now()}_${Math.random().toString(36).slice(2)}`,
  );
  const mapLoadTime = useRef<number>(Date.now());
  const taskTimers = useRef<Record<string, number>>({});

  const startTask = (taskId: string) => {
    taskTimers.current[taskId] = Date.now();
  };
  const endTask = async (
    taskId: string,
    extraParams: Record<string, unknown> = {},
  ) => {
    const start = taskTimers.current[taskId];
    const duration_ms = start ? Date.now() - start : 0;
    delete taskTimers.current[taskId];
    try {
      await logEvent(getAnalytics(), "task_completed", {
        session_id: sessionId.current,
        task_id: taskId,
        duration_ms,
        ...extraParams,
      });
    } catch (e) {}
  };
  // ─────────────────────────────────────────────────────────────────────────

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
  const [selectedBuildingWithMap, setSelectedBuildingWithMap] =
    useState<Buildings | null>(null);
  const [indoorAvailableFloors, setIndoorAvailableFloors] = useState<number[]>(
    [],
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

  // ─── Usability Testing: Nav bar timing (Task 5) ──────────────────────────
  const navStartTime = useRef<number | null>(null);
  const navOpenCount = useRef<number>(0);

  const openNavigationBar = (trigger: string = "directions_button") => {
    navStartTime.current = Date.now();
    navOpenCount.current += 1;
    setIsNavVisible(true);
    // Task 5 starts: log trigger source and how many times user has opened this
    try {
      logEvent(getAnalytics(), "nav_bar_opened", {
        session_id: sessionId.current,
        trigger,
        open_count: navOpenCount.current,
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
    } catch (e) {}
    if (navOpenCount.current === 1) {
      startTask("task_5");
    }
  };

  // Next class state
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

      // ── Task 1: Log that we detected user's building on load ──────────────
      try {
        logEvent(getAnalytics(), "user_building_detected", {
          session_id: sessionId.current,
          building_name: building?.name ?? "unknown",
          time_since_map_load_ms: Date.now() - mapLoadTime.current,
        });
      } catch (e) {}
      // ─────────────────────────────────────────────────────────────────────
    };
    getUserBuilding();
  }, [findNearestBuilding]);

  // ── Task 1: Log map screen loaded ────────────────────────────────────────
  useEffect(() => {
    mapLoadTime.current = Date.now();
    startTask("task_1");
    try {
      logEvent(getAnalytics(), "map_screen_loaded", {
        session_id: sessionId.current,
        campus: campus ?? "sgw",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {}
  }, []);

  const selectCampus = async (campusKey: CampusKey) => {
    setCurrentCampus(campusKey);
    setFocusTarget(campusKey);

    // ── Task 2: Campus toggle ─────────────────────────────────────────────
    try {
      const analyticsInstance = getAnalytics();
      await logEvent(analyticsInstance, "campus_switch", {
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
    // ─────────────────────────────────────────────────────────────────────
  };

  const focusUserLocation = useCallback(() => {
    setFocusTarget("user");
    setUserFocusCounter((c) => c + 1);

    // ── Task 1: Current location button tapped ───────────────────────────
    try {
      logEvent(getAnalytics(), "current_location_pressed", {
        session_id: sessionId.current,
        screen: "CampusMapScreen",
        time_since_map_load_ms: Date.now() - mapLoadTime.current,
      });
      endTask("task_1");
    } catch (error) {
      console.error("Firebase Analytics Error: ", error);
    }
  }, []);
  const handleConfirmRoute = useCallback(
    (
      start: Buildings | null,
      dest: Buildings | null,
      strategy: RouteStrategy,
    ) => {
      setSelectedRoute({ start, dest });
      setSelectedStrategy(strategy);
      setIsNavVisible(false);
      if (start) {
        setRouteFocusTrigger((c) => c + 1);
      }

      // ── Task 5 + Task 6: Route generated ─────────────────────────────────
      try {
        const timeSpent = navStartTime.current
          ? Date.now() - navStartTime.current
          : 0;
        logEvent(getAnalytics(), "route_generated", {
          session_id: sessionId.current,
          start_location: start?.name ?? "My Location",
          dest_location: dest?.name ?? "Unknown",
          travel_mode: strategy.mode,
          time_spent_ms: timeSpent,
          nav_open_count: navOpenCount.current,
        });
        navStartTime.current = null;
        endTask("task_5", {
          start_location: start?.name ?? "My Location",
          dest_location: dest?.name ?? "Unknown",
          travel_mode: strategy.mode,
        });
        startTask("task_6");
      } catch (error) {
        console.error("Firebase Analytics Error: ", error);
      }
    },
    [],
  );

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
    if (!shuttleStatus.available && showShuttle) {
      setShowShuttle(false);
    }
  }, [shuttleStatus.available, showShuttle]);

  const hasActiveRoute =
    selectedRoute.start != null && selectedRoute.dest != null;
  const showStepsPanel = hasActiveRoute && routeSteps.length > 0;

  const handleRouteSteps = useCallback((steps: RouteStep[]) => {
    setRouteSteps(steps);
    if (steps.length > 0) {
      try {
        logEvent(getAnalytics(), "steps_panel_viewed", {
          session_id: sessionId.current,
          step_count: steps.length,
        });
        endTask("task_6", { step_count: steps.length });
      } catch (e) {}
    }
  }, []);

  const handleSetAsStart = useCallback((building: Buildings) => {
    setInitialStart(building);
    openNavigationBar("set_as_start");
  }, []);

  const handleSetAsDestination = useCallback((building: Buildings) => {
    setInitialDestination(building);
    openNavigationBar("set_as_destination");
    try {
      logEvent(getAnalytics(), "set_as_destination_from_popup", {
        session_id: sessionId.current,
        building_name: building?.name ?? "unknown",
      });
      endTask("task_4", {
        building_name: building?.name ?? "unknown",
        action: "set_as_destination",
      });
    } catch (e) {}
  }, []);

  const handleSetAsMyLocation = useCallback((building: Buildings) => {
    setDemoCurrentBuilding(building);
  }, []);

  const handleBuildingSelected = useCallback(
    (building: Buildings | null, hasMap: boolean) => {
      setSelectedBuildingWithMap(hasMap ? building : null);
      if (building) {
        try {
          logEvent(getAnalytics(), "building_info_viewed", {
            session_id: sessionId.current,
            building_name: building.name,
            campus: building.campusName,
            has_indoor_map: hasMap,
            time_since_map_load_ms: Date.now() - mapLoadTime.current,
          });
          endTask("task_3", { building_name: building.name });
          startTask("task_4");
        } catch (e) {}
      }
    },
    [],
  );

  const handleIndoorFloorsAvailable = useCallback((floors: number[]) => {
    setIndoorAvailableFloors(floors);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <CampusMap
        coordinates={CAMPUSES[currentCampus].coordinates}
        focusTarget={focusTarget}
        userFocusCounter={userFocusCounter}
        routeFocusTrigger={routeFocusTrigger}
        startPoint={selectedRoute.start}
        destinationPoint={selectedRoute.dest}
        showShuttle={showShuttle}
        strategy={selectedStrategy}
        demoCurrentBuilding={demoCurrentBuilding}
        onRouteSteps={handleRouteSteps}
        onSetAsStart={handleSetAsStart}
        onSetAsDestination={handleSetAsDestination}
        onSetAsMyLocation={handleSetAsMyLocation}
        onBuildingSelected={handleBuildingSelected}
        onIndoorFloorsAvailable={handleIndoorFloorsAvailable}
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

      {selectedBuildingWithMap && (
        <Pressable
          onPress={() => {
            // ── Task 4: User navigated to indoor map from popup ──────────
            try {
              logEvent(getAnalytics(), "indoor_map_opened", {
                session_id: sessionId.current,
                building_name: selectedBuildingWithMap.name,
              });
              endTask("task_4", {
                building_name: selectedBuildingWithMap.name,
                action: "opened_indoor_map",
              });
            } catch (e) {}
            router.push({
              pathname: "/IndoorMapScreen",
              params: {
                buildingName: selectedBuildingWithMap.name,
                floors: JSON.stringify(indoorAvailableFloors),
              },
            });
          }}
          testID="indoor-view-toggle"
          style={styles.indoorButton}
        >
          <Text style={styles.indoorButtonText}>Indoor</Text>
        </Pressable>
      )}

      {/* Left button stack: shuttle status + shuttle schedule */}
      <View
        style={[styles.buttonStack, { left: spacing.md, right: undefined }]}
      >
        <Pressable
          testID="show-shuttle-button"
          onPress={() => {
            if (shuttleStatus.available) {
              const newState = !showShuttle;
              setShowShuttle(newState);

              // ── Task 7: Bus stops button toggled ────────────────────────

              try {
                logEvent(getAnalytics(), "shuttle_stops_toggled", {
                  session_id: sessionId.current,
                  state: newState ? "visible" : "hidden",
                  time_since_map_load_ms: Date.now() - mapLoadTime.current,
                });
              } catch (e) {}
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

            // ── Task 7: Schedule panel opened ────────────────────────────
            try {
              const analyticsInstance = getAnalytics();
              await logEvent(analyticsInstance, "shuttle_schedule_viewed", {
                session_id: sessionId.current,
                screen: "CampusMapScreen",
                time_since_map_load_ms: Date.now() - mapLoadTime.current,
                timestamp: new Date().toISOString(),
              });
            } catch (error) {
              console.error("Firebase Analytics Error: ", error);
            }
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

      {/* Right button stack: next-class + directions + my-location */}
      <View style={styles.buttonStack}>
        <Pressable
          testID="next-class-button"
          accessibilityLabel="Navigate to next class"
          onPress={async () => {
            setIsNextClassVisible(true);
            try {
              const analyticsInstance = getAnalytics();
              await logEvent(
                analyticsInstance,
                "next_class_directions_requested",
                {
                  session_id: sessionId.current,
                  screen: "CampusMapScreen",
                  has_next_class: nextClass !== null,
                  timestamp: new Date().toISOString(),
                },
              );
            } catch (error) {
              console.error("Firebase Analytics Error: ", error);
            }
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
            // ── Task 5: Directions button tapped directly ─────────────────
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

            // ── Task 7: Schedule panel closed ────────────────────────────
            endTask("task_7");
          }}
        />
      )}

      {showStepsPanel && (
        <DirectionStepsPanel
          steps={routeSteps}
          strategy={selectedStrategy}
          onChangeRoute={() => {
            setInitialStart(selectedRoute.start);
            setInitialDestination(selectedRoute.dest);

            // ── Task 6: "Change route" tapped from steps panel ────────────
            try {
              logEvent(getAnalytics(), "route_change_requested", {
                session_id: sessionId.current,
                from_start: selectedRoute.start?.name ?? "unknown",
                from_dest: selectedRoute.dest?.name ?? "unknown",
              });
            } catch (e) {}
            openNavigationBar("change_route");
          }}
          onDismiss={() => {
            setSelectedRoute({ start: null, dest: null });
            setRouteSteps([]);

            // ── Task 6: Steps panel dismissed ────────────────────────────
            try {
              logEvent(getAnalytics(), "steps_panel_dismissed", {
                session_id: sessionId.current,
              });
            } catch (e) {}
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

          // ── Task 5: Nav bar closed without confirming a route ─────────
          if (navStartTime.current) {
            try {
              logEvent(getAnalytics(), "route_generation_abandoned", {
                session_id: sessionId.current,
                time_spent_ms: Date.now() - navStartTime.current,
                nav_open_count: navOpenCount.current,
              });
            } catch (e) {}
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
          // ── Task 5: "Use my location" tapped inside nav bar ───────────
          try {
            logEvent(getAnalytics(), "nav_used_my_location", {
              session_id: sessionId.current,
              field: "start",
            });
          } catch (e) {}
          return demoCurrentBuilding ?? autoStartBuilding ?? null;
        }}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  campusToggleContainer: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
    pointerEvents: "box-none",
  },
  campusToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  campusToggle: {
    flexDirection: "row",
    backgroundColor: colors.offWhite,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 160,
    opacity: 0.93,
  },
  routeFromCampusButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDarker,
    opacity: 0.93,
  },
  routeFromCampusButtonText: {
    ...typography.button,
    color: colors.white,
    fontSize: 14,
  },
  campusToggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  campusToggleOptionLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.primaryDarker,
  },
  campusToggleOptionActive: {
    backgroundColor: colors.primaryBarelyTransparent,
  },
  campusToggleText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  campusToggleTextActive: {
    color: colors.white,
  },
  indoorButton: {
    position: "absolute",
    top: 30,
    right: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.offWhite,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    opacity: 0.93,
    zIndex: 10,
  },
  indoorButtonText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  buttonStack: {
    position: "absolute",
    bottom: 50,
    right: spacing.md,
    gap: 12,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  myLocationButtonActive: {
    backgroundColor: colors.primary,
  },
  shuttleDisabled: {
    backgroundColor: "#666",
    opacity: 0.8,
  },
  nextClassButton: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondaryDark,
  },
  nextClassButtonDisabled: {
    backgroundColor: colors.gray500,
    borderColor: colors.gray500,
    opacity: 0.5,
  },
});
