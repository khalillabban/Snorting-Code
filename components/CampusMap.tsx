import {
  Accuracy,
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import { borderRadius, colors, spacing, typography } from "../constants/theme";
import { Buildings, Location } from "../constants/type";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";
import { BuildingInfoPopup } from "./BuildingInfoPopup";

const HIGHLIGHT_STROKE_WIDTH = 3;
const SELECTED_STROKE_WIDTH = 5;
const DEFAULT_STROKE_WIDTH = 2;
const SELECTED_BUILDING_DELTA = 0.004;
const SELECTED_BUILDING_LAT_OFFSET = 0.0011;

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
type FocusTarget = "sgw" | "loyola" | "user";

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
}: {
  coordinates: Location;
  focusTarget: FocusTarget;
}) {
  const [selectedBuilding, setSelectedBuilding] = useState<Buildings | null>(
    null,
  );

  const handleMapPress = () => {
    // Can also close the popup if tapped on empty map area
    if (selectedBuilding) setSelectedBuilding(null);
  };

  const handleBuildingPress = (building: Buildings) => {
    setSelectedBuilding(building);
  };

  const mapRef = useRef<MapView>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
          mayShowUserSettingsDialog: true,
        });

        if (cancelled) return;

        setUserCoords({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        setLocationError(null);
      } catch (err) {
        void err;
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

  useEffect(() => {
    if (!mapReady) return;

    if (focusTarget === "user") {
      if (!userCoords) return;
      mapRef.current?.animateToRegion(
        {
          ...userCoords,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        250,
      );
      return;
    }

    mapRef.current?.animateToRegion(
      {
        ...coordinates,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      250,
    );
  }, [focusTarget, coordinates, userCoords, mapReady]);

  useEffect(() => {
    if (selectedBuilding && mapReady) {
      mapRef.current?.animateToRegion(
        {
          latitude:
            selectedBuilding.coordinates.latitude -
            SELECTED_BUILDING_LAT_OFFSET,
          longitude: selectedBuilding.coordinates.longitude,
          latitudeDelta: SELECTED_BUILDING_DELTA,
          longitudeDelta: SELECTED_BUILDING_DELTA,
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

  return (
    <View style={styles.container}>
      <MapView
        key={`${coordinates.latitude}-${coordinates.longitude}`}
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
        initialRegion={{
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {userCoords ? <CurrentLocationMarker coordinate={userCoords} /> : null}
        {BUILDINGS.map((building) => {
          const isSelected = selectedBuilding?.name === building.name;
          const isCurrent = currentBuilding?.name === building.name;
          const style = getPolygonStyle(isCurrent, isSelected);

          if (!building.boundingBox || building.boundingBox.length === 0) {
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
              tappable={true}
              onPress={(e) => {
                e.stopPropagation();
                handleBuildingPress(building);
              }}
            />
          );
        })}
      </MapView>

      {locationError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      ) : null}

      <BuildingInfoPopup
        building={selectedBuilding}
        onClose={() => setSelectedBuilding(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorBanner: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 40,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.error,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  errorText: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    textAlign: "center",
  },
});
