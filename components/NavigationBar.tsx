import {
  getFloorGraphData,
  getRoomsForFloor,
  type GraphNode,
} from "@/utils/IndoorNavigationGraph";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { ALL_STRATEGIES, WALKING_STRATEGY } from "../constants/strategies";
import { Buildings } from "../constants/type";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/NavigationBar.styles";
import { getAvailableFloors } from "../utils/mapAssets";

import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { colors } from "../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT =
  Platform.OS === "android" ? SCREEN_HEIGHT * 0.75 : SCREEN_HEIGHT * 0.7;
const SHEET_TOP = SCREEN_HEIGHT - SHEET_HEIGHT;

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchResult =
  | { kind: "building"; building: Buildings }
  | { kind: "room"; room: GraphNode; building: Buildings };

function getSearchResultLabel(result: SearchResult): string {
  if (result.kind === "building") return result.building.displayName;
  return `${result.room.label} — ${result.building.displayName}`;
}

function getSearchResultBuilding(result: SearchResult): Buildings {
  return result.kind === "building" ? result.building : result.building;
}

function getSearchResultRoom(result: SearchResult): GraphNode | null {
  return result.kind === "room" ? result.room : null;
}

// ─── Build unified search index (buildings + all rooms) ──────────────────────

type SearchIndex = SearchResult[];

let _cachedIndex: SearchIndex | null = null;

function getSearchIndex(): SearchIndex {
  if (_cachedIndex) return _cachedIndex;

  const index: SearchIndex = [];

  for (const building of BUILDINGS) {
    index.push({ kind: "building", building });

    // Add rooms if the building has an indoor graph
    const graphKey = building.name.startsWith("MB") ? "MB" : building.name;
    const graphData = getFloorGraphData(graphKey);
    if (!graphData) continue;

    const floors = getAvailableFloors(building.name) ?? [];
    for (const floor of floors) {
      const rooms = getRoomsForFloor(graphData, floor);
      for (const room of rooms) {
        // Only add rooms that belong to this building
        if (
          room.buildingId === building.name ||
          room.buildingId?.startsWith(building.name)
        ) {
          index.push({ kind: "room", room, building });
        }
      }
    }
  }

  _cachedIndex = index;
  return index;
}

function searchIndex(query: string, campusNorm?: string): SearchResult[] {
  const q = query.toLowerCase().trim();
  const index = getSearchIndex();

  return index
    .filter((item) => {
      const label = getSearchResultLabel(item).toLowerCase();
      const buildingName = item.building.name.toLowerCase();
      const campusMatch = campusNorm
        ? (item.building.campusName || "").toLowerCase() === campusNorm
        : true;
      return (label.includes(q) || buildingName.includes(q)) && campusMatch;
    })
    .slice(0, 20);
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NavigationBarProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    start: Buildings | null,
    destination: Buildings | null,
    strategy: RouteStrategy,
    startRoom?: GraphNode | null,
    endRoom?: GraphNode | null,
  ) => void;
  autoStartBuilding?: Buildings | null;
  initialStart?: Buildings | null;
  onInitialStartApplied?: () => void;
  initialDestination?: Buildings | null;
  onInitialDestinationApplied?: () => void;
  currentCampus?: CampusKey;
  onUseMyLocation?: () => Buildings | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NavigationBar({
  visible,
  onClose,
  onConfirm,
  autoStartBuilding,
  initialStart,
  onInitialStartApplied,
  initialDestination,
  onInitialDestinationApplied,
  currentCampus = "sgw",
  onUseMyLocation,
}: Readonly<NavigationBarProps>) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const [startLoc, setStartLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);
  const [startRoom, setStartRoom] = useState<GraphNode | null>(null);
  const [endRoom, setEndRoom] = useState<GraphNode | null>(null);
  const [startManuallyEdited, setStartManuallyEdited] = useState(false);
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([]);
  const [activeInput, setActiveInput] = useState<
    "start" | "destination" | null
  >(null);
  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSummary, setRouteSummary] = useState<{
    duration?: string;
    distance?: string;
  } | null>(null);
  const [routeSummaryLoading, setRouteSummaryLoading] = useState(false);

  useEffect(() => {
    if (!startBuilding || !destBuilding || filteredResults.length > 0) {
      setRouteSummary(null);
      return;
    }
    let cancelled = false;
    setRouteSummaryLoading(true);
    setRouteSummary(null);
    getOutdoorRouteWithSteps(
      startBuilding.coordinates,
      destBuilding.coordinates,
      selectedStrategy,
    )
      .then((res) => {
        if (!cancelled) {
          setRouteSummary({ duration: res.duration, distance: res.distance });
        }
      })
      .catch(() => {
        if (!cancelled) setRouteSummary(null);
      })
      .finally(() => {
        if (!cancelled) setRouteSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startBuilding, destBuilding, selectedStrategy, filteredResults.length]);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.spring(translateY, {
        toValue: SHEET_TOP,
        useNativeDriver: true,
        damping: 20,
        stiffness: 150,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShouldRender(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (autoStartBuilding && !startManuallyEdited) {
      setStartLoc(autoStartBuilding.displayName);
      setStartBuilding(autoStartBuilding);
      setStartRoom(null);
    }
  }, [autoStartBuilding, startManuallyEdited]);

  useEffect(() => {
    if (visible && initialStart) {
      setStartLoc(initialStart.displayName);
      setStartBuilding(initialStart);
      setStartRoom(null);
      onInitialStartApplied?.();
    }
  }, [visible, initialStart, onInitialStartApplied]);

  useEffect(() => {
    if (visible && initialDestination) {
      setDestLoc(initialDestination.displayName);
      setDestBuilding(initialDestination);
      setEndRoom(null);
      onInitialDestinationApplied?.();
    }
  }, [visible, initialDestination, onInitialDestinationApplied]);

  const handleSearch = (text: string, type: "start" | "destination") => {
    setActiveInput(type);
    if (type === "start") {
      setStartManuallyEdited(true);
      setStartLoc(text);
      setStartRoom(null);
    } else {
      setDestLoc(text);
      setEndRoom(null);
    }

    if (text.length > 0) {
      setFilteredResults(searchIndex(text));
    } else {
      setFilteredResults([]);
    }
  };

  const selectResult = (result: SearchResult) => {
    const building = getSearchResultBuilding(result);
    const room = getSearchResultRoom(result);

    if (activeInput === "start") {
      setStartLoc(getSearchResultLabel(result));
      setStartBuilding(building);
      setStartRoom(room);
    } else {
      setDestLoc(getSearchResultLabel(result));
      setDestBuilding(building);
      setEndRoom(room);
    }
    setFilteredResults([]);
    Keyboard.dismiss();
  };

  const showBuildingPicker = (type: "start" | "destination") => {
    if (activeInput === type && filteredResults.length > 0) {
      setFilteredResults([]);
      setActiveInput(null);
      return;
    }
    setActiveInput(type);
    const campusNorm = currentCampus.toLowerCase();
    const results: SearchResult[] = BUILDINGS.filter(
      (b) =>
        b.boundingBox &&
        b.boundingBox.length >= 3 &&
        (b.campusName || "").toLowerCase() === campusNorm,
    ).map((b) => ({ kind: "building", building: b }));
    setFilteredResults(results);
  };

  const handleUseMyLocation = () => {
    if (!onUseMyLocation) return;
    const building = onUseMyLocation();
    if (building) {
      setStartLoc(building.displayName);
      setStartBuilding(building);
      setStartRoom(null);
      setStartManuallyEdited(true);
    } else {
      setStartLoc("My Location");
      setStartBuilding(null);
      setStartRoom(null);
      setStartManuallyEdited(true);
    }
    setFilteredResults([]);
    setActiveInput(null);
  };

  const swapOriginDestination = () => {
    setStartLoc(destLoc);
    setDestLoc(startLoc);
    setStartBuilding(destBuilding);
    setDestBuilding(startBuilding);
    setStartRoom(endRoom);
    setEndRoom(startRoom);
    setRouteSummary(null);
  };

  const handleConfirm = () => {
    onConfirm(
      startBuilding,
      destBuilding,
      selectedStrategy,
      startRoom,
      endRoom,
    );
    onClose();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(SHEET_TOP + gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: SHEET_TOP,
            useNativeDriver: true,
            damping: 20,
            stiffness: 150,
          }).start();
        }
      },
    }),
  ).current;

  if (!shouldRender) return null;

  return (
    <>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={styles.gestureArea}>
            <View style={styles.handle} />
          </View>

          <View style={styles.content}>
            <View style={styles.originDestinationCard}>
              {/* ── FROM ── */}
              <View style={[styles.inputGroup, styles.inputGroupFirst]}>
                <View style={styles.inputIconWrap}>
                  <View style={styles.originDot} />
                </View>
                <TextInput
                  testID="start-location-input"
                  style={styles.input}
                  placeholder="From — building or room (e.g. MB-1.210)"
                  placeholderTextColor={colors.gray500}
                  value={startLoc}
                  onChangeText={(text) => handleSearch(text, "start")}
                  onFocus={() => {
                    setActiveInput("start");
                    if (startLoc.length > 0) {
                      setFilteredResults(searchIndex(startLoc));
                    }
                  }}
                />
                {onUseMyLocation && (
                  <Pressable
                    style={styles.pickButton}
                    onPress={handleUseMyLocation}
                    accessibilityLabel="Use my current location as start"
                    accessibilityRole="button"
                  >
                    <MaterialIcons
                      name="my-location"
                      size={22}
                      color={colors.primary}
                    />
                  </Pressable>
                )}
                <Pressable
                  style={styles.pickButton}
                  onPress={() => showBuildingPicker("start")}
                  accessibilityLabel="Pick starting building from list"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="list" size={22} color={colors.primary} />
                </Pressable>
              </View>

              {/* Room badge for start */}
              {startRoom && (
                <View style={localStyles.roomBadge}>
                  <MaterialCommunityIcons
                    name="door"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={localStyles.roomBadgeText}>
                    Room {startRoom.label}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setStartRoom(null);
                    }}
                  >
                    <MaterialIcons
                      name="close"
                      size={14}
                      color={colors.gray500}
                    />
                  </Pressable>
                </View>
              )}

              <Pressable
                style={styles.swapButton}
                onPress={swapOriginDestination}
                accessibilityLabel="Swap origin and destination"
                accessibilityRole="button"
              >
                <MaterialIcons
                  name="swap-vert"
                  size={22}
                  color={colors.gray500}
                />
              </Pressable>

              {/* ── TO ── */}
              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <View style={styles.inputIconWrap}>
                  <MaterialIcons
                    name="place"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <TextInput
                  testID="dest-location-input"
                  style={styles.input}
                  placeholder="To — building or room (e.g. H-520)"
                  placeholderTextColor={colors.gray500}
                  value={destLoc}
                  onChangeText={(text) => handleSearch(text, "destination")}
                  onFocus={() => {
                    setActiveInput("destination");
                    if (destLoc.length > 0) {
                      setFilteredResults(searchIndex(destLoc));
                    }
                  }}
                />
                <Pressable
                  style={styles.pickButton}
                  onPress={() => showBuildingPicker("destination")}
                  accessibilityLabel="Pick destination building from list"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="list" size={22} color={colors.primary} />
                </Pressable>
              </View>

              {/* Room badge for destination */}
              {endRoom && (
                <View style={localStyles.roomBadge}>
                  <MaterialCommunityIcons
                    name="door"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={localStyles.roomBadgeText}>
                    Room {endRoom.label}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setEndRoom(null);
                    }}
                  >
                    <MaterialIcons
                      name="close"
                      size={14}
                      color={colors.gray500}
                    />
                  </Pressable>
                </View>
              )}
            </View>

            {filteredResults.length === 0 && (
              <View style={styles.modeSection}>
                <View style={styles.modeContainer}>
                  {ALL_STRATEGIES.map((strategy) => (
                    <Pressable
                      key={strategy.mode}
                      testID={`mode-button-${strategy.mode}`}
                      onPress={() => setSelectedStrategy(strategy)}
                      style={[
                        styles.modeButton,
                        selectedStrategy.mode === strategy.mode &&
                          styles.activeModeButton,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={strategy.icon as any}
                        size={22}
                        color={
                          selectedStrategy.mode === strategy.mode
                            ? colors.white
                            : colors.primary
                        }
                      />
                      <Text
                        style={[
                          styles.modeText,
                          {
                            color:
                              selectedStrategy.mode === strategy.mode
                                ? colors.white
                                : colors.primary,
                          },
                        ]}
                      >
                        {strategy.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {(routeSummaryLoading || routeSummary) && (
                  <Text style={styles.routeSummaryText} numberOfLines={1}>
                    {routeSummaryLoading
                      ? "Loading…"
                      : [routeSummary?.duration, routeSummary?.distance]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                  </Text>
                )}
              </View>
            )}

            {filteredResults.length > 0 ? (
              <FlatList
                data={filteredResults}
                keyExtractor={(item, index) =>
                  item.kind === "building"
                    ? `b-${item.building.name}`
                    : `r-${item.room.id}-${index}`
                }
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionList}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.suggestionItem}
                    onPress={() => selectResult(item)}
                  >
                    <MaterialIcons
                      name={item.kind === "room" ? "meeting-room" : "business"}
                      size={20}
                      color={
                        item.kind === "room" ? colors.secondary : colors.primary
                      }
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.suggestionText}>
                        {item.kind === "room"
                          ? item.room.label
                          : item.building.displayName}
                      </Text>
                      <Text style={styles.suggestionSubtext}>
                        {item.kind === "room"
                          ? `${item.building.displayName} · Floor ${item.room.floor}`
                          : item.building.campusName}
                      </Text>
                    </View>
                    {item.kind === "room" && (
                      <View style={localStyles.roomTag}>
                        <Text style={localStyles.roomTagText}>Room</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              />
            ) : (
              <Pressable style={styles.searchButton} onPress={handleConfirm}>
                <Text style={styles.searchButtonText}>Get Directions</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}

const localStyles = StyleSheet.create({
  roomBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 36,
    marginTop: 2,
    marginBottom: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: colors.primaryLight ?? "#e8f0fe",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  roomBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  roomTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.primaryLight ?? "#e8f0fe",
    borderRadius: 4,
  },
  roomTagText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "700",
  },
});
