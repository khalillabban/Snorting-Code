import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";
import { colors, spacing, typography } from "../constants/theme";
import {
  compactIndoorSearchKey,
  getNormalizedBuildingPlan,
  type IndoorRoomRecord,
} from "../utils/indoorBuildingPlan";
import { Floor, parseGeoJSONToFloor } from "../utils/IndoorMapComposite";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import {
  getFloorImageAsset,
  getLegacyFloorGeoJsonAsset,
} from "../utils/mapAssets";
import { parseFloors } from "../utils/routeParams";

function getFloorImageDimensions(
  floorImageAsset: number | undefined,
  currentFloorRooms: IndoorRoomRecord[],
) {
  let resolvedWidth: number | undefined;
  let resolvedHeight: number | undefined;

  if (floorImageAsset) {
    try {
      const resolvedAsset = Image.resolveAssetSource(floorImageAsset);
      resolvedWidth = resolvedAsset?.width;
      resolvedHeight = resolvedAsset?.height;
    } catch {
      resolvedWidth = undefined;
      resolvedHeight = undefined;
    }
  }

  return {
    width:
      resolvedWidth ??
      Math.max(1200, ...currentFloorRooms.map((room) => room.x + 80)),
    height:
      resolvedHeight ??
      Math.max(900, ...currentFloorRooms.map((room) => room.y + 80)),
  };
}

export default function IndoorMapScreen() {
  const { buildingName, floors } = useLocalSearchParams<{
    buildingName: string;
    floors: string;
  }>();
  const availableFloors = parseFloors(floors);
  const [selectedFloor, setSelectedFloor] = useState(availableFloors[0] || 1);
  const [floorComposite, setFloorComposite] = useState<Floor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<IndoorRoomRecord | null>(
    null,
  );

  const mapKey = `${buildingName}-${selectedFloor}`;
  const geoAsset = getLegacyFloorGeoJsonAsset(buildingName || "", selectedFloor);
  const floorImageAsset = getFloorImageAsset(buildingName || "", selectedFloor);
  const normalizedBuildingPlan = useMemo(
    () => (buildingName ? getNormalizedBuildingPlan(buildingName) : null),
    [buildingName],
  );

  useEffect(() => {
    setSearchQuery("");
    setSearchError(null);
    setSelectedRoom(null);
  }, [buildingName]);

  useEffect(() => {
    if (!availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0] || 1);
    }
  }, [availableFloors, selectedFloor]);

  useEffect(() => {
    if (geoAsset) {
      const floor = parseGeoJSONToFloor(
        geoAsset,
        selectedFloor,
        buildingName || "MB",
      );
      setFloorComposite(floor);
    } else {
      setFloorComposite(null);
    }
  }, [geoAsset, selectedFloor, buildingName]);

  const geoBounds = useMemo(() => {
    if (!floorComposite) {
      return { minX: 0, minY: 0, width: 2048, height: 2048 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    floorComposite.getChildren().forEach((child) => {
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
      height: maxY - minY + padding * 2,
    };
  }, [floorComposite]);

  const currentFloorRooms = useMemo(
    () => normalizedBuildingPlan?.roomsByFloor[selectedFloor] ?? [],
    [normalizedBuildingPlan, selectedFloor],
  );

  const floorImageDimensions = useMemo(
    () => getFloorImageDimensions(floorImageAsset, currentFloorRooms),
    [currentFloorRooms, floorImageAsset],
  );

  const selectedRoomOnCurrentFloor =
    selectedRoom?.floor === selectedFloor ? selectedRoom : null;

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

  const handleRoomSearch = () => {
    const trimmedQuery = searchQuery.trim();

    if (!trimmedQuery) {
      setSelectedRoom(null);
      setSearchError("Enter a room number or room name.");
      return;
    }

    if (!normalizedBuildingPlan) {
      setSelectedRoom(null);
      setSearchError(`Room search is not available for ${buildingName}.`);
      return;
    }

    const match = findIndoorRoomMatch(normalizedBuildingPlan, trimmedQuery, {
      currentFloor: selectedFloor,
    });

    if (!match) {
      setSelectedRoom(null);
      setSearchError(`Room "${trimmedQuery}" was not found in ${buildingName}.`);
      return;
    }

    setSelectedRoom(match.room);
    setSearchQuery(match.room.label);
    setSearchError(null);

    if (match.floor !== selectedFloor) {
      setSelectedFloor(match.floor);
    }
  };

  const isSelectedRoomNode = (nodeName: string) => {
    if (!selectedRoomOnCurrentFloor) return false;

    return selectedRoomOnCurrentFloor.searchKeys.includes(
      compactIndoorSearchKey(nodeName),
    );
  };

  const showLegacyVectorMap = floorComposite != null;
  const showFloorImageMap = !showLegacyVectorMap && floorImageAsset != null;
  const showNoMapMessage = !showLegacyVectorMap && !showFloorImageMap;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}> ðŸ›ï¸ Inside {buildingName} Building</Text>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchRow}>
          <TextInput
            testID="room-search-input"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleRoomSearch}
            placeholder="Search room number or name"
            placeholderTextColor={colors.gray500}
            style={styles.searchInput}
            returnKeyType="search"
          />
          <Pressable
            testID="room-search-button"
            style={styles.searchButton}
            onPress={handleRoomSearch}
          >
            <Text style={styles.searchButtonText}>Find</Text>
          </Pressable>
        </View>

        {selectedRoom && (
          <View style={styles.selectedRoomBanner} testID="selected-room-banner">
            <Text style={styles.selectedRoomText}>
              Showing {selectedRoom.label} on floor {selectedRoom.floor}
            </Text>
          </View>
        )}

        {searchError && (
          <View style={styles.errorBanner} testID="room-search-error">
            <Text style={styles.errorText}>{searchError}</Text>
          </View>
        )}
      </View>

      <View style={styles.floorSelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.floorSelector}
        >
          {availableFloors.map((floor: number) => (
            <Pressable
              key={floor}
              testID={`floor-button-${floor}`}
              onPress={() => setSelectedFloor(floor)}
              style={[
                styles.floorButton,
                selectedFloor === floor && styles.floorButtonActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedFloor === floor }}
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
        {showLegacyVectorMap ? (
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
                  <View
                    style={{
                      width: geoBounds.width,
                      height: geoBounds.height,
                    }}
                  >
                    <Svg
                      width={geoBounds.width}
                      height={geoBounds.height}
                      viewBox={`${geoBounds.minX} ${geoBounds.minY} ${geoBounds.width} ${geoBounds.height}`}
                    >
                      {floorComposite.getChildren().map((node) => {
                        const coords = node.getCoordinates();
                        const polygonPoints = coords
                          .map(([x, y]) => `${x},${y}`)
                          .join(" ");
                        const isHallway = node.getType() === "hallway";
                        const isSelectedRoom =
                          node.getType() === "room" &&
                          isSelectedRoomNode(node.getName());
                        const fillColor = isSelectedRoom
                          ? colors.secondary
                          : isHallway
                            ? colors.gray100
                            : colors.white;
                        const strokeColor = isSelectedRoom
                          ? colors.primaryDark
                          : isHallway
                            ? colors.gray300
                            : colors.gray100;
                        const centroid = node.getCentroid();

                        return (
                          <React.Fragment
                            key={`${node.getName()}-${centroid.join(",")}`}
                          >
                            <Polygon
                              points={polygonPoints}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth="2"
                            />
                            {node.getName() !== "Elevator Block" &&
                              node.getName() !== "block" && (
                                <SvgText
                                  x={centroid[0]}
                                  y={centroid[1]}
                                  fill={
                                    isSelectedRoom
                                      ? colors.primaryDark
                                      : colors.gray500
                                  }
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
        ) : showFloorImageMap ? (
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
                  <View
                    style={{
                      width: floorImageDimensions.width,
                      height: floorImageDimensions.height,
                    }}
                  >
                    <Image
                      testID="indoor-floor-image"
                      source={floorImageAsset}
                      style={{
                        width: floorImageDimensions.width,
                        height: floorImageDimensions.height,
                      }}
                      resizeMode="contain"
                    />

                    {selectedRoomOnCurrentFloor && (
                      <View
                        testID="selected-room-marker"
                        style={[
                          styles.roomMarker,
                          {
                            left: selectedRoomOnCurrentFloor.x - 14,
                            top: selectedRoomOnCurrentFloor.y - 14,
                          },
                        ]}
                      >
                        <View style={styles.roomMarkerInner} />
                      </View>
                    )}
                  </View>
                </ScrollView>
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        ) : (
          showNoMapMessage && (
            <View style={styles.emptyState}>
              <Text>No map available for {mapKey}</Text>
            </View>
          )
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
  searchPanel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 10,
    backgroundColor: colors.offWhite,
    paddingHorizontal: spacing.md,
    color: colors.gray700,
  },
  searchButton: {
    minWidth: 84,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  searchButtonText: {
    color: colors.white,
    fontWeight: typography.button.fontWeight,
    fontSize: typography.body.fontSize,
  },
  selectedRoomBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.secondaryTransparent,
  },
  selectedRoomText: {
    color: colors.primaryDark,
    fontWeight: typography.button.fontWeight,
  },
  errorBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: "#fde7e7",
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
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
  roomMarker: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.primaryDark,
    backgroundColor: colors.secondaryTransparent,
    alignItems: "center",
    justifyContent: "center",
  },
  roomMarkerInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
