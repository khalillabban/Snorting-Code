import React, { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import { colors, spacing, typography } from "../constants/theme";
import { Buildings, Location } from "../constants/type";
import { BuildingInfoPopup } from "./BuildingInfoPopup";

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

export default function CampusMap({ coordinates }: { coordinates: Location }) {
  const [selectedBuilding, setSelectedBuilding] = useState<Buildings | null>(
    null,
  );

  const handleMapPress = () => {
    // Can also close the popup if tapped on empty map area
    if (selectedBuilding) setSelectedBuilding(null);
  };

  const handleBuildingPress = (building: Buildings) => {
    console.log("Selected:", building.name);
    setSelectedBuilding(building);
  };

  const mapRef = useRef<MapView>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    // Pin user location to current Concordia campus (for demo/testing)
    const campusUserCoords = {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
    setUserCoords(campusUserCoords);
    setLocationError(null);
    mapRef.current?.animateToRegion(
      {
        ...campusUserCoords,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      250,
    );
  }, [coordinates.latitude, coordinates.longitude]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        showsMyLocationButton
        onPress={handleMapPress}
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
              fillColor={
                isSelected ? colors.primary : colors.primaryTransparent
              }
              strokeColor={colors.primary}
              strokeWidth={isSelected ? 3 : 2}
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
    borderRadius: 8,
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
