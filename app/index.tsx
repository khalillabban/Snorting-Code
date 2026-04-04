import { logUsabilityEvent } from "@/utils/usabilityAnalytics";
import { useRouter } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { ColorAccessibilitySettingsModal } from "../components/ColorAccessibilitySettingsModal";
import { CampusKey } from "../constants/campuses";
import {
    borderRadius,
    spacing,
    typography,
    type ThemePalette,
} from "../constants/theme";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";

function createStyles(colors: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.lg,
    },
    title: {
      ...typography.title,
      color: colors.white,
      marginBottom: spacing.sm,
      textAlign: "center",
    },
    subtitle: {
      ...typography.subtitle,
      color: colors.offWhite,
      marginBottom: spacing.md,
      textAlign: "center",
    },
    modeChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primarySemiTransparent,
      borderWidth: 1,
      borderColor: colors.white,
      marginBottom: spacing.xl,
      alignItems: "center",
    },
    modeChipText: {
      ...typography.caption,
      color: colors.white,
      textTransform: "uppercase",
      letterSpacing: 1,
      fontWeight: "700",
    },
    button: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: borderRadius.md,
      backgroundColor: colors.white,
      marginBottom: spacing.md,
      alignItems: "center",
    },
    buttonText: {
      ...typography.button,
      color: colors.primary,
    },
    footerHint: {
      marginTop: spacing.sm,
      color: colors.offWhite,
      fontSize: 12,
      textAlign: "center",
    },
  });
}

export default function Index() {
  const router = useRouter();
  const { colors, mode } = useColorAccessibility();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // ── Usability Testing: Task 8 timing ─────────────────────────────────────
  const homeLoadTime = useRef<number>(Date.now());

  const goToCampus = (campus: CampusKey) => {
    // ── Task 8 (last step): User went back to Home and tapped SGW ───────────
    void logUsabilityEvent("home_campus_button_tapped", {
      campus,
      time_since_home_load_ms: Date.now() - homeLoadTime.current,
    });
    router.push({
      pathname: "/CampusMapScreen",
      params: { campus },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Concordia Maps</Text>
      <Text style={styles.subtitle}>Select a campus</Text>

      <Pressable
        style={styles.modeChip}
        onPress={() => setSettingsVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Change color mode"
        testID="home-color-mode-button"
      >
        <Text style={styles.modeChipText}>Color mode: {mode === "classic" ? "Classic" : mode === "redGreenSafe" ? "Red-Green Safe" : mode === "blueYellowSafe" ? "Blue-Yellow Safe" : "High Contrast"}</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => goToCampus("sgw")}>
        <Text style={styles.buttonText}>SGW Campus</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => goToCampus("loyola")}>
        <Text style={styles.buttonText}>Loyola Campus</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => {
          // Task 8: My Schedule button tapped
          void logUsabilityEvent("my_schedule_button_tapped", {
            time_since_home_load_ms: Date.now() - homeLoadTime.current,
          });
          router.push("/schedule" as any);
        }}
      >
        <Text style={styles.buttonText}>My Schedule</Text>
      </Pressable>

      <Text style={styles.footerHint}>
        Tap the color mode button to switch to a color-blind-friendly palette.
      </Text>

      <ColorAccessibilitySettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </View>
  );
}
