import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import { CAMPUSES, CampusKey } from "../constants/campuses";
import { borderRadius, colors, spacing, typography } from "../constants/theme";

export default function CampusMapScreen() {
  const { campus } = useLocalSearchParams<{ campus?: CampusKey }>();

  const [currentCampus, setCurrentCampus] = useState<CampusKey>(
    campus === "loyola" ? "loyola" : "sgw",
  );

  useEffect(() => {
    setCurrentCampus(campus === "loyola" ? "loyola" : "sgw");
  }, [campus]);

  const toggleCampus = () => {
    setCurrentCampus((prev) => (prev === "sgw" ? "loyola" : "sgw"));
  };

  return (
    <View style={{ flex: 1 }}>
      <CampusMap coordinates={CAMPUSES[currentCampus].coordinates} />

      <Pressable style={styles.toggleButton} onPress={toggleCampus}>
        <Text style={styles.toggleText}>
          Switch to {currentCampus === "sgw" ? "Loyola" : "SGW"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    position: "absolute",
    bottom: spacing.lg,
    right: spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    elevation: 0,
  },
  toggleText: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
  },
});
