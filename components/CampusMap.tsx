import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Polygon } from "react-native-maps";
import { BUILDINGS } from "../constants/buildings";
import { colors } from "../constants/theme";
import { Buildings, Location } from "../constants/type";
import { BuildingInfoPopup } from "./BuildingInfoPopup";

export default function CampusMap({ coordinates }: { coordinates: Location }) {
  const [selectedBuilding, setSelectedBuilding] = useState<Buildings | null>(null);
  
  const handleMapPress = () => {
    // Can also close the popup if tapped on empty map area
    if (selectedBuilding) setSelectedBuilding(null);
  };

  const handleBuildingPress = (building: Buildings) => {
    console.log("Selected:", building.name);
    setSelectedBuilding(building);
  };

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
    <View style={{flex: 1}}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        showsMyLocationButton
        onPress={handleMapPress}      
      >
        {BUILDINGS.map((building) => {
          const isSelected = selectedBuilding?.name === building.name;
          return (
            <Polygon
              key={building.name}
              coordinates={building.boundingBox}
              fillColor={isSelected ? colors.primary : colors.primaryTransparent}
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
});
