import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function CampusMap({
  coordinates,
}: {
  coordinates: Coordinates;
}) {
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    mapRef.current?.animateToRegion(
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      250 // ms
    );
  }, [coordinates]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});