import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { BUILDINGS } from "../constants/buildings";
import { ALL_STRATEGIES, WALKING_STRATEGY } from "../constants/strategies";
import { Buildings } from "../constants/type";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/NavigationBar.styles";

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
import { colors } from "../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

interface NavigationBarProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (
    start: Buildings | null,
    destination: Buildings | null,
    strategy: RouteStrategy) => void;
  autoStartBuilding?: Buildings | null;
  initialDestination?: Buildings | null;
  onInitialDestinationApplied?: () => void;
}

export default function NavigationBar({
  visible,
  onClose,
  onConfirm,
  autoStartBuilding,
  initialDestination,
  onInitialDestinationApplied,
}: Readonly<NavigationBarProps>) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const [startLoc, setStartLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);
  const [startManuallyEdited, setStartManuallyEdited] = useState(false);
  const [filteredBuildings, setFilteredBuildings] = useState<Buildings[]>([]);
  const [activeInput, setActiveInput] = useState<
    "start" | "destination" | null
  >(null);
  const [selectedStrategy, setSelectedStrategy] = useState<RouteStrategy>(WALKING_STRATEGY);
  const [routeSummary, setRouteSummary] = useState<{ duration?: string; distance?: string } | null>(null);
  const [routeSummaryLoading, setRouteSummaryLoading] = useState(false);

  useEffect(() => {
    if (!startBuilding || !destBuilding || filteredBuildings.length > 0) {
      setRouteSummary(null);
      return;
    }
    let cancelled = false;
    setRouteSummaryLoading(true);
    setRouteSummary(null);
    getOutdoorRouteWithSteps(
      startBuilding.coordinates,
      destBuilding.coordinates,
      selectedStrategy
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
  }, [startBuilding, destBuilding, selectedStrategy, filteredBuildings.length]);

  // eslint-disable-line react-hooks/exhaustive-deps
  // translateY is a stable ref value and doesn't need to be in dependencies
  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.spring(translateY, {
        toValue: SCREEN_HEIGHT - SHEET_HEIGHT,
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

  useEffect(() => {
    if (autoStartBuilding && !startManuallyEdited) {
      setStartLoc(autoStartBuilding.displayName);
      setStartBuilding(autoStartBuilding);
    }
  }, [autoStartBuilding, startManuallyEdited]);

  useEffect(() => {
    if (visible && initialDestination) {
      setDestLoc(initialDestination.displayName);
      setDestBuilding(initialDestination);
      onInitialDestinationApplied?.();
    }
  }, [visible, initialDestination, onInitialDestinationApplied]);

  const handleSearch = (text: string, type: "start" | "destination") => {
    setActiveInput(type);
    if (type === "start") {
      setStartManuallyEdited(true);
      setStartLoc(text);
    } else setDestLoc(text);

    if (text.length > 0) {
      const filtered = BUILDINGS.filter(
        (b) =>
          b.displayName.toLowerCase().includes(text.toLowerCase()) ||
          b.name.toLowerCase().includes(text.toLowerCase()),
      );
      setFilteredBuildings(filtered);
    } else {
      setFilteredBuildings([]);
    }
  };

  const selectBuilding = (building: Buildings) => {
    if (activeInput === "start") {
      setStartLoc(building.displayName);
      setStartBuilding(building);
    } else {
      setDestLoc(building.displayName);
      setDestBuilding(building);
    }
    setFilteredBuildings([]);
    Keyboard.dismiss();
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
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(SCREEN_HEIGHT - SHEET_HEIGHT + gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: SCREEN_HEIGHT - SHEET_HEIGHT,
            useNativeDriver: true,
            bounciness: 4,
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardContainer}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={styles.gestureArea}>
            <View style={styles.handle} />
          </View>

          <View style={styles.content}>
            <View style={styles.originDestinationCard}>
              <View style={[styles.inputGroup, styles.inputGroupFirst]}>
                <View style={styles.inputIconWrap}>
                  <View style={styles.originDot} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="From"
                  placeholderTextColor={colors.gray500}
                  value={startLoc}
                  onChangeText={(text) => handleSearch(text, "start")}
                />
              </View>
              <Pressable
                style={styles.swapButton}
                onPress={swapOriginDestination}
                accessibilityLabel="Swap origin and destination"
                accessibilityRole="button"
              >
                <MaterialIcons name="swap-vert" size={22} color={colors.gray500} />
              </Pressable>
              <View style={[styles.inputGroup, styles.inputGroupLast]}>
                <View style={styles.inputIconWrap}>
                  <MaterialIcons name="place" size={20} color={colors.primary} />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="To"
                  placeholderTextColor={colors.gray500}
                  value={destLoc}
                  onChangeText={(text) => handleSearch(text, "destination")}
                />
              </View>
            </View>

            {filteredBuildings.length === 0 && (
              <View style={styles.modeSection}>
                <View style={styles.modeContainer}>
                  {ALL_STRATEGIES.map((strategy) => (
                    <Pressable
                      key={strategy.mode}
                      onPress={() => setSelectedStrategy(strategy)}
                      style={[
                        styles.modeButton,
                        selectedStrategy.mode === strategy.mode && styles.activeModeButton
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={strategy.icon as any}
                        size={22}
                        color={selectedStrategy.mode === strategy.mode ? colors.white : colors.primary}
                      />
                      <Text style={[
                        styles.modeText,
                        { color: selectedStrategy.mode === strategy.mode ? colors.white : colors.primary }
                      ]}>
                        {strategy.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {(routeSummaryLoading || routeSummary) && (
                  <Text style={styles.routeSummaryText} numberOfLines={1}>
                    {routeSummaryLoading
                      ? "Loading…"
                      : [routeSummary?.duration, routeSummary?.distance].filter(Boolean).join(" · ") || "—"}
                  </Text>
                )}
              </View>
            )}

            {filteredBuildings.length > 0 ? (
              <FlatList
                data={filteredBuildings}
                keyExtractor={(item) => item.name}
                keyboardShouldPersistTaps="handled"
                style={styles.suggestionList}
                renderItem={({ item }) => (
                  <Pressable
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
