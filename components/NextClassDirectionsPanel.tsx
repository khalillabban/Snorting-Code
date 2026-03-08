import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";

import { BUILDINGS } from "../constants/buildings";
import type { CampusKey } from "../constants/campuses";
import { ALL_STRATEGIES, WALKING_STRATEGY } from "../constants/strategies";
import { colors } from "../constants/theme";
import { Buildings, ScheduleItem } from "../constants/type";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";
import { FULL_HEIGHT, styles } from "../styles/NextClassDirectionsPanel.styles";
import { findBuildingByCode } from "../utils/findBuildingByCode";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_TOP = SCREEN_HEIGHT - FULL_HEIGHT;

// Shared spring animation config
const SPRING_CONFIG = { useNativeDriver: true, damping: 20, stiffness: 150 };

// Format a Date to a short time string like "10:30am"
function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")}${ampm}`;
}
// Format a Date to a long date string like "Monday, March 9, 2026"
function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
// Deduplicate schedule items by (courseName, building, room)
function deduplicateCourses(items: ScheduleItem[]): ScheduleItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.courseName}|${item.building}|${item.room}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Build a display string like "MB-1.210" from building + room
function fmtRoom(building: string, room: string): string {
  if (!building) return "";
  if (!room) return building;
  return `${building}-${room}`;
}

// Single row inside a suggestion list
interface SuggestionRowProps {
  testID: string;
  iconName: React.ComponentProps<typeof MaterialIcons>["name"];
  primaryText: string;
  secondaryText: string;
  onPress: () => void;
}

function SuggestionRow({
  testID,
  iconName,
  primaryText,
  secondaryText,
  onPress,
}: Readonly<SuggestionRowProps>) {
  return (
    <Pressable testID={testID} style={styles.suggestionItem} onPress={onPress}>
      <MaterialIcons name={iconName} size={20} color={colors.primary} />
      <View style={{ marginLeft: 10 }}>
        <Text style={styles.suggestionText}>{primaryText}</Text>
        <Text style={styles.suggestionSubtext}>{secondaryText}</Text>
      </View>
    </Pressable>
  );
}

// Unified suggestion list for buildings or courses
interface SuggestionListProps {
  buildings: Buildings[];
  courses: ScheduleItem[];
  onSelectBuilding: (b: Buildings) => void;
  onSelectCourse: (c: ScheduleItem) => void;
}

function SuggestionList({
  buildings,
  courses,
  onSelectBuilding,
  onSelectCourse,
}: Readonly<SuggestionListProps>) {
  if (buildings.length > 0) {
    return (
      <FlatList
        data={buildings}
        keyExtractor={(item) => item.name}
        keyboardShouldPersistTaps="handled"
        style={styles.suggestionList}
        renderItem={({ item }) => (
          <SuggestionRow
            testID={`nc-suggestion-${item.name}`}
            iconName="business"
            primaryText={item.displayName}
            secondaryText={item.campusName}
            onPress={() => onSelectBuilding(item)}
          />
        )}
      />
    );
  }
  if (courses.length > 0) {
    return (
      <FlatList
        data={courses}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        style={styles.suggestionList}
        renderItem={({ item }) => (
          <SuggestionRow
            testID={`nc-course-${item.id}`}
            iconName="school"
            primaryText={item.courseName}
            secondaryText={`${fmtRoom(item.building, item.room)} · ${item.campus}`}
            onPress={() => onSelectCourse(item)}
          />
        )}
      />
    );
  }
  return null;
}

// Shared input row for start and destination
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
  ) => void;
  nextClass: ScheduleItem | null;
  scheduleItems: ScheduleItem[];
  autoStartBuilding?: Buildings | null;
  currentCampus?: CampusKey;
  onUseMyLocation?: () => Buildings | null;
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
}: Readonly<NextClassDirectionsPanelProps>) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  // Start/destination state
  const [startLoc, setStartLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);

  // Search/pick state
  const [filteredBuildings, setFilteredBuildings] = useState<Buildings[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<ScheduleItem[]>([]);
  const [activeInput, setActiveInput] = useState<
    "start" | "destination" | null
  >(null);

  // Strategy & route summary
  const [selectedStrategy, setSelectedStrategy] =
    useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSummary, setRouteSummary] = useState<{
    duration?: string;
    distance?: string;
  } | null>(null);
  const [routeSummaryLoading, setRouteSummaryLoading] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Helper: set destination with error
  const clearDestWithError = (courseName: string) => {
    setError(`Missing course details for "${courseName}".`);
    setDestLoc("");
    setDestBuilding(null);
  };

  // Helper: set destination from building
  const setDestFromBuilding = (building: Buildings) => {
    setError(null);
    setDestLoc(building.displayName);
    setDestBuilding(building);
  };

  // Helper: clear search state
  const clearActiveSearch = () => {
    setFilteredBuildings([]);
    setFilteredCourses([]);
    setActiveInput(null);
  };

  // Destination from nextClass
  useEffect(() => {
    if (!nextClass) {
      setDestLoc("");
      setDestBuilding(null);
      return;
    }

    const building = findBuildingByCode(nextClass.building);
    if (building) {
      setDestFromBuilding(building);
    } else {
      clearDestWithError(nextClass.courseName);
    }
  }, [nextClass]);

  // Auto-start from location
  useEffect(() => {
    if (autoStartBuilding) {
      setStartLoc(autoStartBuilding.displayName);
      setStartBuilding(autoStartBuilding);
    }
  }, [autoStartBuilding]);

  // Route summary
  useEffect(() => {
    const showingList =
      filteredBuildings.length > 0 || filteredCourses.length > 0;
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
    filteredBuildings.length,
    filteredCourses.length,
  ]);

  // Slide animation
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.spring(translateY, { toValue: SHEET_TOP, ...SPRING_CONFIG }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => setShouldRender(false));
    }
  }, [visible]);

  // Unified search handler for both start and destination inputs
  const handleSearch = (field: "start" | "destination", text: string) => {
    setActiveInput(field);
    if (field === "start") {
      setStartLoc(text);
      setFilteredCourses([]);
      setFilteredBuildings(
        text.length > 0
          ? BUILDINGS.filter(
              (b) =>
                b.displayName.toLowerCase().includes(text.toLowerCase()) ||
                b.name.toLowerCase().includes(text.toLowerCase()),
            )
          : [],
      );
    } else {
      setDestLoc(text);
      setFilteredBuildings([]);
      setFilteredCourses(
        text.length > 0
          ? deduplicateCourses(
              scheduleItems.filter((item) =>
                item.courseName.toLowerCase().includes(text.toLowerCase()),
              ),
            )
          : [],
      );
    }
  };

  // Helper: finalize selection and dismiss
  const finalizeSelection = () => {
    clearActiveSearch();
    Keyboard.dismiss();
  };

  const selectBuilding = (building: Buildings) => {
    setStartLoc(building.displayName);
    setStartBuilding(building);
    finalizeSelection();
  };

  // When user picks a course from the destination list
  const selectCourse = (item: ScheduleItem) => {
    const building = findBuildingByCode(item.building);
    if (building) {
      setDestFromBuilding(building);
    } else {
      clearDestWithError(item.courseName);
    }
    finalizeSelection();
  };

  // Generic toggle picker: if already open, close; else open with provided items
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
    setFilteredBuildings([]);
    setFilteredCourses([]);
    populateList();
  };

  const showBuildingPicker = () => {
    togglePicker("start", filteredBuildings, () => {
      const campusNorm = currentCampus.toLowerCase();
      setFilteredBuildings(
        BUILDINGS.filter(
          (b) =>
            b.boundingBox &&
            b.boundingBox.length >= 3 &&
            (b.campusName || "").toLowerCase() === campusNorm,
        ),
      );
    });
  };

  const showCoursePicker = () => {
    togglePicker("destination", filteredCourses, () => {
      setFilteredCourses(deduplicateCourses(scheduleItems));
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
    setRouteSummary(null);
  };

  const handleConfirm = () => {
    onConfirm(startBuilding, destBuilding, selectedStrategy);
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
          Animated.spring(translateY, { toValue: SHEET_TOP, ...SPRING_CONFIG }).start();
        }
      },
    }),
  ).current;

  // Render
  if (!shouldRender) return null;

  const showingList =
    filteredBuildings.length > 0 || filteredCourses.length > 0;

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
            {/* Next‑class info card */}
            {nextClass && (
              <View style={styles.classInfoCard}>
                <Text style={styles.classInfoLabel}>Next Class</Text>
                {/* Row 1: course name (left), room (right) */}
                <View style={styles.classInfoHeader}>
                  <Text
                    style={styles.classInfoTitle}
                    testID="next-class-name"
                  >
                    {nextClass.courseName}
                  </Text>
                  <Text style={styles.classInfoLocation}>
                    {fmtRoom(nextClass.building, nextClass.room) || nextClass.location}
                  </Text>
                </View>
                {/* Row 2: date (left), time (right) */}
                <View style={styles.classInfoHeader}>
                  <Text style={styles.classInfoDate}>
                    {fmtDate(nextClass.start)}
                  </Text>
                  <Text style={styles.classInfoTime}>
                    {fmtTime(nextClass.start)} – {fmtTime(nextClass.end)}
                  </Text>
                </View>
              </View>
            )}

            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner} testID="next-class-error">
                <MaterialIcons name="error-outline" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            
            {/* Origin / Destination */}
            <View style={styles.originDestinationCard}>
              <LocationInputRow
                testID="next-class-start-input"
                placeholder="From"
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
                placeholder="To (select a course)"
                value={destLoc}
                onChangeText={(t) => handleSearch("destination", t)}
                groupStyle={[styles.inputGroup, styles.inputGroupLast]}
                iconSlot={
                  <MaterialIcons name="place" size={20} color={colors.primary} />
                }
                onPickPress={showCoursePicker}
                pickLabel="Pick destination from course list"
              />
            </View>

            {/* Strategy buttons (hidden while picking) */}
            {!showingList && (
              <View style={styles.modeSection}>
                <View style={styles.modeContainer}>
                  {ALL_STRATEGIES.map((strategy) => {
                    const isActive = selectedStrategy.mode === strategy.mode;
                    const strategyColor = isActive ? colors.white : colors.primary;
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

            {/* Unified suggestion list */}
            <SuggestionList
              buildings={filteredBuildings}
              courses={filteredCourses}
              onSelectBuilding={selectBuilding}
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
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}
