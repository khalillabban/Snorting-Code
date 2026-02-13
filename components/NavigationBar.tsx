import { MaterialIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { BUILDINGS } from "../constants/buildings";
import { Buildings } from "../constants/type";
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
  onConfirm: (start: Buildings | null, destination: Buildings | null) => void;
}

export default function NavigationBar({
  visible,
  onClose,
  onConfirm,
}: NavigationBarProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [shouldRender, setShouldRender] = useState(visible);

  const [startLoc, setStartLoc] = useState(""); // TODO: Implement start location search
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);

  const [filteredBuildings, setFilteredBuildings] = useState<Buildings[]>([]);
  const [activeInput, setActiveInput] = useState<"start" | "destination" | null>(null);

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

  // Filtering Logic
  const handleSearch = (text: string, type: "start" | "destination") => {
    setActiveInput(type);
    if (type === "start") setStartLoc(text);
    else setDestLoc(text);

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

  const handleConfirm = () => {
    onConfirm(startBuilding, destBuilding);
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
            <View style={styles.inputGroup}>
              <MaterialIcons
                name="trip-origin"
                size={20}
                color={colors.primary}
              />
              <TextInput
                style={styles.input}
                placeholder="Starting location"
                placeholderTextColor="#999"
                value={startLoc}
                onChangeText={(text) => handleSearch(text, "start")}
              />
            </View>
            <View style={styles.inputGroup}>
              <MaterialIcons name="place" size={20} color={colors.primary} />
              <TextInput
                style={styles.input}
                placeholder="Search Here"
                placeholderTextColor="#999"
                value={destLoc}
                onChangeText={(text) => handleSearch(text, "destination")}
              />
            </View>

            {/* BUILDING SUGGESTIONS */}
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
              /* CONFIRM BUTTON (Only shows when not searching) */
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
