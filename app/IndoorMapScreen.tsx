import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";
import { colors, spacing, typography } from "../constants/theme";
import { Floor, parseGeoJSONToFloor } from "../utils/IndoorMapComposite";
import { parseFloors } from "../utils/routeParams";

export const FLOOR_GEOJSON: Record<string, any> = {
  "MB-1": require("../assets/maps/MB-1.json"),
  "MB--2": require("../assets/maps/MB-S2.json"),
};

export default function IndoorMapScreen() {
  const { buildingName, floors } = useLocalSearchParams<{ buildingName: string; floors: string }>();
  const availableFloors = parseFloors(floors);
  const [selectedFloor, setSelectedFloor] = useState(availableFloors[0] || 1);
  const [floorComposite, setFloorComposite] = useState<Floor | null>(null);

  const mapKey = `${buildingName}-${selectedFloor}`;
  const geoAsset = FLOOR_GEOJSON[mapKey];

  useEffect(() => {
    if (!availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0] || 1);
    }
  }, [availableFloors]);

  // Parse GeoJSON into Composite pattern structure
  useEffect(() => {
    if (geoAsset) {
      const floor = parseGeoJSONToFloor(geoAsset, selectedFloor, buildingName || 'MB');
      setFloorComposite(floor);
    } else {
      setFloorComposite(null);
    }
  }, [geoAsset, selectedFloor, buildingName]);

  // Calculate dimensions from composite tree bounds
  const getBounds = useMemo(() => {
    if (!floorComposite) return { minX: 0, minY: 0, width: 2048, height: 2048 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    floorComposite.getChildren().forEach(child => {
      child.getCoordinates().forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });
    const padding = 50;
    return { 
      minX: minX - padding, 
      minY: minY - padding, 
      width: maxX - minX + padding * 2, 
      height: maxY - minY + padding * 2 
    };
  }, [floorComposite]);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch().withTestId('pinch-gesture')
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}> 🏛️ Inside {buildingName} Building</Text>
      </View>

      <View style={styles.floorSelectorWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floorSelector}>
          {availableFloors.map((floor: number) => (
            <Pressable
              key={floor}
              onPress={() => setSelectedFloor(floor)}
              style={[
                styles.floorButton,
                selectedFloor === floor && styles.floorButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.floorButtonText,
                  selectedFloor === floor && styles.floorButtonTextActive,
                ]}
              >
                {floor}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.mapContainer}>
        {floorComposite ? (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={pinchGesture}>
              <Animated.View style={[{ flex: 1 }, animatedStyle]}>
                <ScrollView 
                  contentContainerStyle={styles.scrollContent}
                  maximumZoomScale={5}
                  minimumZoomScale={1}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <View style={{ width: '100%', height: '100%' }}>
                    <Svg width="100%" height="100%" viewBox={`${getBounds.minX} ${getBounds.minY} ${getBounds.width} ${getBounds.height}`}>
                      {floorComposite.getChildren().map((node) => {
                        const coords = node.getCoordinates();
                        const polygonPoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
                        const isHallway = node.getType() === 'hallway';
                        const fillColor = isHallway ? colors.gray100 : colors.white;
                        const strokeColor = isHallway ? colors.gray300 : colors.gray100;
                        const centroid = node.getCentroid();
                        
                        return (
                          <React.Fragment key={`${node.getName()}-${centroid.join(',')}`}>
                            <Polygon
                              points={polygonPoints}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth="2"
                            />
                            {node.getName() !== 'Elevator Block' && node.getName() !== 'block' && (
                              <SvgText
                                x={centroid[0]}
                                y={centroid[1]}
                                fill={colors.gray500}
                                fontSize="24"
                                fontWeight="bold"
                                textAnchor="middle"
                              >
                                {node.getName()}
                              </SvgText>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </Svg>
                  </View>
                </ScrollView>
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text>No map available for {mapKey}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.secondaryLight,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.secondaryDark,
    marginLeft: spacing.sm,
  },
  floorSelectorWrapper: {
    backgroundColor: colors.offWhite,
  },
  floorSelector: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  floorButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  floorButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  floorButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
    color: colors.primary,
  },
  floorButtonTextActive: {
    color: colors.white,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.gray100,
  },
  scrollContent: {
    flexGrow: 1,
  },

});
