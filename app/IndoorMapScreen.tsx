import { useLocalSearchParams } from "expo-router";
import { Image as ExpoImage } from "expo-image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import {
  getNormalizedBuildingPlan,
  type IndoorRoomRecord,
} from "../utils/indoorBuildingPlan";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import {
  getFloorImageMetadata,
} from "../utils/mapAssets";
import { parseFloors } from "../utils/routeParams";

const FLOOR_FRAME_PADDING = spacing.md;
const FLOOR_CONTENT_PADDING = 120;
const MIN_CONTENT_SPAN = 260;
const MARKER_SIZE = 28;
const DEFAULT_VIEWPORT_HEIGHT = 420;

type FloorViewport = {
  width: number;
  height: number;
};

type FloorBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type FloorStageLayout = {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  imageLeft: number;
  imageTop: number;
  imageWidth: number;
  imageHeight: number;
  scale: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function getFloorImageDimensions(
  floorImageMetadata:
    | {
        width: number;
        height: number;
      }
    | undefined,
  currentFloorRooms: IndoorRoomRecord[],
) {
  return {
    width:
      floorImageMetadata?.width ??
      Math.max(1200, ...currentFloorRooms.map((room) => room.x + 80)),
    height:
      floorImageMetadata?.height ??
      Math.max(900, ...currentFloorRooms.map((room) => room.y + 80)),
  };
}

function getFloorContentBounds(
  floorImageDimensions: { width: number; height: number },
  currentFloorRooms: IndoorRoomRecord[],
): FloorBounds {
  if (currentFloorRooms.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: floorImageDimensions.width,
      maxY: floorImageDimensions.height,
    };
  }

  const rawMinX = clamp(
    Math.min(...currentFloorRooms.map((room) => room.x)) - FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.width,
  );
  const rawMaxX = clamp(
    Math.max(...currentFloorRooms.map((room) => room.x)) + FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.width,
  );
  const rawMinY = clamp(
    Math.min(...currentFloorRooms.map((room) => room.y)) - FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.height,
  );
  const rawMaxY = clamp(
    Math.max(...currentFloorRooms.map((room) => room.y)) + FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.height,
  );

  const centerX = (rawMinX + rawMaxX) / 2;
  const centerY = (rawMinY + rawMaxY) / 2;
  const targetWidth = Math.min(
    floorImageDimensions.width,
    Math.max(rawMaxX - rawMinX, MIN_CONTENT_SPAN),
  );
  const targetHeight = Math.min(
    floorImageDimensions.height,
    Math.max(rawMaxY - rawMinY, MIN_CONTENT_SPAN),
  );
  const minX = clamp(
    centerX - targetWidth / 2,
    0,
    Math.max(floorImageDimensions.width - targetWidth, 0),
  );
  const minY = clamp(
    centerY - targetHeight / 2,
    0,
    Math.max(floorImageDimensions.height - targetHeight, 0),
  );

  return {
    minX,
    minY,
    maxX: minX + targetWidth,
    maxY: minY + targetHeight,
  };
}

function getFloorStageLayout(
  viewport: FloorViewport,
  floorImageDimensions: { width: number; height: number },
  floorBounds: FloorBounds,
): FloorStageLayout {
  const availableWidth = Math.max(viewport.width - FLOOR_FRAME_PADDING * 2, 1);
  const availableHeight = Math.max(viewport.height - FLOOR_FRAME_PADDING * 2, 1);
  const contentWidth = Math.max(floorBounds.maxX - floorBounds.minX, 1);
  const contentHeight = Math.max(floorBounds.maxY - floorBounds.minY, 1);
  const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  const frameWidth = contentWidth * scale;
  const frameHeight = contentHeight * scale;
  const frameLeft = (viewport.width - frameWidth) / 2;
  const frameTop = (viewport.height - frameHeight) / 2;

  return {
    frameLeft,
    frameTop,
    frameWidth,
    frameHeight,
    imageLeft: -floorBounds.minX * scale,
    imageTop: -floorBounds.minY * scale,
    imageWidth: floorImageDimensions.width * scale,
    imageHeight: floorImageDimensions.height * scale,
    scale,
  };
}

export default function IndoorMapScreen() {
  const { buildingName, floors, roomQuery } = useLocalSearchParams<{
    buildingName: string;
    floors: string;
    roomQuery?: string;
  }>();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const availableFloors = useMemo(() => parseFloors(floors), [floors]);
  const [selectedFloor, setSelectedFloor] = useState(availableFloors[0] || 1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<IndoorRoomRecord | null>(
    null,
  );
  const [mapViewport, setMapViewport] = useState<FloorViewport>({
    width: 0,
    height: 0,
  });
  const initialRoomQuery =
    typeof roomQuery === "string" ? roomQuery.trim() : "";

  const mapKey = `${buildingName}-${selectedFloor}`;
  const floorImageMetadata = getFloorImageMetadata(
    buildingName || "",
    selectedFloor,
  );
  const floorImageAsset = floorImageMetadata?.source;
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

  const currentFloorRooms = useMemo(
    () => normalizedBuildingPlan?.roomsByFloor[selectedFloor] ?? [],
    [normalizedBuildingPlan, selectedFloor],
  );
  const coordinateScale = floorImageMetadata?.coordinateScale ?? 1;
  const scaledCurrentFloorRooms = useMemo(
    () =>
      currentFloorRooms.map((room) => ({
        ...room,
        x: room.x * coordinateScale,
        y: room.y * coordinateScale,
      })),
    [coordinateScale, currentFloorRooms],
  );

  const floorImageDimensions = useMemo(
    () => getFloorImageDimensions(floorImageMetadata, scaledCurrentFloorRooms),
    [floorImageMetadata, scaledCurrentFloorRooms],
  );
  const floorBounds = useMemo(
    () => getFloorContentBounds(floorImageDimensions, scaledCurrentFloorRooms),
    [floorImageDimensions, scaledCurrentFloorRooms],
  );

  const effectiveViewport = useMemo<FloorViewport>(
    () => ({
      width:
        mapViewport.width > 0 ? mapViewport.width : Math.max(windowWidth, 320),
      height:
        mapViewport.height > 0
          ? mapViewport.height
          : Math.max(windowHeight * 0.44, DEFAULT_VIEWPORT_HEIGHT),
    }),
    [mapViewport, windowHeight, windowWidth],
  );
  const floorStageLayout = useMemo(
    () => getFloorStageLayout(effectiveViewport, floorImageDimensions, floorBounds),
    [effectiveViewport, floorBounds, floorImageDimensions],
  );

  const showFloorImageMap = floorImageAsset != null;
  const showNoMapMessage = !showFloorImageMap;
  const selectedRoomOnCurrentFloor = useMemo(() => {
    if (!selectedRoom || selectedRoom.floor !== selectedFloor) {
      return null;
    }

    return {
      ...selectedRoom,
      x: selectedRoom.x * coordinateScale,
      y: selectedRoom.y * coordinateScale,
    };
  }, [coordinateScale, selectedFloor, selectedRoom]);

  const selectedRoomMarkerPosition = useMemo(() => {
    if (!selectedRoomOnCurrentFloor) {
      return null;
    }

    return {
      left:
        floorStageLayout.frameLeft +
        (selectedRoomOnCurrentFloor.x - floorBounds.minX) * floorStageLayout.scale -
        MARKER_SIZE / 2,
      top:
        floorStageLayout.frameTop +
        (selectedRoomOnCurrentFloor.y - floorBounds.minY) * floorStageLayout.scale -
        MARKER_SIZE / 2,
    };
  }, [floorBounds.minX, floorBounds.minY, floorStageLayout, selectedRoomOnCurrentFloor]);

  const performRoomSearch = useCallback(
    (rawQuery: string, currentFloor: number) => {
      const trimmedQuery = rawQuery.trim();

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
        currentFloor,
      });

      if (!match) {
        setSelectedRoom(null);
        setSearchError(`Room \"${trimmedQuery}\" was not found in ${buildingName}.`);
        return;
      }

      setSelectedRoom(match.room);
      setSearchQuery(match.room.label);
      setSearchError(null);

      if (match.floor !== currentFloor) {
        setSelectedFloor(match.floor);
      }
    },
    [buildingName, normalizedBuildingPlan],
  );

  const handleRoomSearch = () => {
    performRoomSearch(searchQuery, selectedFloor);
  };

  useEffect(() => {
    if (!initialRoomQuery) {
      return;
    }

    setSearchQuery(initialRoomQuery);
    performRoomSearch(initialRoomQuery, availableFloors[0] || 1);
  }, [availableFloors, initialRoomQuery, performRoomSearch]);

  const floorSummaryText = selectedRoomOnCurrentFloor
    ? `${selectedRoomOnCurrentFloor.label}${
        selectedRoomOnCurrentFloor.roomName
          ? ` - ${selectedRoomOnCurrentFloor.roomName}`
          : ""
      }`
    : normalizedBuildingPlan
      ? "Search a room to pin it on the floor plan."
      : "Floor overview";

  return (
    <View style={styles.container}>
      <View style={styles.searchPanel}>
        <Text style={styles.buildingTitle}>{buildingName} Building</Text>
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

      <View
        style={styles.mapContainer}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setMapViewport({ width, height });
        }}
      >
        {showFloorImageMap ? (
          <View style={styles.mapViewport} testID="indoor-floor-stage">
            <View
              style={[
                styles.floorFrame,
                {
                  left: floorStageLayout.frameLeft,
                  top: floorStageLayout.frameTop,
                  width: floorStageLayout.frameWidth,
                  height: floorStageLayout.frameHeight,
                },
              ]}
            >
              <ExpoImage
                testID="indoor-floor-image"
                source={floorImageAsset}
                style={{
                  position: "absolute",
                  left: floorStageLayout.imageLeft,
                  top: floorStageLayout.imageTop,
                  width: floorStageLayout.imageWidth,
                  height: floorStageLayout.imageHeight,
                }}
                contentFit="fill"
              />
            </View>

            <View style={styles.floorMetaCard}>
              <Text style={styles.floorMetaLabel}>Floor {selectedFloor}</Text>
              <Text
                style={styles.floorMetaText}
                numberOfLines={2}
                testID="selected-room-callout"
              >
                {floorSummaryText}
              </Text>
            </View>

            {selectedRoomMarkerPosition && (
              <View
                testID="selected-room-marker"
                style={[
                  styles.roomMarker,
                  {
                    left: selectedRoomMarkerPosition.left,
                    top: selectedRoomMarkerPosition.top,
                  },
                ]}
              >
                <View style={styles.roomMarkerPulse} />
                <View style={styles.roomMarkerInner} />
              </View>
            )}
          </View>
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.primary,
  },
  titleLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.white,
    letterSpacing: 0.2,
  },
  searchPanel: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  buildingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: spacing.xs,
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
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray300,
  },
  floorSelector: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  floorButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: colors.gray300,
    minWidth: 40,
    alignItems: "center",
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
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  mapViewport: {
    flex: 1,
    position: "relative",
    backgroundColor: "#1e1e1e",
    overflow: "hidden",
    borderRadius: 14,
  },
  floorFrame: {
    position: "absolute",
    overflow: "hidden",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  floorMetaCard: {
    position: "absolute",
    left: spacing.md,
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  floorMetaLabel: {
    color: colors.primaryDark,
    fontWeight: typography.button.fontWeight,
    fontSize: typography.body.fontSize,
    marginBottom: spacing.xs,
  },
  floorMetaText: {
    color: colors.gray700,
    fontSize: typography.body.fontSize,
  },
  roomMarker: {
    position: "absolute",
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  roomMarkerPulse: {
    position: "absolute",
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: colors.secondaryTransparent,
    borderWidth: 3,
    borderColor: colors.secondaryDark,
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

