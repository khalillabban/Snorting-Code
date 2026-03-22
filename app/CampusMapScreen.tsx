import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { getAnalytics, logEvent } from "@react-native-firebase/analytics";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  // Next class state
  const [isNextClassVisible, setIsNextClassVisible] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

  const nextClass = useMemo(
    () => getNextClassFromItems(scheduleItems),
    [scheduleItems],
  );

  // Load schedule from cache
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
      if (prev === "user") {
        return prev;
      }
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
    };

    getUserBuilding();
  }, [findNearestBuilding]);

  const selectCampus = async (campusKey: CampusKey) => {
    setCurrentCampus(campusKey);
    setFocusTarget(campusKey);

    //Usability Testing
    try {
      const analyticsInstance = getAnalytics();

      await logEvent(analyticsInstance, "campus_switch", {
        campus_name: campusKey,
        screen: "CampusMapScreen",
        timestamp: new Date().toISOString(),
      });

      console.log(`Firebase: Logged switch to ${campusKey} (Modular API)`);
    } catch (error) {
      console.error("Firebase Analytics Error: ", error);
    }
  };

  const focusUserLocation = () => {
    setFocusTarget("user");
    setUserFocusCounter((c) => c + 1);
  };

  const handleConfirmRoute = (
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
  };
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
        onRouteSteps={setRouteSteps}
        onSetAsStart={(building) => {
          setInitialStart(building);
          setIsNavVisible(true);
        }}
        onSetAsDestination={(building) => {
          setInitialDestination(building);
          setIsNavVisible(true);
        }}
        onSetAsMyLocation={(building) => {
          setDemoCurrentBuilding(building);
        }}
        onBuildingSelected={(building, hasMap) => {
          setSelectedBuildingWithMap(hasMap ? building : null);
        }}
        onIndoorFloorsAvailable={(floors) => setIndoorAvailableFloors(floors)}
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
          onPress={() =>
            router.push({
              pathname: "/IndoorMapScreen",
              params: {
                buildingName: selectedBuildingWithMap.name,
                floors: JSON.stringify(indoorAvailableFloors),
              },
            })
          }
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
              setShowShuttle(!showShuttle);
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
          //Usability Testing on finding the Shutle Schedule
          onPress={async () => {
            setShowShuttleSchedulePanel(true);
            try {
              const analyticsInstance = getAnalytics();
              await logEvent(analyticsInstance, "shuttle_schedule_viewed", {
                screen: "CampusMapScreen",
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
          //Usability Testing finding next class
          onPress={async () => {
            setIsNextClassVisible(true);
            try {
              const analyticsInstance = getAnalytics();
              await logEvent(
                analyticsInstance,
                "next_class_directions_requested",
                {
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

      {showShuttleSchedulePanel && (
        <ShuttleSchedulePanel
          onClose={() => setShowShuttleSchedulePanel(false)}
        />
      )}

      {showStepsPanel && (
        <DirectionStepsPanel
          steps={routeSteps}
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
        autoStartBuilding={demoCurrentBuilding ?? autoStartBuilding}
        initialStart={initialStart}
        onInitialStartApplied={() => setInitialStart(null)}
        initialDestination={initialDestination}
        onInitialDestinationApplied={() => setInitialDestination(null)}
        currentCampus={currentCampus}
        onUseMyLocation={() => demoCurrentBuilding ?? autoStartBuilding ?? null}
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
