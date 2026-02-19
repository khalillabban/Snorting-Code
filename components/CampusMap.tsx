import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import {
  Accuracy,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import { BUSSTOP } from "../constants/shuttle";
import { colors, spacing } from "../constants/theme";
import { Buildings, Location } from "../constants/type";
import { getOutdoorRoute } from "../services/GoogleDirectionsService";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";
import { BuildingInfoPopup } from "./BuildingInfoPopup";
import { useShuttleBus } from "./ShuttleBusTracker";

interface CampusMapProps {
  coordinates: Location;
  focusTarget: "sgw" | "loyola" | "user";
  startPoint?: Buildings | null;
  destinationPoint?: Buildings | null;
  showShuttle: boolean; // <--- Add this line
}

const HIGHLIGHT_STROKE_WIDTH = 3;
const SELECTED_STROKE_WIDTH = 5;
const DEFAULT_STROKE_WIDTH = 2;

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

function CurrentLocationMarker({
  coordinate,
}: {
  coordinate: { latitude: number; longitude: number };
}) {
  return (
    <Marker
      coordinate={coordinate}
      title={CURRENT_LOCATION_MARKER_TITLE}
      pinColor={colors.primary}
    />
  );
}

export default function CampusMap({
  coordinates,
  focusTarget,
  startPoint,
  destinationPoint,
  showShuttle,
}: CampusMapProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<Buildings | null>(
    null,
  );
  const [routeCoords, setRouteCoords] = useState<
    { latitude: number; longitude: number }[]
  >([]);

  const mapRef = useRef<MapView>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  //  Shuttle buses
  const { activeBuses } = useShuttleBus();

  const handleMapPress = () => {
    if (selectedBuilding) setSelectedBuilding(null);
  };

  const handleBuildingPress = (building: Buildings) => {
    setSelectedBuilding(building);
  };

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

  // Fetch route when start/destination changes
  useEffect(() => {
    let cancelled = false;

    async function fetchRoute() {
      if (!startPoint || !destinationPoint) {
        setRouteCoords([]);
        return;
      }

      try {
        const route = await getOutdoorRoute(
          startPoint.coordinates,
          destinationPoint.coordinates,
        );

        if (cancelled) return;

        setRouteCoords(route);
      } catch (error) {
        if (!cancelled) {
          console.log("Route error:", error);
          setRouteCoords([]);
        }
      }
    }

    fetchRoute();

    return () => {
      cancelled = true;
    };
  }, [startPoint, destinationPoint]);

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
  }, [focusTarget, coordinates, userCoords, mapReady]);

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

  const currentBuilding = useMemo(
    () =>
      userCoords ? getBuildingContainingPoint(userCoords, BUILDINGS) : null,
    [userCoords],
  );

  console.log("route points:", routeCoords.length);

  return (
    <View style={styles.container}>
      <MapView
        key={`${coordinates.latitude}-${coordinates.longitude}`}
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
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
            coordinate={startPoint.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.blueDotInner} />
          </Marker>
        )}

        {destinationPoint && (
          <Marker
            coordinate={destinationPoint.coordinates}
            title="Destination"
            pinColor="red"
          />
        )}

        {BUILDINGS.map((building) => {
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

        {routeCoords.length > 0 && (
          <Polyline
            key={routeCoords.length}
            coordinates={routeCoords}
            strokeWidth={6}
            strokeColor={colors.primary}
            lineJoin="round"
            lineCap="round"
          />
        )}

        {/* Live shuttle bus markers - Wrapped in Toggle logic */}
        {showShuttle && (
          <>
            {BUSSTOP.map((stop) => (
              <Marker
                key={stop.id}
                coordinate={{
                  latitude: stop.coordinates.latitude,
                  longitude: stop.coordinates.longitude,
                }}
                title={stop.name}
                description={stop.address}
              >
                <View style={styles.busStopMarker}>
                  <Text style={styles.busStopIcon}>🚏</Text>
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
      {/* Live shuttle bus markers - Wrapped in Toggle logic */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      <BuildingInfoPopup
        building={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
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
  blueDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#007AFF",
    borderWidth: 2,
    borderColor: "white",
  },

  //ADD FOR THE SHUTTLE
  busStopMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  busStopIcon: {
    fontSize: 22,
  },
  busMarker: {
    alignItems: "center",
    justifyContent: "center",
  },
  busIcon: {
    fontSize: 26,
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
  shuttleToggle: {
    position: "absolute",
    bottom: 170,
    right: spacing.md,
    backgroundColor: colors.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  shuttleDisabled: {
    backgroundColor: "#666",
  },
  //END FOR SHUTTLE
});
