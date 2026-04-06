import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View
} from "react-native";

import type { CampusKey } from "../constants/campuses";
import { ALL_STRATEGIES, WALKING_STRATEGY } from "../constants/strategies";
import { Buildings } from "../constants/type";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { useLocationState } from "../hooks/useLocationState";
import { useSheetPanResponder } from "../hooks/useSheetPanResponder";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";
import { createStyles } from "../styles/NavigationBar.styles";
import {
  campusBuildingResults,
  queryIndex,
  resultLabel,
  resultSubtitle,
  SearchResult,
} from "../utils/buildingSearch";
import { IndoorRoomRecord } from "../utils/indoorBuildingPlan";
import { AccessibleModeToggle } from "./AccessibleModeToggle";
import { SheetContainer } from "./SheetContainer";
import { StrategyModeSelector } from "./StrategyModeSelector";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
export function getSheetHeight(platform: string): number {
  return platform === "android" ? SCREEN_HEIGHT * 0.76 : SCREEN_HEIGHT * 0.7;
}
/* istanbul ignore next -- Platform.OS is fixed at module load */
const SHEET_HEIGHT =
  Platform.OS === "android" ? SCREEN_HEIGHT * 0.76 : SCREEN_HEIGHT * 0.7;
const SHEET_TOP = SCREEN_HEIGHT - SHEET_HEIGHT;
const SPRING_CONFIG = { useNativeDriver: true, damping: 20, stiffness: 150 };

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
  const { colors } = useColorAccessibility();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const {
    startLoc,
    setStartLoc,
    destLoc,
    setDestLoc,
    startBuilding,
    setStartBuilding,
    destBuilding,
    setDestBuilding,
    startRoom,
    setStartRoom,
    endRoom,
    setEndRoom,
  } = useLocationState();

  const [activeInput, setActiveInput] = useState<"start" | "dest" | null>(null);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSummaries, setRouteSummaries] = useState<
    Partial<Record<RouteStrategy["mode"], string | null>>
  >({});
  const [routeSummariesLoading, setRouteSummariesLoading] = useState(false);
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
    setSuggestions(campusBuildingResults(campusNorm));
  };

  const handleUseMyLocation = () => {
    /* istanbul ignore next -- button only renders when callback is provided */
    if (!onUseMyLocation) return;
    const building = onUseMyLocation();
    if (building) {
      setStartLoc(building.displayName);
      setStartBuilding(building);
      setStartRoom(null);
    } else {
      setStartLoc("My Location");
      setStartBuilding(null);
      setStartRoom(null);
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
    setRouteSummaries({});
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
      setRouteSummaries({});
      return;
    }
    let cancelled = false;
    setRouteSummariesLoading(true);
    setRouteSummaries({});

    Promise.all(
      ALL_STRATEGIES.map(async (strategy) => {
        if (strategy.mode === "shuttle" && !shuttleAvailable) {
          return [strategy.mode, null] as const;
        }

        try {
          const result = await getOutdoorRouteWithSteps(
            startBuilding.coordinates,
            destBuilding.coordinates,
            strategy,
          );
          return [strategy.mode, result.duration ?? null] as const;
        } catch {
          return [strategy.mode, null] as const;
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return;
        setRouteSummaries(Object.fromEntries(entries));
      })
      .finally(() => {
        if (!cancelled) setRouteSummariesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startBuilding, destBuilding, shuttleAvailable, suggestions.length]);

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

  useEffect(() => {
    if (visible && initialStart) {
      setStartLoc(initialStart.displayName);
      setStartBuilding(initialStart);
      setStartRoom(null);
      onInitialStartApplied?.();
    }
  }, [
    visible,
    initialStart,
    onInitialStartApplied,
    setStartBuilding,
    setStartLoc,
    setStartRoom,
  ]);

  useEffect(() => {
    if (visible && initialDestination) {
      setDestLoc(initialDestination.displayName);
      setDestBuilding(initialDestination);
      setEndRoom(null);
      onInitialDestinationApplied?.();
    }
  }, [
    visible,
    initialDestination,
    onInitialDestinationApplied,
    setDestBuilding,
    setDestLoc,
    setEndRoom,
  ]);

  const panResponder = useSheetPanResponder({ translateY, onClose });

  if (!shouldRender) return null;

  const showingList = suggestions.length > 0;

  return (
    <SheetContainer
      panResponder={panResponder}
      translateY={translateY}
      overlayStyle={styles.overlay}
      keyboardContainerStyle={styles.keyboardContainer}
      sheetStyle={styles.sheet}
      gestureAreaStyle={styles.gestureArea}
      handleStyle={styles.handle}
      contentStyle={styles.content}
      onClose={onClose}
    >
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
                <StrategyModeSelector
                  selectedStrategy={selectedStrategy}
                  onSelect={setSelectedStrategy}
                  shuttleAvailable={shuttleAvailable}
                  testIDPrefix="mode-button"
                  buttonStyles={styles}
                  containerStyle={styles.modeContainer}
                  routeSummaries={routeSummaries}
                  summariesLoading={routeSummariesLoading}
                />
                <AccessibleModeToggle
                  localAccessibleOnly={localAccessibleOnly}
                  onAccessibleOnlyChange={(value) => {
                    setLocalAccessibleOnly(value);
                    onAccessibleOnlyChange?.(value);
                  }}
                  colors={colors}
                  styles={styles}
                  testID="accessible-mode-toggle"
                  rowStyle={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 8,
                  }}
                  buttonLabel="Accessible Route"
                />
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
                        : `suggestion-room-${item.room.label}`
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
    </SheetContainer>
  );
}
