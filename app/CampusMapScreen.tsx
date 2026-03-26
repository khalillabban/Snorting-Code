import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/CampusMapScreen.styles";
import { parseTransitionPayload, serializeTransitionPayload } from "../utils/routeTransition";
import { getBuildingPlanAsset } from "../utils/mapAssets";
import {
  getIndoorNavigationRouteFromNode,
  indoorRouteToSteps,
} from "../utils/indoorNavigation";
import {
  buildIndoorMapRouteParams,
  getIndoorAccessState,
} from "../utils/indoorAccess";
import { IndoorRoomRecord } from "../utils/indoorBuildingPlan";
import {
  getNextClassFromItems,
  loadCachedSchedule,
} from "../utils/parseCourseEvents";
import { getDistanceToPolygon } from "../utils/pointInPolygon";

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
  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);

  const destinationRoomQueryText = useMemo(() => {
    if (typeof destinationRoomQuery === "string" && destinationRoomQuery.trim()) {
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

    // Force the campus toggle to the destination campus so the user sees the correct map.
    const destCampus =
      destBuilding.campusName === "loyola" ? ("loyola" as const) : ("sgw" as const);
    setCurrentCampus(destCampus);
    setFocusTarget((prev) => (prev === "user" ? prev : destCampus));

  // Ensure both endpoints are set so CampusMap computes a route immediately.
  setSelectedRoute({ start: originBuilding ?? null, dest: destBuilding });
    setSelectedStrategy(transitionPayload.strategy ?? WALKING_STRATEGY);
    setRouteFocusTrigger((c) => c + 1);

    // Show the navigation drawer so the user can pick walk/bike/drive/transit/shuttle.
    setIsNavVisible(true);
  }, [transitionPayload]);

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

      const entryNodes = (asset?.nodes ?? []).filter(
        (n: any) => n.type === "building_entry_exit" && n.outdoorLatLng,
      );

      if (destOutdoor && entryNodes.length > 0) {
        const bestNode = entryNodes
          .map((n: any) => {
            const ll = n.outdoorLatLng;
            const dx = ll.latitude - destOutdoor.latitude;
            const dy = ll.longitude - destOutdoor.longitude;
            return { n, d: dx * dx + dy * dy };
          })
          .sort((a: any, b: any) => a.d - b.d)[0]?.n;

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
          ...(navOrigin ? { navOrigin } : {}),
          ...(navDest ? { navDest } : {}),
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

      // Cross-building indoor-to-indoor trip (Option A): plan it from Campus Map.
      // When both endpoints are rooms but buildings differ, we kick off the origin indoor leg.
      if (start?.name && dest?.name && startRoom && endRoom && start.name !== dest.name) {
        const payload = {
          mode: "cross_building_indoor" as const,
          originBuildingCode: start.name,
          originIndoorRoomQuery: startRoom.label,
          destinationBuildingCode: dest.name,
          destinationIndoorRoomQuery: endRoom.label,
          strategy,
          accessibleOnly: !!accessible,
        };

        router.push({
          pathname: "/CampusMapScreen",
          params: {
            campus: (start.campusName as any) ?? "sgw",
            transition: serializeTransitionPayload(payload as any),
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
  const continueIndoorsBuildingCode = useMemo(() => {
    const selected = selectedRoute.dest?.name?.trim();
    if (selected) return selected;

    if (transitionPayload?.mode === "indoor_to_outdoor") {
      const payloadCode = transitionPayload.destinationBuildingCode?.trim();
      if (payloadCode) return payloadCode;
    }

    return "";
  }, [selectedRoute.dest?.name, transitionPayload]);

  const canContinueIndoors = Boolean(continueIndoorsBuildingCode);

  const nextClassIndoorAccess = useMemo(
    () => getIndoorAccessState(nextClass?.building),
    [nextClass?.building],
  );
  const canOpenNextClassIndoorMap = Boolean(
    nextClassIndoorAccess.hasSearchableRooms && nextClass?.room.trim(),
  );

  const routeStepsWithContinueIndoors = useMemo(() => {
    const baseSteps = (mergedSteps ?? routeSteps) as any[];
    if (!canContinueIndoors) return baseSteps;

    const destCode = continueIndoorsBuildingCode;
    if (!destCode) return baseSteps;

    const labelRoom = destinationRoomQueryText.trim();
    const instruction = labelRoom
      ? `Continue indoors to ${labelRoom}`
      : `Continue indoors in ${destCode}`;

    return [
      ...baseSteps,
      {
        instruction,
        onPress: () => {
          const roomQuery = destinationRoomQueryText.trim();
          // For "continue indoors" we want an actual route polyline, not just a marker.
          // IndoorMapScreen will auto-trigger navigation when both navOrigin + navDest are present.
          // - navOrigin: "ENTRANCE" (special-cased inside IndoorMapScreen for destination-leg)
          // - navDest: destination room query (ex: CC-124)
          openIndoorMap(destCode, undefined, "ENTRANCE", roomQuery || undefined);
        },
      },
    ];
  }, [mergedSteps, routeSteps, canContinueIndoors, continueIndoorsBuildingCode, destinationRoomQueryText, openIndoorMap]);

  // ── Render ─────────────────────────────────────────────────────────────────

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

      {showShuttleSchedulePanel && (
        <ShuttleSchedulePanel
          onClose={() => setShowShuttleSchedulePanel(false)}
        />
      )}

      {showStepsPanel && (
        <DirectionStepsPanel
          steps={routeStepsWithContinueIndoors as any}
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
