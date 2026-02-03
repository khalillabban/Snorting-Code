import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { colors, spacing, typography } from "../constants/theme";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const CURRENT_LOCATION_MARKER_TITLE = "You are here";

function CurrentLocationMarker({ coordinate }: { coordinate: Coordinates }) {
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
}: {
  coordinates: Coordinates;
}) {
  const mapRef = useRef<MapView>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);

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
      250
    );
  }, [coordinates.latitude, coordinates.longitude]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        initialRegion={{
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {userCoords ? (
          <CurrentLocationMarker coordinate={userCoords} />
        ) : null}
      </MapView>
      {locationError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      ) : null}
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