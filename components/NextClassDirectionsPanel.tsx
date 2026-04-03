import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";

import type { CampusKey } from "../constants/campuses";
import { ALL_STRATEGIES, WALKING_STRATEGY } from "../constants/strategies";
import { Buildings, ScheduleItem } from "../constants/type";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";
import { FULL_HEIGHT, styles } from "../styles/NextClassDirectionsPanel.styles";
import {
  campusBuildingResults,
  queryIndex,
  resultLabel,
  resultSubtitle,
  SearchResult,
} from "../utils/buildingSearch";
import { findBuildingByCode } from "../utils/findBuildingByCode";
import { normalizeRoomQuery } from "../utils/indoorAccess";
import { getNormalizedBuildingPlan, IndoorRoomRecord } from "../utils/indoorBuildingPlan";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_TOP = SCREEN_HEIGHT - FULL_HEIGHT;

const SPRING_CONFIG = { useNativeDriver: true, damping: 20, stiffness: 150 };

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")}${ampm}`;
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function deduplicateCourses(items: ScheduleItem[]): ScheduleItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.courseName}|${item.building}|${item.room}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getClassCourseItems(items: ScheduleItem[]): ScheduleItem[] {
  return items.filter((item) => item.kind === "class");
}

function fmtRoom(building: string, room: string): string {
  if (!building) return "";
  if (!room) return building;
  return `${building}-${room}`;
}

interface SuggestionRowProps {
  testID: string;
  iconName: React.ComponentProps<typeof MaterialIcons>["name"];
  iconColor?: string;
  primaryText: string;
  secondaryText: string;
  showRoomTag?: boolean;
  onPress: () => void;
}

function SuggestionRow({
  testID,
  iconName,
  iconColor,
  primaryText,
  secondaryText,
  showRoomTag,
  onPress,
}: Readonly<SuggestionRowProps>) {
  const { colors } = useColorAccessibility();
  return (
    <Pressable testID={testID} style={styles.suggestionItem} onPress={onPress}>
      <MaterialIcons name={iconName} size={20} color={iconColor ?? colors.primary} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={styles.suggestionText}>{primaryText}</Text>
        <Text style={styles.suggestionSubtext}>{secondaryText}</Text>
      </View>
      {showRoomTag && (
        <View style={styles.roomTag}>
          <Text style={styles.roomTagText}>Room</Text>
        </View>
      )}
    </Pressable>
  );
}

interface SuggestionListProps {
  suggestions: SearchResult[];
  courses: ScheduleItem[];
  onSelectResult: (r: SearchResult) => void;
  onSelectCourse: (c: ScheduleItem) => void;
}

function SuggestionList({
  suggestions,
  courses,
  onSelectResult,
  onSelectCourse,
}: Readonly<SuggestionListProps>) {
  const { colors } = useColorAccessibility();
  if (suggestions.length > 0) {
    return (
      <View style={styles.suggestionList}>
        {suggestions.map((item, index) => (
          <SuggestionRow
            key={
              item.kind === "building"
                ? `b-${item.building.name}`
                : `r-${item.room.id}-${index}`
            }
            testID={
              item.kind === "building"
                ? `nc-suggestion-${item.building.name}`
                : `nc-room-${item.room.id}`
            }
            iconName={item.kind === "room" ? "meeting-room" : "business"}
            iconColor={item.kind === "room" ? colors.secondary : colors.primary}
            primaryText={resultLabel(item)}
            secondaryText={resultSubtitle(item)}
            showRoomTag={item.kind === "room"}
            onPress={() => onSelectResult(item)}
          />
        ))}
      </View>
    );
  }
  if (courses.length > 0) {
    return (
      <View style={styles.suggestionList}>
        {courses.map((item) => (
          <SuggestionRow
            key={item.id}
            testID={`nc-course-${item.id}`}
            iconName="school"
            primaryText={item.courseName}
            secondaryText={`${fmtRoom(item.building, item.room)} - ${item.campus}`}
            onPress={() => onSelectCourse(item)}
          />
        ))}
      </View>
    );
  }
  return null;
}

interface LocationInputRowProps {
  testID: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  groupStyle: StyleProp<ViewStyle>;
  iconSlot: React.ReactNode;
  onPickPress: () => void;
  pickLabel: string;
  extraButton?: React.ReactNode;
}

function LocationInputRow({
  testID,
  placeholder,
  value,
  onChangeText,
  groupStyle,
  iconSlot,
  onPickPress,
  pickLabel,
  extraButton,
}: Readonly<LocationInputRowProps>) {
  const { colors } = useColorAccessibility();
  return (
    <View style={groupStyle}>
      <View style={styles.inputIconWrap}>{iconSlot}</View>
      <TextInput
        testID={testID}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.gray500}
        value={value}
        onChangeText={onChangeText}
      />
      {extraButton}
      <Pressable
        style={styles.pickButton}
        onPress={onPickPress}
        testID={`${testID}-picker`}
        accessibilityLabel={pickLabel}
        accessibilityRole="button"
      >
        <MaterialIcons name="list" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

interface NextClassDirectionsPanelProps {
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
  nextClass: ScheduleItem | null;
  scheduleItems: ScheduleItem[];
  autoStartBuilding?: Buildings | null;
  currentCampus?: CampusKey;
  onUseMyLocation?: () => Buildings | null;
  canOpenIndoorMap?: boolean;
  onOpenIndoorMap?: () => void;
  accessibleOnly?: boolean;
  onAccessibleOnlyChange?: (value: boolean) => void;
}

export default function NextClassDirectionsPanel({
  visible,
  onClose,
  onConfirm,
  nextClass,
  scheduleItems,
  autoStartBuilding,
  currentCampus = "sgw",
  onUseMyLocation,
  canOpenIndoorMap = false,
  onOpenIndoorMap,
  accessibleOnly = false,
  onAccessibleOnlyChange,
}: Readonly<NextClassDirectionsPanelProps>) {
  const { colors } = useColorAccessibility();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const [startLoc, setStartLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);
  const [startRoom, setStartRoom] = useState<IndoorRoomRecord | null>(null);
  const [endRoom, setEndRoom] = useState<IndoorRoomRecord | null>(null);
  const [localAccessibleOnly, setLocalAccessibleOnly] = useState(accessibleOnly);

  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<ScheduleItem[]>([]);
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

  const [error, setError] = useState<string | null>(null);

  const clearDestWithError = (courseName: string) => {
    setError(`Missing course details for "${courseName}".`);
    setDestLoc("");
    setDestBuilding(null);
  };

  const setDestFromBuilding = (building: Buildings, room?: IndoorRoomRecord | null) => {
    setError(null);
    setDestLoc(building.displayName);
    setDestBuilding(building);
    setEndRoom(room ?? null);
  };

  const resolveIndoorRoom = (
    buildingCode: string,
    roomCode: string,
  ): IndoorRoomRecord | null => {
    if (!roomCode) return null;
    const plan = getNormalizedBuildingPlan(buildingCode);
    if (!plan) return null;
    const query = normalizeRoomQuery(buildingCode, roomCode);
    return findIndoorRoomMatch(plan, query)?.room ?? null;
  };

  const clearActiveSearch = () => {
    setSuggestions([]);
    setFilteredCourses([]);
    setActiveInput(null);
  };

  useEffect(() => {
    if (!nextClass) {
      setDestLoc("");
      setDestBuilding(null);
      return;
    }

    const building = findBuildingByCode(nextClass.building);
    if (building) {
      const room = resolveIndoorRoom(nextClass.building, nextClass.room);
      setDestFromBuilding(building, room);
    } else {
      clearDestWithError(nextClass.courseName);
    }
  }, [nextClass]);

  useEffect(() => {
    if (autoStartBuilding) {
      setStartLoc(autoStartBuilding.displayName);
      setStartBuilding(autoStartBuilding);
    }
  }, [autoStartBuilding]);

  useEffect(() => {
    const showingList =
      suggestions.length > 0 || filteredCourses.length > 0;
    if (!startBuilding || !destBuilding || showingList) {
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
  }, [
    startBuilding,
    destBuilding,
    selectedStrategy,
    suggestions.length,
    filteredCourses.length,
  ]);

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

  const handleSearch = (field: "start" | "destination", text: string) => {
    setActiveInput(field);
    if (field === "start") {
      setStartLoc(text);
    } else {
      setDestLoc(text);
    }
    setFilteredCourses([]);
    setSuggestions(text.length > 0 ? queryIndex(text) : []);
  };

  const finalizeSelection = () => {
    clearActiveSearch();
    Keyboard.dismiss();
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
    finalizeSelection();
  };

  const selectCourse = (item: ScheduleItem) => {
    const building = findBuildingByCode(item.building);
    if (building) {
      const room = resolveIndoorRoom(item.building, item.room);
      setDestFromBuilding(building, room);
    } else {
      clearDestWithError(item.courseName);
    }
    finalizeSelection();
  };

  const togglePicker = (
    inputType: "start" | "destination",
    currentList: unknown[],
    populateList: () => void,
  ) => {
    if (activeInput === inputType && currentList.length > 0) {
      clearActiveSearch();
      return;
    }
    setActiveInput(inputType);
    setSuggestions([]);
    setFilteredCourses([]);
    populateList();
  };

  const showBuildingPicker = () => {
    togglePicker("start", suggestions, () => {
      setSuggestions(campusBuildingResults(currentCampus));
    });
  };

  const showCoursePicker = () => {
    togglePicker("destination", filteredCourses, () => {
      setFilteredCourses(
        deduplicateCourses(getClassCourseItems(scheduleItems)),
      );
    });
  };

  const handleUseMyLocation = () => {
    if (!onUseMyLocation) return;
    const building = onUseMyLocation();
    if (building) {
      setStartLoc(building.displayName);
      setStartBuilding(building);
    } else {
      setStartLoc("My Location");
      setStartBuilding(null);
    }
    clearActiveSearch();
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
    onConfirm(startBuilding, destBuilding, selectedStrategy, startRoom, endRoom, localAccessibleOnly);
    onClose();
  };

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

  const showingList =
    suggestions.length > 0 || filteredCourses.length > 0;

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
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}
            >
            {/* Next-class info card */}
            {nextClass && (
              <View style={styles.classInfoCard}>
                <Text style={styles.classInfoLabel}>Next Class</Text>
                {/* Row 1: course name (left), room (right) */}
                <View style={styles.classInfoHeader}>
                  <Text style={styles.classInfoTitle} testID="next-class-name">
                    {nextClass.courseName}
                  </Text>
                  <Text style={styles.classInfoLocation}>
                    {fmtRoom(nextClass.building, nextClass.room) ||
                      nextClass.location}
                  </Text>
                </View>
                {/* Row 2: date (left), time (right) */}
                <View style={styles.classInfoHeader}>
                  <Text style={styles.classInfoDate}>
                    {fmtDate(nextClass.start)}
                  </Text>
                  <Text style={styles.classInfoTime}>
                    {fmtTime(nextClass.start)} - {fmtTime(nextClass.end)}
                  </Text>
                </View>
              </View>
            )}

            {nextClass && canOpenIndoorMap && onOpenIndoorMap && (
              <Pressable
                style={styles.secondaryActionButton}
                onPress={onOpenIndoorMap}
                testID="next-class-open-indoor"
              >
                <Text style={styles.secondaryActionButtonText}>
                  Open Indoor Map
                </Text>
              </Pressable>
            )}

            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner} testID="next-class-error">
                <MaterialIcons
                  name="error-outline"
                  size={18}
                  color={colors.error}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Origin / Destination */}
            <View style={styles.originDestinationCard}>
              <LocationInputRow
                testID="next-class-start-input"
                placeholder="From — building or room (e.g. H-921)"
                value={startLoc}
                onChangeText={(t) => handleSearch("start", t)}
                groupStyle={[styles.inputGroup, styles.inputGroupFirst]}
                iconSlot={<View style={styles.originDot} />}
                onPickPress={showBuildingPicker}
                pickLabel="Pick starting building from list"
                extraButton={
                  onUseMyLocation ? (
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
                  ) : undefined
                }
              />

              {startRoom && (
                <View style={styles.roomBadge}>
                  <MaterialCommunityIcons name="door" size={14} color={colors.primary} />
                  <Text style={styles.roomBadgeText}>Room {startRoom.label}</Text>
                  <Pressable testID="clear-start-room" onPress={() => setStartRoom(null)}>
                    <MaterialIcons name="close" size={14} color={colors.gray500} />
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

              <LocationInputRow
                testID="next-class-dest-input"
                placeholder="To — building, room, or course"
                value={destLoc}
                onChangeText={(t) => handleSearch("destination", t)}
                groupStyle={[styles.inputGroup, styles.inputGroupLast]}
                iconSlot={
                  <MaterialIcons
                    name="place"
                    size={20}
                    color={colors.primary}
                  />
                }
                onPickPress={showCoursePicker}
                pickLabel="Pick destination from course list"
              />

              {endRoom && (
                <View style={styles.roomBadge}>
                  <MaterialCommunityIcons name="door" size={14} color={colors.primary} />
                  <Text style={styles.roomBadgeText}>Room {endRoom.label}</Text>
                  <Pressable testID="clear-end-room" onPress={() => setEndRoom(null)}>
                    <MaterialIcons name="close" size={14} color={colors.gray500} />
                  </Pressable>
                </View>
              )}
            </View>

            {/* Strategy buttons (hidden while picking) */}
            {!showingList && (
              <View style={styles.modeSection}>
                <View style={styles.modeContainer}>
                  {ALL_STRATEGIES.map((strategy) => {
                    const isActive = selectedStrategy.mode === strategy.mode;
                    const strategyColor = isActive
                      ? colors.white
                      : colors.primary;
                    return (
                      <Pressable
                        key={strategy.mode}
                        testID={`next-class-mode-${strategy.mode}`}
                        onPress={() => setSelectedStrategy(strategy)}
                        style={[
                          styles.modeButton,
                          isActive && styles.activeModeButton,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={strategy.icon as any}
                          size={22}
                          color={strategyColor}
                        />
                        <Text
                          style={[styles.modeText, { color: strategyColor }]}
                        >
                          {strategy.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                  <Pressable
                    onPress={() => {
                      setLocalAccessibleOnly(!localAccessibleOnly);
                      onAccessibleOnlyChange?.(!localAccessibleOnly);
                    }}
                    style={[
                      styles.modeButton,
                      localAccessibleOnly && styles.activeModeButton,
                      { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
                    ]}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: localAccessibleOnly }}
                    testID="next-class-accessible-toggle"
                  >
                    <MaterialCommunityIcons
                      name={localAccessibleOnly ? "wheelchair-accessibility" : "walk"}
                      size={22}
                      color={localAccessibleOnly ? colors.white : colors.primary}
                    />
                    <Text style={{ color: localAccessibleOnly ? colors.white : colors.primary, marginLeft: 8 }}>
                      Accessible Route
                    </Text>
                  </Pressable>
                </View>
                {(routeSummaryLoading || routeSummary) && (
                  <Text style={styles.routeSummaryText} numberOfLines={1}>
                    {routeSummaryLoading
                      ? "Loading..."
                      : [routeSummary?.duration, routeSummary?.distance]
                          .filter(Boolean)
                          .join(" - ") || "-"}
                  </Text>
                )}
              </View>
            )}

            {/* Unified suggestion list */}
            <SuggestionList
              suggestions={suggestions}
              courses={filteredCourses}
              onSelectResult={selectResult}
              onSelectCourse={selectCourse}
            />

            {/* Get Directions button */}
            {!showingList && (
              <Pressable
                style={styles.searchButton}
                onPress={handleConfirm}
                testID="next-class-get-directions"
              >
                <Text style={styles.searchButtonText}>Get Directions</Text>
              </Pressable>
            )}
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}
