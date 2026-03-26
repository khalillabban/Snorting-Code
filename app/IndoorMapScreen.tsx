import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { IndoorPOIFilter } from "../components/IndoorPOIFilter";
import { IndoorPOIOverlay } from "../components/IndoorPOIOverlay";
import {
  IndoorDirectionsPanel,
  IndoorRouteOverlay,
} from "../components/IndoorRouteOverlay";
import { type POICategoryId } from "../constants/indoorPOI";
import { colors, spacing } from "../constants/theme";
import { USABILITY_TESTING_ENABLED } from "../constants/usabilityConfig";
import { styles } from "../styles/IndoorMapScreen.styles";
import {
  getNormalizedBuildingPlan,
  type IndoorRoomRecord,
} from "../utils/indoorBuildingPlan";
import {
  getIndoorNavigationRoute,
  NavigationRoute,
} from "../utils/indoorNavigation";
import { getIndoorPOIs } from "../utils/indoorPOI";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import { getFloorImageMetadata } from "../utils/mapAssets";
import { parseFloors } from "../utils/routeParams";
import { logUsabilityEvent } from "../utils/usabilityAnalytics";

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
    Math.min(...currentFloorRooms.map((room) => room.x)) -
      FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.width,
  );
  const rawMaxX = clamp(
    Math.max(...currentFloorRooms.map((room) => room.x)) +
      FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.width,
  );
  const rawMinY = clamp(
    Math.min(...currentFloorRooms.map((room) => room.y)) -
      FLOOR_CONTENT_PADDING,
    0,
    floorImageDimensions.height,
  );
  const rawMaxY = clamp(
    Math.max(...currentFloorRooms.map((room) => room.y)) +
      FLOOR_CONTENT_PADDING,
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
  const availableHeight = Math.max(
    viewport.height - FLOOR_FRAME_PADDING * 2,
    1,
  );
  const contentWidth = Math.max(floorBounds.maxX - floorBounds.minX, 1);
  const contentHeight = Math.max(floorBounds.maxY - floorBounds.minY, 1);
  const scale = Math.min(
    availableWidth / contentWidth,
    availableHeight / contentHeight,
  );
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

function trimParam(val: unknown): string {
  return typeof val === "string" ? val.trim() : "";
}

function useFloorSync(
  availableFloors: number[],
  selectedFloor: number,
  setSelectedFloor: (f: number) => void,
) {
  useEffect(() => {
    if (
      availableFloors.length > 0 &&
      !availableFloors.includes(selectedFloor)
    ) {
      setSelectedFloor(availableFloors[0] || 1);
    }
  }, [availableFloors, selectedFloor, setSelectedFloor]);
}

function useInitialRoomQuery(
  initialRoomQuery: string,
  availableFloors: number[],
  setSearchQuery: (q: string) => void,
  performRoomSearch: (q: string, floor: number) => void,
) {
  useEffect(() => {
    if (!initialRoomQuery) return;
    setSearchQuery(initialRoomQuery);
    performRoomSearch(initialRoomQuery, availableFloors[0] || 1);
  }, [availableFloors, initialRoomQuery, performRoomSearch, setSearchQuery]);
}

function useNavAutoTrigger(
  buildingName: string | undefined,
  navOrigin: string | undefined,
  navDest: string | undefined,
  handleNavigate: () => void,
) {
  useEffect(() => {
    if (buildingName && trimParam(navOrigin) && trimParam(navDest)) {
      handleNavigate();
    }
  }, []);
}

export default function IndoorMapScreen() {
  const {
    buildingName,
    floors,
    roomQuery,
    navOrigin,
    navDest,
    accessibleOnly: accessibleOnlyParam,
  } = useLocalSearchParams<{
    buildingName: string;
    floors: string;
    roomQuery?: string;
    navOrigin?: string;
    navDest?: string;
    accessibleOnly?: string;
  }>();

  // Accessibility mode state
  const [accessibleOnly, setAccessibleOnly] = useState(
    accessibleOnlyParam === "true",
  );
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

  const [navOriginQuery, setNavOriginQuery] = useState(
    typeof navOrigin === "string" ? navOrigin.trim() : "",
  );
  const [navDestQuery, setNavDestQuery] = useState(
    typeof navDest === "string" ? navDest.trim() : "",
  );
  const [navError, setNavError] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<NavigationRoute | null>(null);
  const [activePOICategories, setActivePOICategories] = useState<
    Set<POICategoryId>
  >(new Set());

  // Usability Testing: Session + Task timers
  const sessionId = useRef(`session_${Date.now()}_${Crypto.randomUUID()}`);
  const task11Completed = useRef(false);
  const screenLoadTime = useRef<number>(Date.now());
  const taskTimers = useRef<Record<string, number>>({});

  const startTask = useCallback((taskId: string) => {
    if (!USABILITY_TESTING_ENABLED) return;
    taskTimers.current[taskId] = Date.now();
  }, []);

  const endTask = useCallback(
    async (taskId: string, extraParams: Record<string, unknown> = {}) => {
      const start = taskTimers.current[taskId];
      const duration_ms = start ? Date.now() - start : 0;
      delete taskTimers.current[taskId];
      try {
        if (!USABILITY_TESTING_ENABLED) return;
        await logUsabilityEvent("task_completed", {
          session_id: sessionId.current,
          task_id: taskId,
          duration_ms,
          ...extraParams,
        });
      } catch (error) {
        console.error("Firebase Analytics Error: ", error);
      }
    },
    [],
  );

  const navAttemptCount = useRef(0);

  // Lets us distinguish Task 10 (accessible) from Task 9 (standard) in events.
  const accessibleToggledDuringNav = useRef(false);

  // Task 9 + 10: Screen load — starts the Task 9 timer
  useEffect(() => {
    const run = async () => {
      screenLoadTime.current = Date.now();
      startTask("task_9");
      try {
        await logUsabilityEvent("indoor_map_screen_loaded", {
          session_id: sessionId.current,
          building_name: buildingName ?? "unknown",
          has_nav_origin: !!trimParam(navOrigin),
          has_nav_dest: !!trimParam(navDest),
          accessible_only_param: accessibleOnlyParam === "true",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Firebase Analytics Error: ", error);
      }
    };
    run();
  }, []);

  const initialRoomQuery = trimParam(roomQuery);
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

  const allPOIs = buildingName ? getIndoorPOIs(buildingName) : [];

  const handlePOIToggle = useCallback(
    (categoryId: POICategoryId) => {
      const willBeActive = !activePOICategories.has(categoryId);
      const newCount = activePOICategories.size + (willBeActive ? 1 : -1);

      setActivePOICategories((prev) => {
        const next = new Set(prev);
        if (next.has(categoryId)) {
          next.delete(categoryId);
        } else {
          next.add(categoryId);
        }
        return next;
      });

      // Log analytics after state update calculation
      try {
        logUsabilityEvent("indoor_poi_category_toggled", {
          session_id: sessionId.current,
          building_name: buildingName ?? "unknown",
          category_id: categoryId,
          is_now_active: willBeActive,
          active_category_count: newCount,
          active_categories: Array.from(
            willBeActive
              ? new Set([...activePOICategories, categoryId])
              : new Set(
                  [...activePOICategories].filter((c) => c !== categoryId),
                ),
          )
            .sort((a, b) => a.localeCompare(b))
            .join(","),
          floor: selectedFloor,
          time_since_screen_load_ms: Date.now() - screenLoadTime.current,
        }).catch((error) => {
          console.error("Firebase Analytics Error: ", error);
        });

        // Task 11: Complete on first successful activation
        if (willBeActive && !task11Completed.current) {
          task11Completed.current = true;
          endTask("task_11", {
            building_name: buildingName ?? "unknown",
            first_category_activated: categoryId,
            floor: selectedFloor,
            time_since_screen_load_ms: Date.now() - screenLoadTime.current,
          }).catch((error) => {
            console.error("Firebase Analytics Error: ", error);
          });
        }
      } catch (error) {
        console.error("Firebase Analytics Error: ", error);
      }
    },
    [buildingName, endTask, selectedFloor, activePOICategories],
  );
  const handlePOIFilterFirstInteraction = useCallback(async () => {
    await logUsabilityEvent("indoor_poi_filter_bar_first_tap", {
      session_id: sessionId.current,
      building_name: buildingName ?? "unknown",
      floor: selectedFloor,
      time_since_screen_load_ms: Date.now() - screenLoadTime.current,
    });
  }, [buildingName, selectedFloor]);

  useFloorSync(availableFloors, selectedFloor, setSelectedFloor);

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
    () =>
      floorImageMetadata?.showFullImage
        ? {
            minX: 0,
            minY: 0,
            maxX: floorImageDimensions.width,
            maxY: floorImageDimensions.height,
          }
        : getFloorContentBounds(floorImageDimensions, scaledCurrentFloorRooms),
    [
      floorImageDimensions,
      floorImageMetadata?.showFullImage,
      scaledCurrentFloorRooms,
    ],
  );

  const effectiveViewport = useMemo<FloorViewport>(
    () => ({
      width: mapViewport.width || Math.max(windowWidth, 320),
      height:
        mapViewport.height ||
        Math.max(windowHeight * 0.44, DEFAULT_VIEWPORT_HEIGHT),
    }),
    [mapViewport, windowHeight, windowWidth],
  );

  const floorStageLayout = useMemo(
    () =>
      getFloorStageLayout(effectiveViewport, floorImageDimensions, floorBounds),
    [effectiveViewport, floorBounds, floorImageDimensions],
  );

  const showFloorImageMap = floorImageAsset != null;
  const showNoMapMessage = !showFloorImageMap;

  const selectedRoomOnCurrentFloor = useMemo(() => {
    if (!selectedRoom || selectedRoom.floor !== selectedFloor) return null;
    return {
      ...selectedRoom,
      x: selectedRoom.x * coordinateScale,
      y: selectedRoom.y * coordinateScale,
    };
  }, [coordinateScale, selectedFloor, selectedRoom]);

  const selectedRoomMarkerPosition = useMemo(() => {
    if (!selectedRoomOnCurrentFloor) return null;
    return {
      left:
        floorStageLayout.frameLeft +
        (selectedRoomOnCurrentFloor.x - floorBounds.minX) *
          floorStageLayout.scale -
        MARKER_SIZE / 2,
      top:
        floorStageLayout.frameTop +
        (selectedRoomOnCurrentFloor.y - floorBounds.minY) *
          floorStageLayout.scale -
        MARKER_SIZE / 2,
    };
  }, [
    floorBounds.minX,
    floorBounds.minY,
    floorStageLayout,
    selectedRoomOnCurrentFloor,
  ]);

  const performRoomSearch = useCallback(
    (rawQuery: string, currentFloor: number) => {
      const trimmedQuery = rawQuery.trim();

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
        setSearchError(
          `Room \"${trimmedQuery}\" was not found in ${buildingName}.`,
        );
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

  useInitialRoomQuery(
    initialRoomQuery,
    availableFloors,
    setSearchQuery,
    performRoomSearch,
  );

  const handleNavigate = useCallback(async () => {
    if (!buildingName) return;
    setNavError(null);

    navAttemptCount.current += 1;

    //  Task 9 + 10: Log every "Go" tap

    await logUsabilityEvent("indoor_nav_attempted", {
      session_id: sessionId.current,
      building_name: buildingName,
      origin_query: navOriginQuery,
      dest_query: navDestQuery,
      accessible_only: accessibleOnly,
      attempt_number: navAttemptCount.current,
      time_since_screen_load_ms: Date.now() - screenLoadTime.current,
    });

    const result = getIndoorNavigationRoute(
      buildingName,
      navOriginQuery,
      navDestQuery,
      { accessibleOnly },
    );

    if (result.success) {
      setActiveRoute(result.route);
      setSelectedFloor(result.route.origin.floor);

      // Task 9 + 10: Route success
      const taskId = accessibleOnly ? "task_10" : "task_9";
      await logUsabilityEvent("indoor_route_generated", {
        session_id: sessionId.current,
        building_name: buildingName,
        origin: navOriginQuery,
        destination: navDestQuery,
        accessible_only: accessibleOnly,
        accessible_toggled_during_nav: accessibleToggledDuringNav.current,
        attempt_count: navAttemptCount.current,
        origin_floor: result.route.origin.floor,
        dest_floor:
          result.route.destination?.floor ?? result.route.origin.floor,
        cross_floor:
          result.route.origin.floor !==
          (result.route.destination?.floor ?? result.route.origin.floor),
        time_since_screen_load_ms: Date.now() - screenLoadTime.current,
      });
      endTask(taskId, {
        building_name: buildingName,
        accessible_only: accessibleOnly,
        attempt_count: navAttemptCount.current,
      });
    } else {
      setNavError(result.message);
      setActiveRoute(null);

      // Task 9 + 10: Route failure
      await logUsabilityEvent("indoor_route_failed", {
        session_id: sessionId.current,
        building_name: buildingName,
        origin_query: navOriginQuery,
        dest_query: navDestQuery,
        accessible_only: accessibleOnly,
        attempt_number: navAttemptCount.current,
        error_message: result.message,
      });
    }
  }, [buildingName, navOriginQuery, navDestQuery, accessibleOnly, endTask]);

  useNavAutoTrigger(buildingName, navOrigin, navDest, handleNavigate);

  //  Task 10: Accessibility toggle
  const handleAccessibleToggle = useCallback(async () => {
    const newValue = !accessibleOnly;
    setAccessibleOnly(newValue);
    accessibleToggledDuringNav.current = true;

    if (newValue) {
      navAttemptCount.current = 0;
      startTask("task_10");
    }

    await logUsabilityEvent("indoor_accessible_mode_toggled", {
      session_id: sessionId.current,
      building_name: buildingName ?? "unknown",
      accessible_only: newValue,
      has_active_route: activeRoute !== null,
      origin_query: navOriginQuery,
      dest_query: navDestQuery,
      time_since_screen_load_ms: Date.now() - screenLoadTime.current,
    });
  }, [
    accessibleOnly,
    activeRoute,
    buildingName,
    navDestQuery,
    navOriginQuery,
    startTask,
  ]);

  //  Task 9 + 10: Directions panel closed
  const handleCloseDirectionsPanel = useCallback(() => {
    setActiveRoute(null);
    logUsabilityEvent("indoor_directions_panel_closed", {
      session_id: sessionId.current,
      building_name: buildingName ?? "unknown",
      accessible_only: accessibleOnly,
      time_since_screen_load_ms: Date.now() - screenLoadTime.current,
    }).catch((error) => {
      console.error("Firebase Analytics Error: ", error);
    });
  }, [accessibleOnly, activeRoute, buildingName]);

  return (
    <View style={styles.container}>
      <View style={styles.searchPanel}>
        <View style={styles.titleRow}>
          <Text style={styles.buildingTitle}>{buildingName} Building</Text>
          <Pressable
            testID="indoor-accessible-mode-toggle"
            accessibilityRole="switch"
            accessibilityState={{ checked: accessibleOnly }}
            accessibilityLabel="Toggle accessible route"
            onPress={handleAccessibleToggle}
            style={[
              styles.accessibleToggle,
              accessibleOnly && styles.accessibleToggleActive,
            ]}
          >
            <MaterialCommunityIcons
              name="wheelchair-accessibility"
              size={18}
              color={accessibleOnly ? colors.white : colors.primary}
            />
            <Text
              style={[
                styles.accessibleToggleText,
                accessibleOnly && styles.accessibleToggleTextActive,
              ]}
            >
              Accessible
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="From (H-110)"
            placeholderTextColor={colors.gray500}
            value={navOriginQuery}
            onChangeText={(text) => {
              setNavOriginQuery(text);
              // Task 9 + 10: First keystroke in origin field
              if (text.length === 1) {
                logUsabilityEvent("indoor_nav_origin_started", {
                  session_id: sessionId.current,
                  building_name: buildingName ?? "unknown",
                  time_since_screen_load_ms:
                    Date.now() - screenLoadTime.current,
                }).catch((error) => {
                  console.error("Firebase Analytics Error: ", error);
                });
              }
            }}
            returnKeyType="next"
          />
          <TextInput
            style={styles.searchInput}
            placeholder="To (H-920)"
            placeholderTextColor={colors.gray500}
            value={navDestQuery}
            onChangeText={(text) => {
              setNavDestQuery(text);
              // Task 9 + 10: First keystroke in destination field
              if (text.length === 1) {
                logUsabilityEvent("indoor_nav_dest_started", {
                  session_id: sessionId.current,
                  building_name: buildingName ?? "unknown",
                  time_since_screen_load_ms:
                    Date.now() - screenLoadTime.current,
                }).catch((error) => {
                  console.error("Firebase Analytics Error: ", error);
                });
              }
            }}
            returnKeyType="go"
            onSubmitEditing={handleNavigate}
          />
          <Pressable style={styles.searchButton} onPress={handleNavigate}>
            <Text style={styles.searchButtonText}>Go</Text>
          </Pressable>
        </View>

        {navError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{navError}</Text>
          </View>
        )}

        {selectedRoom && !activeRoute && (
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
              onPress={() => {
                setSelectedFloor(floor);
                // Task 9 + 10: Floor changed
                logUsabilityEvent("indoor_floor_changed", {
                  session_id: sessionId.current,
                  building_name: buildingName ?? "unknown",
                  floor_selected: floor,
                  previous_floor: selectedFloor,
                  has_active_route: activeRoute !== null,
                }).catch((error) => {
                  console.error("Firebase Analytics Error: ", error);
                });
              }}
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

      <IndoorPOIFilter
        activeCategories={activePOICategories}
        onToggle={handlePOIToggle}
        onFirstInteraction={handlePOIFilterFirstInteraction}
      />

      <View
        testID="indoor-map-container"
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

            {activeRoute && (
              <IndoorRouteOverlay
                route={activeRoute}
                floor={selectedFloor}
                coordinateScale={coordinateScale}
                stageLayout={floorStageLayout}
                floorBounds={floorBounds}
                accessibleOnly={accessibleOnly}
              />
            )}

            {activePOICategories.size > 0 && (
              <IndoorPOIOverlay
                pois={allPOIs}
                floor={selectedFloor}
                coordinateScale={coordinateScale}
                stageLayout={floorStageLayout}
                floorBounds={floorBounds}
                activeCategories={activePOICategories}
              />
            )}

            {selectedRoomMarkerPosition && !activeRoute && (
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

      {activeRoute && (
        <IndoorDirectionsPanel
          route={activeRoute}
          onClose={handleCloseDirectionsPanel}
        />
      )}
    </View>
  );
}
