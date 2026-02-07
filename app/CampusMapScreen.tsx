import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import { CAMPUSES } from "../constants/campuses";
import type { CampusKey } from "../constants/campuses";
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

  const cycleFocusTarget = () => {
    setFocusTarget((prev) => {
      const next =
        prev === "sgw" ? "loyola" : prev === "loyola" ? "user" : "sgw";

      if (next === "sgw" || next === "loyola") {
        setCurrentCampus(next);
      }

      return next;
    });
  };

  const focusLabel =
    focusTarget === "user"
      ? "My location"
      : focusTarget === "sgw"
        ? "SGW"
        : "Loyola";

  return (
    <View style={{ flex: 1 }}>
      <CampusMap
        coordinates={CAMPUSES[currentCampus].coordinates}
        focusTarget={focusTarget}
      />

      <Pressable style={styles.focusButton} onPress={cycleFocusTarget}>
        <Text style={styles.focusText}>Center: {focusLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  focusButton: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.md,
    backgroundColor: colors.white,
    borderColor: colors.primary,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    elevation: 0,
  },
  focusText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
  },
});
