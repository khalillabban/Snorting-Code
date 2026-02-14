import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import NavigationBar from "../components/NavigationBar";
import type { CampusKey } from "../constants/campuses";
import { CAMPUSES } from "../constants/campuses";
import { colors, spacing, typography } from "../constants/theme";
import { Buildings } from "../constants/type";

type FocusTarget = CampusKey | "user";

export default function CampusMapScreen() {
  const { campus } = useLocalSearchParams<{ campus?: CampusKey }>();

  const [currentCampus, setCurrentCampus] = useState<CampusKey>(
    campus === "loyola" ? "loyola" : "sgw",
  );

  const [focusTarget, setFocusTarget] = useState<FocusTarget>(
    campus === "loyola" ? "loyola" : "sgw",
  );

  const [isNavVisible, setIsNavVisible] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{
    start: Buildings | null;
    dest: Buildings | null;
  }>({ start: null, dest: null });

  useEffect(() => {
    setCurrentCampus(campus === "loyola" ? "loyola" : "sgw");
    setFocusTarget((prev) =>
      prev === "user" ? prev : campus === "loyola" ? "loyola" : "sgw",
    );
  }, [campus]);

  const selectCampus = (campusKey: CampusKey) => {
    setCurrentCampus(campusKey);
    setFocusTarget(campusKey);
  };

  const focusUserLocation = () => {
    setFocusTarget("user");
  };

  const handleConfirmRoute = (
    start: Buildings | null,
    dest: Buildings | null,
  ) => {
    setSelectedRoute({ start, dest });
    setIsNavVisible(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <CampusMap
        coordinates={CAMPUSES[currentCampus].coordinates}
        focusTarget={focusTarget}
        startPoint={selectedRoute.start}
        destinationPoint={selectedRoute.dest}
      />

      {/* Campus Toggle */}
      <View style={styles.campusToggleContainer} pointerEvents="box-none">
        <View style={styles.campusToggle}>
          <Pressable
            onPress={() => selectCampus("sgw")}
            testID = "campus-toggle-sgw"
            style={[
              styles.campusToggleOption,
              styles.campusToggleOptionLeft,
              currentCampus === "sgw" && styles.campusToggleOptionActive,
            ]}
          >
            <Text
              style={[
                styles.campusToggleText,
                currentCampus === "sgw" && styles.campusToggleTextActive,
              ]}
            >
              SGW
            </Text>
          </Pressable>

          <Pressable
            onPress={() => selectCampus("loyola")}
            testID="campus-toggle-loyola"
            style={[
              styles.campusToggleOption,
              currentCampus === "loyola" && styles.campusToggleOptionActive,
            ]}
          >
            <Text
              style={[
                styles.campusToggleText,
                currentCampus === "loyola" && styles.campusToggleTextActive,
              ]}
            >
              Loyola
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Floating Buttons */}
      <View style={styles.buttonStack}>
        <Pressable
          onPress={() => setIsNavVisible(true)}
          style={styles.actionButton}
        >
          <MaterialIcons name="directions" size={24} color={colors.white} />
        </Pressable>

        <Pressable
          onPress={focusUserLocation}
          testID="my-location-button"
          style={[
            styles.actionButton,
            focusTarget === "user" && styles.myLocationButtonActive,
          ]}
        >
          <MaterialIcons name="my-location" size={22} color={colors.white} />
        </Pressable>
      </View>

      {/* The Draggable Navigation Bar */}
      <NavigationBar
        visible={isNavVisible}
        onClose={() => setIsNavVisible(false)}
        onConfirm={handleConfirmRoute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  campusToggleContainer: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  campusToggle: {
    flexDirection: "row",
    backgroundColor: colors.offWhite,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 160,
    opacity: 0.93,
  },
  campusToggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  campusToggleOptionLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.primaryDarker,
  },
  campusToggleOptionActive: {
    backgroundColor: colors.primaryBarelyTransparent,
  },
  campusToggleText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  campusToggleTextActive: {
    color: colors.white,
  },
  buttonStack: {
    position: "absolute",
    bottom: 50,
    right: spacing.md,
    gap: 12,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  myLocationButtonActive: {
    backgroundColor: colors.primary,
  },
});
