import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import type { CampusKey } from "../constants/campuses";
import { CAMPUSES } from "../constants/campuses";
import { borderRadius, colors, spacing, typography } from "../constants/theme";

type FocusTarget = CampusKey | "user";

export default function CampusMapScreen() {
  const { campus } = useLocalSearchParams<{ campus?: CampusKey }>();

  const [currentCampus, setCurrentCampus] = useState<CampusKey>(
    campus === "loyola" ? "loyola" : "sgw",
  );

  const [focusTarget, setFocusTarget] = useState<FocusTarget>(
    campus === "loyola" ? "loyola" : "sgw",
  );

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

  return (
    <View style={{ flex: 1 }}>
      <CampusMap
        coordinates={CAMPUSES[currentCampus].coordinates}
        focusTarget={focusTarget}
      />

      <View style={styles.campusToggleContainer} pointerEvents="box-none">
        <View style={styles.campusToggle}>
          <Pressable
            testID="campus-toggle-sgw"
            accessibilityRole="button"
            onPress={() => selectCampus("sgw")}
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
            testID="campus-toggle-loyola"
            accessibilityRole="button"
            onPress={() => selectCampus("loyola")}
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

      <Pressable
        testID="my-location-button"
        accessibilityRole="button"
        accessibilityLabel="Center on my location"
        onPress={focusUserLocation}
        style={[
          styles.myLocationButton,
          focusTarget === "user" && styles.myLocationButtonActive,
        ]}
      >
        <MaterialIcons
          name="my-location"
          size={22}
          color={colors.white}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  campusToggleContainer: {
    position: "absolute",
    top: Platform.OS === "ios" ? 20 : 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  campusToggle: {
    flexDirection: "row",
    backgroundColor: colors.offWhite,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden", maxWidth: 150, opacity: 0.93,  },
  campusToggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
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
  myLocationButton: {
    position: "absolute",
    bottom: 60,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primarySemiTransparent,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  myLocationButtonActive: {
    backgroundColor: colors.primary,
  },
});
