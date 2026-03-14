import { MaterialIcons } from "@expo/vector-icons";
// ADD FOR THE INDOOR NAVIGATION
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Accuracy,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import type { Region } from "react-native-maps";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { BUSSTOP } from "../constants/shuttle";
import { DRIVING_STRATEGY } from "../constants/strategies";
import { colors, spacing } from "../constants/theme";
import type {
  Buildings,
  Location,
  RouteSegment,
  RouteStep,
} from "../constants/type";
import { useFloorData } from "../hooks/useFloorData";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import type { RouteStrategy } from "../services/Routing";
import { getAvailableFloors } from "../utils/mapAssets";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";
import { BuildingInfoPopup } from "./BuildingInfoPopup";
import { FloorSwitcher } from "./Floorswitcher";
import { IndoorOverlay } from "./IndoorOverlay";
import { useShuttleBus } from "./ShuttleBusTracker";

type CampusMapProps = Readonly<{
  coordinates: Location;
  focusTarget: CampusKey | "user";
  userFocusCounter?: number;
  routeFocusTrigger?: number;
  startPoint?: Buildings | null;
  destinationPoint?: Buildings | null;
  showShuttle: boolean;
  strategy: RouteStrategy;
  demoCurrentBuilding?: Buildings | null;
  onRouteSteps?: (steps: RouteStep[]) => void;
  onSetAsStart?: (building: Buildings) => void;
  onSetAsDestination?: (building: Buildings) => void;
  onSetAsMyLocation?: (building: Buildings) => void;
  onBuildingSelected?: (building: Buildings | null, hasMap: boolean) => void;
  onIndoorFloorsAvailable?: (floors: number[]) => void;
}>;

const HIGHLIGHT_STROKE_WIDTH = 3;
const SELECTED_STROKE_WIDTH = 5;
const DEFAULT_STROKE_WIDTH = 2;

/**
 * Labels show/hide thresholds based on zoom level (latitudeDelta).
 */
const LABELS_SHOW_AT_DELTA = 0.01; // turn ON when zoomed in enough
const LABELS_HIDE_AT_DELTA = 0.012; // turn OFF when zoomed out

function getPolygonStyle(isCurrent: boolean, isSelected: boolean) {
  if (isCurrent) {
    return {
      fillColor: colors.secondaryTransparent,
      strokeColor: colors.secondary,
      strokeWidth: HIGHLIGHT_STROKE_WIDTH,
    };
  }
  if (isSelected) {
    return {
      fillColor: colors.primaryLight,
      strokeColor: colors.primaryDark,
      strokeWidth: SELECTED_STROKE_WIDTH,
    };
  }
  return {
    fillColor: colors.primaryTransparent,
    strokeColor: colors.primary,
    strokeWidth: DEFAULT_STROKE_WIDTH,
  };
}

const CURRENT_LOCATION_MARKER_TITLE = "You are here";

type CurrentLocationMarkerProps = {
  readonly coordinate: {
    readonly latitude: number;
    readonly longitude: number;
  };
};

function CurrentLocationMarker({ coordinate }: CurrentLocationMarkerProps) {
  return (
    <Marker
      coordinate={coordinate}
      title={CURRENT_LOCATION_MARKER_TITLE}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={Platform.OS === "android"}
    >
      <View style={styles.currentLocationDot} />
    </Marker>
  );
}

function getPolylineStyleForMode(mode: RouteStrategy["mode"]) {
  const strokeColors: Record<RouteStrategy["mode"], string> = {
    walking: colors.routeWalk,
    bicycling: colors.routeBike,
    driving: colors.routeDrive,
    transit: colors.routeTransit,
    shuttle: colors.routeTransit,
  };

  const strokeColor = strokeColors[mode] ?? colors.primary;
  let lineDashPattern: number[] | undefined;

  if (mode === "transit" || mode === "shuttle") {
    lineDashPattern = [8, 6];
  } else if (mode === "bicycling") {
    lineDashPattern = [4, 4];
  }
  return { strokeColor, lineDashPattern };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CampusMap({
  coordinates,
  focusTarget,
  userFocusCounter = 0,
  routeFocusTrigger = 0,
  startPoint,
  destinationPoint,
  showShuttle,
  strategy,
  demoCurrentBuilding,
  onRouteSteps,
  onSetAsStart,
  onSetAsDestination,
  onSetAsMyLocation,
  onBuildingSelected,
  onIndoorFloorsAvailable,
}: CampusMapProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<Buildings | null>(
    null,
  );
  //INDOOR NAVIGATION
  const [indoorVisible, setIndoorVisible] = useState(false);
  const [activeFloor, setActiveFloor] = useState(1);
  const { floorPlan } = useFloorData(
    selectedBuilding?.name ?? null,
    activeFloor,
  );
  const [availableFloors, setAvailableFloors] = useState<number[]>([]);

  // Replace your existing availableFloors useEffect with this:
  useEffect(() => {
    if (!selectedBuilding) {
      setAvailableFloors([]);
      return;
    }
    const floors = getAvailableFloors(selectedBuilding.name);
    setAvailableFloors(floors ?? []);
  }, [selectedBuilding]);

  useEffect(() => {
    onBuildingSelected?.(selectedBuilding, (availableFloors ?? []).length > 0);
    onIndoorFloorsAvailable?.(availableFloors ?? []);
  }, [
    selectedBuilding,
    availableFloors,
    onBuildingSelected,
    onIndoorFloorsAvailable,
  ]);
  const [shuttleRouteCoords, setShuttleRouteCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  const mapRef = useRef<MapView>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Shuttle buses
  const { activeBuses } = useShuttleBus();

  const [region, setRegion] = useState<Region>({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);

  // Sync region center when campus changes
  useEffect(() => {
    setRegion((prev) => ({
      ...prev,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    }));
  }, [coordinates.latitude, coordinates.longitude]);

  const [labelsVisible, setLabelsVisible] = useState(false);
  const labelsOpacity = useRef(new Animated.Value(0)).current;

  const handleMapPress = () => {
    if (selectedBuilding) setSelectedBuilding(null);
  };

  const handleBuildingPress = (building: Buildings) => {
    setSelectedBuilding(building);
  };

  const handleRegionChangeComplete = useCallback((next: Region) => {
    setRegion(next);

    setLabelsVisible((prev) => {
      if (prev) return next.latitudeDelta < LABELS_HIDE_AT_DELTA;
      return next.latitudeDelta <= LABELS_SHOW_AT_DELTA;
    });

    if (next.latitudeDelta < 0.004) {
      const center = { latitude: next.latitude, longitude: next.longitude };
      const building = getBuildingContainingPoint(center, BUILDINGS);

      if (building) {
        // Only update if it's a different building — avoid re-renders
        setSelectedBuilding((prev) =>
          prev?.name === building.name ? prev : building,
        );
        setIndoorVisible(true);
      }
      // Don't hide if no building found at center — user may have panned slightly
      // off-center while still zoomed in on a building
    } else {
      setIndoorVisible(false);
      // Don't clear selectedBuilding here — let the user tap X or zoom out fully
    }
  }, []); // no selectedBuilding dependency needed — reads from map center directly

  useEffect(() => {
    Animated.timing(labelsOpacity, {
      toValue: labelsVisible ? 1 : 0,
      duration: labelsVisible ? 180 : 140,
      useNativeDriver: true,
    }).start();
  }, [labelsVisible, labelsOpacity]);

  const labelScale = useMemo(() => {
    const d = region.latitudeDelta || 0.01;
    const raw = 0.65 / d;
    return clamp(raw, 0.9, 1.35);
  }, [region.latitudeDelta]);

  const buildingsOnCampus = useMemo(() => BUILDINGS, []);

  // Load current GPS location
  useEffect(() => {
    let cancelled = false;

    async function loadCurrentLocation() {
      try {
        const servicesEnabled = await hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (!cancelled) {
            setLocationError("Location services are disabled.");
            setUserCoords(null);
          }
          return;
        }

        const existing = await getForegroundPermissionsAsync();
        let status = existing.status;

        if (status !== "granted") {
          const requested = await requestForegroundPermissionsAsync();
          status = requested.status;
        }

        if (status !== "granted") {
          if (!cancelled) {
            setLocationError("Permission to access location was denied.");
            setUserCoords(null);
          }
          return;
        }

        const location = await getCurrentPositionAsync({
          accuracy: Accuracy.Balanced,
        });

        if (cancelled) return;

        setUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        setLocationError(null);
      } catch {
        if (!cancelled) {
          setLocationError("Unable to get your current location.");
          setUserCoords(null);
        }
      }
    }

    loadCurrentLocation();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch route (and steps) when start/destination/strategy changes
  useEffect(() => {
    let cancelled = false;

    async function fetchRoute() {
      if (!startPoint || !destinationPoint) {
        setRouteSegments([]);
        onRouteSteps?.([]);
        return;
      }

      try {
        const { steps, segments } = await getOutdoorRouteWithSteps(
          startPoint.coordinates,
          destinationPoint.coordinates,
          strategy,
        );

        if (cancelled) return;

        setRouteSegments(segments);
        onRouteSteps?.(steps);
      } catch {
        if (!cancelled) {
          onRouteSteps?.([]);
          setRouteSegments([]);
        }
      }
    }

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [startPoint, destinationPoint, strategy, onRouteSteps]);

  // Fetch shuttle route (campus to campus) via Google Directions when showShuttle is true
  useEffect(() => {
    if (!showShuttle) {
      setShuttleRouteCoords([]);
      return;
    }

    let cancelled = false;
    const origin = BUSSTOP[0].coordinates;
    const destination = BUSSTOP[1].coordinates;

    async function fetchShuttleRoute() {
      try {
        const { coordinates } = await getOutdoorRouteWithSteps(
          origin,
          destination,
          DRIVING_STRATEGY,
        );
        if (!cancelled) setShuttleRouteCoords(coordinates ?? []);
      } catch (e) {
        console.error("Shuttle route fetch failed:", e);
        if (!cancelled) setShuttleRouteCoords([]);
      }
    }

    fetchShuttleRoute().catch(() => {
      if (!cancelled) setShuttleRouteCoords([]);
    });
    return () => {
      cancelled = true;
    };
  }, [showShuttle]);

  // Animate map focus
  useEffect(() => {
    if (!mapReady) return;

    if (focusTarget === "user") {
      if (!userCoords) return;
      mapRef.current?.animateToRegion(
        { ...userCoords, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        250,
      );
      return;
    }

    mapRef.current?.animateToRegion(
      { ...coordinates, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      250,
    );
  }, [focusTarget, coordinates, userCoords, mapReady, userFocusCounter]);

  // Focus on start point when route is confirmed
  useEffect(() => {
    if (startPoint && mapReady && routeFocusTrigger > 0) {
      mapRef.current?.animateToRegion(
        {
          latitude: startPoint.coordinates.latitude,
          longitude: startPoint.coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500,
      );
    }
  }, [startPoint, mapReady, routeFocusTrigger]);

  // Focus selected building
  useEffect(() => {
    if (selectedBuilding && mapReady) {
      mapRef.current?.animateToRegion(
        {
          latitude: selectedBuilding.coordinates.latitude - 0.0011,
          longitude: selectedBuilding.coordinates.longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        300,
      );
    }
  }, [selectedBuilding, mapReady]);
  useEffect(() => {
    console.log("[Indoor Debug]", {
      selectedBuilding: selectedBuilding?.name ?? null,
      indoorVisible,
      floorPlanLoaded: !!floorPlan,
      availableFloors,
      activeFloor,
    });
  }, [
    selectedBuilding,
    indoorVisible,
    floorPlan,
    availableFloors,
    activeFloor,
  ]);
  const currentBuilding = useMemo(() => {
    if (demoCurrentBuilding) return demoCurrentBuilding;
    return userCoords
      ? getBuildingContainingPoint(userCoords, BUILDINGS)
      : null;
  }, [userCoords, demoCurrentBuilding]);

  return (
    <View style={styles.container}>
      <MapView
        key={`${coordinates.latitude}-${coordinates.longitude}`}
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChangeComplete}
        initialRegion={{
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {userCoords && <CurrentLocationMarker coordinate={userCoords} />}

        {startPoint && (
          <Marker
            testID="marker-start"
            coordinate={startPoint.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={Platform.OS === "android"}
          >
            <View style={styles.startDot} />
          </Marker>
        )}

        {destinationPoint && (
          <Marker
            testID="marker-destination"
            coordinate={destinationPoint.coordinates}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={Platform.OS === "android"}
          >
            <View style={styles.destinationPinWrapper}>
              <MaterialIcons
                name="place"
                size={44}
                color="black"
                style={styles.destinationPinShadow}
              />
              <MaterialIcons
                name="place"
                size={30}
                color="black"
                style={[styles.destinationPinShadow, { top: 6 }]}
              />
              <MaterialIcons
                name="place"
                size={40}
                color={colors.error}
                style={styles.destinationPinFront}
              />
            </View>
          </Marker>
        )}

        {/* ✅ Building polygons — loop is clean, nothing extra inside */}
        {buildingsOnCampus.map((building) => {
          const isSelected = selectedBuilding?.name === building.name;
          const isCurrent = currentBuilding?.name === building.name;
          const style = getPolygonStyle(isCurrent, isSelected);

          if (!building.boundingBox?.length) {
            console.warn(
              `Building ${building.name} has no boundingBox coordinates.`,
            );
            return null;
          }

          return (
            <Polygon
              key={building.name}
              coordinates={building.boundingBox}
              fillColor={style.fillColor}
              strokeColor={style.strokeColor}
              strokeWidth={style.strokeWidth}
              tappable
              onPress={(e) => {
                e.stopPropagation();
                handleBuildingPress(building);
              }}
            />
          );
        })}

        {/* ✅ IndoorOverlay — INSIDE <MapView>, AFTER the building polygons loop */}
        {indoorVisible &&
          floorPlan &&
          selectedBuilding &&
          (() => {
            console.log("[Indoor Debug] IndoorOverlay rendering with", {
              building: selectedBuilding.name,
              featureCount: floorPlan.features.length,
              hasBoundingBox: !!selectedBuilding.boundingBox?.length,
              inGeoJsonBounds: ["MB"].includes(selectedBuilding.name), // update list as needed
            });
            return (
              <IndoorOverlay geojson={floorPlan} building={selectedBuilding} />
            );
          })()}

        {/* Labels */}
        {buildingsOnCampus.map((building) => (
          <Marker
            key={`label-${building.name}`}
            testID={`label-marker-${building.name}`}
            coordinate={building.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={labelsVisible}
            tappable={true}
            onPress={() => handleBuildingPress(building)}
          >
            <Animated.View
              testID={`label-pill-${building.name}`}
              pointerEvents="none"
              style={[
                styles.codePill,
                { transform: [{ scale: labelScale }], opacity: labelsOpacity },
              ]}
            >
              <Text style={styles.codeText}>{building.name}</Text>
            </Animated.View>
          </Marker>
        ))}

        {/* Route */}
        {routeSegments.length > 0 &&
          routeSegments.map((seg) => {
            const { strokeColor, lineDashPattern } = getPolylineStyleForMode(
              seg.mode,
            );
            const segmentKey = `${seg.mode}-${seg.coordinates
              .map((coord) => `${coord.latitude}-${coord.longitude}`)
              .join("|")}`;

            return (
              <React.Fragment key={segmentKey}>
                <Polyline
                  testID="polyline-border"
                  coordinates={seg.coordinates}
                  strokeWidth={8}
                  strokeColor="black"
                  lineDashPattern={lineDashPattern}
                  lineJoin="round"
                  lineCap="round"
                  zIndex={1}
                />
                <Polyline
                  testID="polyline-main"
                  coordinates={seg.coordinates}
                  strokeWidth={6}
                  strokeColor={strokeColor}
                  lineDashPattern={lineDashPattern}
                  lineJoin="round"
                  lineCap="round"
                  zIndex={2}
                />
              </React.Fragment>
            );
          })}

        {/* Shuttle route + live shuttle markers */}
        {showShuttle && (
          <>
            {shuttleRouteCoords.length > 0 && (
              <Polyline
                coordinates={shuttleRouteCoords}
                strokeWidth={6}
                strokeColor={colors.routeTransit}
                lineDashPattern={[10, 6]}
                lineJoin="round"
                lineCap="round"
                zIndex={1}
              />
            )}
            {BUSSTOP.map((stop) => (
              <Marker
                key={stop.id}
                coordinate={stop.coordinates}
                title={stop.name}
                description={stop.address}
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.busPin}>
                  <View style={styles.busPinHead}>
                    <MaterialCommunityIcons
                      name="bus-stop-covered"
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.busPinTail} />
                </View>
              </Marker>
            ))}
            {activeBuses.map((bus) => (
              <Marker
                key={bus.ID}
                coordinate={{
                  latitude: bus.Latitude,
                  longitude: bus.Longitude,
                }}
                title="Shuttle Bus"
                anchor={{ x: 0.5, y: 1 }}
              >
                <View style={styles.busPin}>
                  <View style={styles.busPinHead}>
                    <MaterialCommunityIcons
                      name="bus-side"
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <View style={styles.busPinTail} />
                </View>
              </Marker>
            ))}
          </>
        )}
      </MapView>
      {/* ^^^ MapView closes here */}

      {/* ✅ FloorSwitcher — OUTSIDE <MapView>, inside the root <View> */}
      {indoorVisible && (availableFloors ?? []).length > 0 && (
        <FloorSwitcher
          floors={availableFloors}
          activeFloor={activeFloor}
          onFloorChange={setActiveFloor}
          onExit={() => {
            setIndoorVisible(false);
            setSelectedBuilding(null);
            // Zoom back out so handleRegionChangeComplete won't immediately re-trigger
            mapRef.current?.animateToRegion(
              {
                latitude: region.latitude,
                longitude: region.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              300,
            );
          }}
        />
      )}

      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      <BuildingInfoPopup
        building={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
        onSetAsStart={(building) => {
          onSetAsStart?.(building);
          setSelectedBuilding(null);
        }}
        onSetAsDestination={(building) => {
          onSetAsDestination?.(building);
          setSelectedBuilding(null);
        }}
        onSetAsMyLocation={(building) => {
          onSetAsMyLocation?.(building);
          setSelectedBuilding(null);
        }}
        hasIndoorMap={availableFloors.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  errorBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  errorText: { color: colors.white, textAlign: "center" },
  currentLocationDot: {
    width: 20,
    height: 20,
    borderRadius: 14,
    backgroundColor: "#007AFF",
    borderWidth: 2.5,
    borderColor: "white",
  },

  busStopMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  busStopIcon: {
    fontSize: 22,
  },
  shuttleStopMarker: {
    alignItems: "center",
  },
  shuttleStopPin: {
    backgroundColor: colors.routeTransit,
    borderRadius: 20,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
  },
  shuttleStopLabel: {
    marginTop: 4,
    backgroundColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray300,
    alignItems: "center",
    minWidth: 72,
  },
  shuttleStopCampus: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  shuttleStopStartEnd: {
    fontSize: 11,
    color: colors.gray500,
    marginTop: 1,
  },
  busPin: {
    alignItems: "center",
  },
  busPinHead: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  busPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.primary,
  },

  startDot: {
    width: 20,
    height: 20,
    borderRadius: 14,
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "black",
  },
  destinationPinWrapper: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  destinationPinShadow: {
    position: "absolute",
  },
  destinationPinFront: {
    position: "absolute",
  },

  codePill: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  codeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
});
