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
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
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
// Build a display string like "MB-1.210" from building + room
function fmtRoom(building: string, room: string): string {
  if (!building) return "";
  if (!room) return building;
  return `${building}-${room}`;
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

  // Destination from nextClass
  useEffect(() => {
    if (!nextClass) {
      setDestLoc("");
      setDestBuilding(null);
      return;
    }

    const building = findBuildingByCode(nextClass.building);
    if (!building && nextClass.building) {
      setError(
        `Missing course details for "${nextClass.courseName}".`,
      );
      setDestLoc("");
      setDestBuilding(null);
    } else if (!nextClass.building) {
      setError(
        `Missing course details for "${nextClass.courseName}".`,
      );
      setDestLoc("");
      setDestBuilding(null);
    } else {
      setError(null);
      setDestLoc(building!.displayName);
      setDestBuilding(building);
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
  }, [visible]);

  // Search the start input (filters buildings)
  const handleSearchStart = (text: string) => {
    setActiveInput("start");
    setStartLoc(text);
    setFilteredCourses([]);
    if (text.length > 0) {
      setFilteredBuildings(
        BUILDINGS.filter(
          (b) =>
            b.displayName.toLowerCase().includes(text.toLowerCase()) ||
            b.name.toLowerCase().includes(text.toLowerCase()),
        ),
      );
    } else {
      setFilteredBuildings([]);
    }
  };

  // Search the destination input (filters courses)
  const handleSearchDest = (text: string) => {
    setActiveInput("destination");
    setDestLoc(text);
    setFilteredBuildings([]);
    if (text.length > 0) {
      setFilteredCourses(
        scheduleItems.filter((item) =>
          item.courseName.toLowerCase().includes(text.toLowerCase()),
        ),
      );
    } else {
      setFilteredCourses([]);
    }
  };

  const selectBuilding = (building: Buildings) => {
    setStartLoc(building.displayName);
    setStartBuilding(building);
    setFilteredBuildings([]);
    setActiveInput(null);
    Keyboard.dismiss();
  };

  // When user picks a course from the destination list
  const selectCourse = (item: ScheduleItem) => {
    const building = findBuildingByCode(item.building);
    if (!building) {
      setError(`Missing course details for "${item.courseName}".`);
      setDestLoc("");
      setDestBuilding(null);
    } else {
      setError(null);
      setDestLoc(building.displayName);
      setDestBuilding(building);
    }
    setFilteredCourses([]);
    setActiveInput(null);
    Keyboard.dismiss();
  };

  const showBuildingPicker = () => {
    if (activeInput === "start" && filteredBuildings.length > 0) {
      setFilteredBuildings([]);
      setActiveInput(null);
      return;
    }
    setActiveInput("start");
    setFilteredCourses([]);
    const campusNorm = currentCampus.toLowerCase();
    setFilteredBuildings(
      BUILDINGS.filter(
        (b) =>
          b.boundingBox &&
          b.boundingBox.length >= 3 &&
          (b.campusName || "").toLowerCase() === campusNorm,
      ),
    );
  };

  const showCoursePicker = () => {
    if (activeInput === "destination" && filteredCourses.length > 0) {
      setFilteredCourses([]);
      setActiveInput(null);
      return;
    }
    setActiveInput("destination");
    setFilteredBuildings([]);
    setFilteredCourses(scheduleItems);
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
    setFilteredBuildings([]);
    setFilteredCourses([]);
    setActiveInput(null);
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
                    {fmtTime(nextClass.start)}–{fmtTime(nextClass.end)}
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
              <View style={[styles.inputGroup, styles.inputGroupFirst]}>
                <View style={styles.inputIconWrap}>
                  <View style={styles.originDot} />
                </View>
                <TextInput
                  testID="next-class-start-input"
                  style={styles.input}
                  placeholder="From"
                  placeholderTextColor={colors.gray500}
                  value={startLoc}
                  onChangeText={handleSearchStart}
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
                  onPress={showBuildingPicker}
                  accessibilityLabel="Pick starting building from list"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="list" size={22} color={colors.primary} />
                </Pressable>
              </View>

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

              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <View style={styles.inputIconWrap}>
                  <MaterialIcons
                    name="place"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <TextInput
                  testID="next-class-dest-input"
                  style={styles.input}
                  placeholder="To (select a course)"
                  placeholderTextColor={colors.gray500}
                  value={destLoc}
                  onChangeText={handleSearchDest}
                />
                <Pressable
                  style={styles.pickButton}
                  onPress={showCoursePicker}
                  accessibilityLabel="Pick destination from course list"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="list" size={22} color={colors.primary} />
                </Pressable>
              </View>
            </View>

            {/* Strategy buttons (hidden while picking) */}
            {!showingList && (
              <View style={styles.modeSection}>
                <View style={styles.modeContainer}>
                  {ALL_STRATEGIES.map((strategy) => (
                    <Pressable
                      key={strategy.mode}
                      testID={`next-class-mode-${strategy.mode}`}
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

            {/* Building suggestions (start input) */}
            {filteredBuildings.length > 0 && (
              <FlatList
                data={filteredBuildings}
                keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionList}
                renderItem={({ item }) => (
                  <Pressable
                    testID={`nc-suggestion-${item.name}`}
                    style={styles.suggestionItem}
                    onPress={() => selectBuilding(item)}
                  >
                    <MaterialIcons
                      name="business"
                      size={20}
                      color={colors.primary}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.suggestionText}>
                        {item.displayName}
                      </Text>
                      <Text style={styles.suggestionSubtext}>
                        {item.campusName}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            )}

            {/* Course suggestions (destination input) */}
            {filteredCourses.length > 0 && (
              <FlatList
                data={filteredCourses}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionList}
                renderItem={({ item }) => (
                  <Pressable
                    testID={`nc-course-${item.id}`}
                    style={styles.suggestionItem}
                    onPress={() => selectCourse(item)}
                  >
                    <MaterialIcons
                      name="school"
                      size={20}
                      color={colors.primary}
                    />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.suggestionText}>
                        {item.courseName}
                      </Text>
                      <Text style={styles.suggestionSubtext}>
                        {fmtRoom(item.building, item.room)} · {item.campus}
                      </Text>
                    </View>
                  </Pressable>
                )}
              />
            )}

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
