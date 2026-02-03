import React from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Polygon } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import { colors } from "../constants/theme";
import { Location } from "../constants/type";

export default function CampusMap({ coordinates }: { coordinates: Location }) {
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
      >
        {BUILDINGS.map((building) => {
          if (building.boundingBox && building.boundingBox.length > 0) {
            return (
              <Polygon
                key={building.name}
                coordinates={building.boundingBox}
                fillColor={colors.primaryTransparent}
                strokeColor={colors.primary}
                strokeWidth={2}
              />
            );
          }
          return null;
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
