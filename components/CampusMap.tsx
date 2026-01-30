import { StyleSheet, View } from "react-native";
import MapView from "react-native-maps";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function CampusMap({ coordinates }: { coordinates: Coordinates }) {
  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation
        showsMyLocationButton
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
