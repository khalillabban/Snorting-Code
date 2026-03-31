import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { ALL_STRATEGIES, WALKING_STRATEGY } from "../constants/strategies";
import { colors } from "../constants/theme";
import { Buildings } from "../constants/type";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/NavigationBar.styles";
import { getIndoorAccessState } from "../utils/indoorAccess";
import {
  getNormalizedBuildingPlan,
  IndoorRoomRecord,
} from "../utils/indoorBuildingPlan";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT =
  Platform.OS === "android" ? SCREEN_HEIGHT * 0.76 : SCREEN_HEIGHT * 0.7;
const SHEET_TOP = SCREEN_HEIGHT - SHEET_HEIGHT;
const SPRING_CONFIG = { useNativeDriver: true, damping: 20, stiffness: 150 };
const MAX_SUGGESTIONS = 20;

export type SearchResult =
  | { kind: "building"; building: Buildings }
  | { kind: "room"; room: IndoorRoomRecord; building: Buildings };

function resultLabel(result: SearchResult): string {
  if (result.kind === "building") return result.building.displayName;
  return result.room.roomName ? `${result.room.label} — ${result.room.roomName}` : result.room.label;
}

function resultSubtitle(result: SearchResult): string {
  if (result.kind === "building") return result.building.campusName;
  return `${result.building.displayName} · Floor ${result.room.floor}`;
}

type SearchIndex = SearchResult[];
let _cachedIndex: SearchIndex | null = null;

function buildSearchIndex(): SearchIndex {
  const index: SearchIndex = [];

  for (const building of BUILDINGS) {
    index.push({ kind: "building", building });

    const access = getIndoorAccessState(building.name);
    if (!access.hasSearchableRooms) continue;

    const plan = getNormalizedBuildingPlan(building.name);
    if (!plan) continue;

    for (const room of plan.rooms) {
      index.push({ kind: "room", room, building });
    }
  }

  return index;
}

function getSearchIndex(): SearchIndex {
  _cachedIndex ??= buildSearchIndex();
  return _cachedIndex;
}

function queryIndex(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return getSearchIndex()
    .filter((item) => {
      const label = resultLabel(item).toLowerCase();
      const code = item.building.name.toLowerCase();
      const roomNumber =
        item.kind === "room" ? item.room.roomNumber.toLowerCase() : "";
      return label.includes(q) || code.includes(q) || roomNumber.includes(q);
    })
    .slice(0, MAX_SUGGESTIONS);
}

interface NavigationBarProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    start: Buildings | null,
    destination: Buildings | null,
    strategy: RouteStrategy,
    startRoom?: IndoorRoomRecord | null,
    endRoom?: IndoorRoomRecord | null,
    accessibleOnly?: boolean,
  ) => void;
  autoStartBuilding?: Buildings | null;
  initialStart?: Buildings | null;
  onInitialStartApplied?: () => void;
  initialDestination?: Buildings | null;
  onInitialDestinationApplied?: () => void;
  currentCampus?: CampusKey;
  onUseMyLocation?: () => Buildings | null;
  accessibleOnly?: boolean;
  onAccessibleOnlyChange?: (value: boolean) => void;
  shuttleAvailable?: boolean;
}

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
  accessibleOnly = false,
  onAccessibleOnlyChange,
  shuttleAvailable = true,
}: Readonly<NavigationBarProps>) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const [startLoc, setStartLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);
  const [startRoom, setStartRoom] = useState<IndoorRoomRecord | null>(null);
  const [endRoom, setEndRoom] = useState<IndoorRoomRecord | null>(null);
  const [startManuallyEdited, setStartManuallyEdited] = useState(false);

  const [activeInput, setActiveInput] = useState<"start" | "dest" | null>(null);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSummary, setRouteSummary] = useState<{
    duration?: string;
    distance?: string;
  } | null>(null);
  const [routeSummaryLoading, setRouteSummaryLoading] = useState(false);
  const [localAccessibleOnly, setLocalAccessibleOnly] =
    useState(accessibleOnly);

  useEffect(() => {
    if (!shuttleAvailable && selectedStrategy.mode === "shuttle") {
      setSelectedStrategy(WALKING_STRATEGY);
    }
  }, [shuttleAvailable, selectedStrategy.mode]);

  const search = useCallback((text: string) => {
    if (!text.trim()) {
      setSuggestions([]);
      return;
    }
    setSuggestions(queryIndex(text));
  }, []);

  const handleStartChange = (text: string) => {
    setStartLoc(text);
    setStartManuallyEdited(true);
    setStartRoom(null);
    setStartBuilding(null);
    setActiveInput("start");
    search(text);
  };

  const handleDestChange = (text: string) => {
    setDestLoc(text);
    setEndRoom(null);
    setDestBuilding(null);
    setActiveInput("dest");
    search(text);
  };

  const selectResult = (result: SearchResult) => {
    const building = result.building;
    const room = result.kind === "room" ? result.room : null;
    const label = resultLabel(result);

    if (activeInput === "start") {
      setStartLoc(label);
      setStartBuilding(building);
      setStartRoom(room);
    } else {
      setDestLoc(label);
      setDestBuilding(building);
      setEndRoom(room);
    }

    setSuggestions([]);
    setActiveInput(null);
    Keyboard.dismiss();
  };

  const dismissSuggestions = () => {
    setSuggestions([]);
    setActiveInput(null);
  };

  const showBuildingPicker = (type: "start" | "dest") => {
    if (activeInput === type && suggestions.length > 0) {
      dismissSuggestions();
      return;
    }
    setActiveInput(type);
    const campusNorm = currentCampus.toLowerCase();
    setSuggestions(
      BUILDINGS.filter(
        (b) =>
          b.boundingBox &&
          b.boundingBox.length >= 3 &&
          (b.campusName || "").toLowerCase() === campusNorm,
      ).map((b) => ({ kind: "building", building: b })),
    );
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
    dismissSuggestions();
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
      localAccessibleOnly,
    );
    onClose();
  };

  useEffect(() => {
    if (!startBuilding || !destBuilding || suggestions.length > 0) {
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
        if (!cancelled)
          setRouteSummary({ duration: res.duration, distance: res.distance });
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
  }, [startBuilding, destBuilding, selectedStrategy, suggestions.length]);

  // ── Visibility animation ────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.spring(translateY, {
        toValue: SHEET_TOP,
        ...SPRING_CONFIG,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShouldRender(false));
    }
  }, [visible, translateY]);

  // ── Auto-fill ───────────────────────────────────────────────────────────────

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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(SHEET_TOP + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: SHEET_TOP,
            ...SPRING_CONFIG,
          }).start();
        }
      },
    }),
  ).current;

  if (!shouldRender) return null;

  const showingList = suggestions.length > 0;

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
                  placeholder="From — building or room (e.g. H-110)"
                  placeholderTextColor={colors.gray500}
                  value={startLoc}
                  onChangeText={handleStartChange}
                  onFocus={() => {
                    setActiveInput("start");
                    if (startLoc.trim()) search(startLoc);
                  }}
                  returnKeyType="next"
                />
                {onUseMyLocation && (
                  <Pressable
                    style={styles.pickButton}
                    onPress={handleUseMyLocation}
                    accessibilityLabel="Use my current location"
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
                  accessibilityLabel="Pick from list"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="list" size={22} color={colors.primary} />
                </Pressable>
              </View>

              {/* Start room badge */}
              {startRoom && (
                <View style={styles.roomBadge}>
                  <MaterialCommunityIcons
                    name="door"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.roomBadgeText}>
                    Room {startRoom.label}
                  </Text>
                  <Pressable
                    testID="clear-start-room"
                    onPress={() => setStartRoom(null)}
                  >
                    <MaterialIcons
                      name="close"
                      size={14}
                      color={colors.gray500}
                    />
                  </Pressable>
                </View>
              )}

              {/* Swap */}
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
                  placeholder="To — building or room (e.g. MB-1.210)"
                  placeholderTextColor={colors.gray500}
                  value={destLoc}
                  onChangeText={handleDestChange}
                  onFocus={() => {
                    setActiveInput("dest");
                    if (destLoc.trim()) search(destLoc);
                  }}
                  returnKeyType="go"
                  onSubmitEditing={handleConfirm}
                />
                <Pressable
                  style={styles.pickButton}
                  onPress={() => showBuildingPicker("dest")}
                  accessibilityLabel="Pick from list"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="list" size={22} color={colors.primary} />
                </Pressable>
              </View>

              {/* Destination room badge */}
              {endRoom && (
                <View style={styles.roomBadge}>
                  <MaterialCommunityIcons
                    name="door"
                    size={14}
                    color={colors.primary}
                  />
                  <Text style={styles.roomBadgeText}>Room {endRoom.label}</Text>
                  <Pressable
                    testID="clear-end-room"
                    onPress={() => setEndRoom(null)}
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

            {!showingList && (
              <View style={styles.modeSection}>
                <View style={styles.modeContainer}>
                  {ALL_STRATEGIES.map((strategy) => {
                    const isActive = selectedStrategy.mode === strategy.mode;
                    const isShuttle = strategy.mode === "shuttle";
                    const isDisabled = isShuttle && !shuttleAvailable;
                    return (
                      <Pressable
                        key={strategy.mode}
                        testID={`mode-button-${strategy.mode}`}
                        onPress={() => {
                          if (!isDisabled) setSelectedStrategy(strategy);
                        }}
                        disabled={isDisabled}
                        style={[
                          styles.modeButton,
                          isActive && styles.activeModeButton,
                          isDisabled && styles.disabledModeButton,
                        ]}
                        accessibilityState={{ disabled: isDisabled }}
                        accessibilityHint={isDisabled ? "Shuttle is currently unavailable" : undefined}
                      >
                        <MaterialCommunityIcons
                          name={strategy.icon as any}
                          size={22}
                          color={isDisabled ? colors.gray400 : isActive ? colors.white : colors.primary}
                        />
                        <Text
                          style={[
                            styles.modeText,
                            { color: isDisabled ? colors.gray400 : isActive ? colors.white : colors.primary },
                          ]}
                        >
                          {strategy.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                >
                  <Pressable
                    onPress={() => {
                      setLocalAccessibleOnly(!localAccessibleOnly);
                      onAccessibleOnlyChange?.(!localAccessibleOnly);
                    }}
                    style={[
                      styles.modeButton,
                      localAccessibleOnly && styles.activeModeButton,
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 12,
                      },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: localAccessibleOnly }}
                    testID="accessible-mode-toggle"
                  >
                    <MaterialCommunityIcons
                      name={
                        localAccessibleOnly
                          ? "wheelchair-accessibility"
                          : "walk"
                      }
                      size={22}
                      color={
                        localAccessibleOnly ? colors.white : colors.primary
                      }
                    />
                    <Text
                      style={{
                        color: localAccessibleOnly
                          ? colors.white
                          : colors.primary,
                        marginLeft: 8,
                      }}
                    >
                      Accessible Route
                    </Text>
                  </Pressable>
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

            {showingList ? (
              <FlatList
                data={suggestions}
                keyExtractor={(item, index) =>
                  item.kind === "building"
                    ? `b-${item.building.name}`
                    : `r-${item.room.id}-${index}`
                }
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionList}
                renderItem={({ item }) => (
                  <Pressable
                    testID={
                      item.kind === "building"
                        ? `suggestion-${item.building.name}`
                        : `suggestion-room-${item.room.id}`
                    }
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
                        {resultLabel(item)}
                      </Text>
                      <Text style={styles.suggestionSubtext}>
                        {resultSubtitle(item)}
                      </Text>
                    </View>
                    {item.kind === "room" && (
                      <View style={styles.roomTag}>
                        <Text style={styles.roomTagText}>Room</Text>
                      </View>
                    )}
                  </Pressable>
                )}
              />
            ) : (
              <Pressable
                style={styles.searchButton}
                onPress={handleConfirm}
                testID="get-directions-button"
              >
                <Text style={styles.searchButtonText}>Get Directions</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}
