import {
  Accuracy,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import type { Region } from "react-native-maps";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { colors, spacing } from "../constants/theme";
import { Buildings, Location } from "../constants/type";
import { getOutdoorRoute } from "../services/GoogleDirectionsService";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";
import { BuildingInfoPopup } from "./BuildingInfoPopup";

interface CampusMapProps {
  coordinates: Location;
  focusTarget: "sgw" | "loyola" | "user";
  campus: CampusKey;
  startPoint?: Buildings | null;
  destinationPoint?: Buildings | null;
}

const HIGHLIGHT_STROKE_WIDTH = 3;
const SELECTED_STROKE_WIDTH = 5;
const DEFAULT_STROKE_WIDTH = 2;

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CampusMap({
  coordinates,
  focusTarget,
  campus,
  startPoint,
  destinationPoint,
}: CampusMapProps) {
  const [selectedBuilding, setSelectedBuilding] = useState<Buildings | null>(null);
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

  const [region, setRegion] = useState<Region>({
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

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
  }, []);

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

  const buildingsOnCampus = useMemo(() => {
    const normalized = campus.toLowerCase();
    return BUILDINGS.filter(
      (b) => (b.campusName ?? "").toLowerCase() === normalized
    );
  }, [campus]);

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
          destinationPoint.coordinates
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
        250
      );
      return;
    }

    mapRef.current?.animateToRegion(
      { ...coordinates, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      250
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
        300
      );
    }
  }, [selectedBuilding, mapReady]);

  const currentBuilding = useMemo(
    () =>
      userCoords ? getBuildingContainingPoint(userCoords, BUILDINGS) : null,
    [userCoords]
  );

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

        {/* Building polygons (only for current campus) */}
        {buildingsOnCampus.map((building) => {
          const isSelected = selectedBuilding?.name === building.name;
          const isCurrent = currentBuilding?.name === building.name;
          const style = getPolygonStyle(isCurrent, isSelected);

          if (!building.boundingBox?.length) {
            console.warn(
              `Building ${building.name} has no boundingBox coordinates.`
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

        {/* Always render labels; fade them for smooth in/out */}
        {buildingsOnCampus.map((building) => (
          <Marker
            key={`label-${building.name}`}
            coordinate={building.coordinates}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            tappable={false}
          >
            <Animated.View
              pointerEvents={labelsVisible ? "auto" : "none"}
              style={[
                styles.codePill,
                {
                  transform: [{ scale: labelScale }],
                  opacity: labelsOpacity,
                },
              ]}
            >
              <Text style={styles.codeText}>{building.name}</Text>
            </Animated.View>
          </Marker>
        ))}

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
      </MapView>

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

  codePill: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius:6,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  codeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.white,
  },
});
