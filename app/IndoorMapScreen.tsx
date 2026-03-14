import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import Svg, { Circle, Polygon, Polyline, Text as SvgText } from "react-native-svg";
import { borderRadius, colors, spacing, typography } from "../constants/theme";
import { Floor, parseGeoJSONToFloor } from "../utils/IndoorMapComposite";
import {
  buildIndoorPathData,
  findShortestIndoorPath,
  getPathDistance,
} from "../utils/indoorNavigation";
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
  const [startNodeId, setStartNodeId] = useState<string | null>(null);
  const [destinationNodeId, setDestinationNodeId] = useState<string | null>(null);
  const [selectingMode, setSelectingMode] = useState<"start" | "destination">("start");
  const [startSearchQuery, setStartSearchQuery] = useState("");
  const [destinationSearchQuery, setDestinationSearchQuery] = useState("");

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
      setStartNodeId(null);
      setDestinationNodeId(null);
      setStartSearchQuery("");
      setDestinationSearchQuery("");
      setSelectingMode("start");
    } else {
      setFloorComposite(null);
      setStartNodeId(null);
      setDestinationNodeId(null);
      setStartSearchQuery("");
      setDestinationSearchQuery("");
      setSelectingMode("start");
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

  const indoorPathData = useMemo(() => {
    if (!floorComposite) return null;
    return buildIndoorPathData(floorComposite, buildingName || "MB", selectedFloor);
  }, [floorComposite, buildingName, selectedFloor]);

  const shortestPath = useMemo(() => {
    if (!indoorPathData || !startNodeId || !destinationNodeId) return [];
    return findShortestIndoorPath(indoorPathData.graph, startNodeId, destinationNodeId);
  }, [indoorPathData, startNodeId, destinationNodeId]);

  const selectableNodes = useMemo(() => {
    if (!indoorPathData) return [];

    return Object.values(indoorPathData.selectableByName).sort((first, second) =>
      first.name.localeCompare(second.name)
    );
  }, [indoorPathData]);

  const startSearchResults = useMemo(() => {
    const normalizedQuery = startSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return selectableNodes
      .filter((node) => node.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [startSearchQuery, selectableNodes]);

  const destinationSearchResults = useMemo(() => {
    const normalizedQuery = destinationSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) return [];

    return selectableNodes
      .filter((node) => node.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [destinationSearchQuery, selectableNodes]);

  const selectedNames = useMemo(() => {
    if (!indoorPathData) {
      return { start: null as string | null, destination: null as string | null };
    }

    const idToName = Object.values(indoorPathData.selectableByName).reduce<Record<string, string>>(
      (acc, node) => {
        acc[node.id] = node.name;
        return acc;
      },
      {}
    );

    return {
      start: startNodeId ? idToName[startNodeId] || null : null,
      destination: destinationNodeId ? idToName[destinationNodeId] || null : null,
    };
  }, [indoorPathData, startNodeId, destinationNodeId]);

  const totalDistance = useMemo(() => {
    if (!indoorPathData || shortestPath.length === 0) return 0;
    return getPathDistance(indoorPathData.graph, shortestPath);
  }, [indoorPathData, shortestPath]);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
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

  const handleNodePress = (nodeId: string) => {
    if (selectingMode === "start") {
      setStartNodeId(nodeId);
      setSelectingMode("destination");
      return;
    }

    setDestinationNodeId(nodeId);
  };

  const handleStartSearchSelection = (nodeId: string, nodeName: string) => {
    setStartNodeId(nodeId);
    setStartSearchQuery(nodeName);
    setSelectingMode("destination");
  };

  const handleDestinationSearchSelection = (nodeId: string, nodeName: string) => {
    setDestinationNodeId(nodeId);
    setDestinationSearchQuery(nodeName);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}> 🏛️ Inside {buildingName} Building</Text>
      </View>

      <View style={styles.searchContainer}>
        <Text style={styles.searchLabel}>Start</Text>
        <TextInput
          placeholder="Search start class/room"
          placeholderTextColor={colors.gray500}
          value={startSearchQuery}
          onChangeText={setStartSearchQuery}
          style={styles.searchInput}
        />
        {startSearchResults.length > 0 && (
          <View style={styles.searchResults}>
            {startSearchResults.map((node) => (
              <Pressable
                key={`start-${node.id}`}
                onPress={() => handleStartSearchSelection(node.id, node.name)}
                style={styles.searchResultButton}
              >
                <Text style={styles.searchResultText}>{node.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.searchLabel}>Destination</Text>
        <TextInput
          placeholder="Search destination class/room"
          placeholderTextColor={colors.gray500}
          value={destinationSearchQuery}
          onChangeText={setDestinationSearchQuery}
          style={styles.searchInput}
        />
        {destinationSearchResults.length > 0 && (
          <View style={styles.searchResults}>
            {destinationSearchResults.map((node) => (
              <Pressable
                key={`dest-${node.id}`}
                onPress={() => handleDestinationSearchSelection(node.id, node.name)}
                style={styles.searchResultButton}
              >
                <Text style={styles.searchResultText}>{node.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
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

      <View style={styles.selectionBar}>
        <Pressable
          onPress={() => setSelectingMode("start")}
          style={[
            styles.selectionButton,
            selectingMode === "start" && styles.selectionButtonActive,
          ]}
        >
          <Text
            style={[
              styles.selectionButtonText,
              selectingMode === "start" && styles.selectionButtonTextActive,
            ]}
          >
            Select Start
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSelectingMode("destination")}
          style={[
            styles.selectionButton,
            selectingMode === "destination" && styles.selectionButtonActive,
          ]}
        >
          <Text
            style={[
              styles.selectionButtonText,
              selectingMode === "destination" && styles.selectionButtonTextActive,
            ]}
          >
            Select Destination
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setStartNodeId(null);
            setDestinationNodeId(null);
            setStartSearchQuery("");
            setDestinationSearchQuery("");
            setSelectingMode("start");
          }}
          style={styles.selectionButton}
        >
          <Text style={styles.selectionButtonText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.selectionStateBar}>
        <Text style={styles.selectionStateText}>
          Start: {selectedNames.start || "Not selected"}
        </Text>
        <Text style={styles.selectionStateText}>
          Destination: {selectedNames.destination || "Not selected"}
        </Text>
      </View>

      {totalDistance > 0 && (
        <View style={styles.distanceBar}>
          <Text style={styles.distanceText}>Distance: {Math.round(totalDistance)} px</Text>
        </View>
      )}

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
                        const selectableNode = indoorPathData?.selectableByName[node.getName()];
                        
                        return (
                          <React.Fragment key={`${node.getName()}-${centroid.join(',')}`}>
                            <Polygon
                              points={polygonPoints}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth="2"
                              onPress={() => {
                                if (node.getType() !== "room") return;
                                if (selectableNode) {
                                  handleNodePress(selectableNode.id);
                                }
                              }}
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

                      {indoorPathData && shortestPath.length > 1 && (
                        <Polyline
                          points={shortestPath
                            .map((nodeId) => {
                              const graphNode = indoorPathData.graph.nodes[nodeId];
                              return `${graphNode.x},${graphNode.y}`;
                            })
                            .join(" ")}
                          fill="none"
                          stroke={colors.primary}
                          strokeWidth="12"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      )}

                      {indoorPathData && startNodeId && indoorPathData.graph.nodes[startNodeId] && (
                        <Circle
                          cx={indoorPathData.graph.nodes[startNodeId].x}
                          cy={indoorPathData.graph.nodes[startNodeId].y}
                          r={18}
                          fill={colors.primaryDark}
                        />
                      )}

                      {indoorPathData && destinationNodeId && indoorPathData.graph.nodes[destinationNodeId] && (
                        <Circle
                          cx={indoorPathData.graph.nodes[destinationNodeId].x}
                          cy={indoorPathData.graph.nodes[destinationNodeId].y}
                          r={18}
                          fill={colors.secondaryDark}
                        />
                      )}
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
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.offWhite,
  },
  searchLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontSize: typography.caption.fontSize,
    color: colors.gray700,
    fontWeight: typography.button.fontWeight,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.black,
  },
  searchResults: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  searchResultButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  searchResultText: {
    fontSize: typography.body.fontSize,
    color: colors.secondaryDark,
    fontWeight: typography.body.fontWeight,
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
    borderRadius: borderRadius.sm,
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
  selectionBar: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.offWhite,
  },
  selectionButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  selectionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  selectionButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
    color: colors.primary,
  },
  selectionButtonTextActive: {
    color: colors.white,
  },
  selectionStateBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.offWhite,
  },
  selectionStateText: {
    fontSize: typography.caption.fontSize,
    color: colors.gray700,
    marginBottom: spacing.xs,
  },
  distanceBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.offWhite,
  },
  distanceText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    color: colors.secondaryDark,
  },

});