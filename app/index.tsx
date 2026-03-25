import { getAnalytics, logEvent } from "@react-native-firebase/analytics";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CampusKey } from "../constants/campuses";
import { borderRadius, colors, spacing, typography } from "../constants/theme";

export default function Index() {
  const router = useRouter();

  // ── Usability Testing: Task 8 timing ─────────────────────────────────────
  const homeLoadTime = useRef<number>(Date.now());

  const goToCampus = (campus: CampusKey) => {
    // ── Task 8 (last step): User went back to Home and tapped SGW ───────────
    try {
      logEvent(getAnalytics(), "home_campus_button_tapped", {
        campus,
        time_since_home_load_ms: Date.now() - homeLoadTime.current,
      });
    } catch (e) {}
    router.push({
      pathname: "/CampusMapScreen",
      params: { campus },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Concordia Maps</Text>
      <Text style={styles.subtitle}>Select a campus</Text>

      <Pressable style={styles.button} onPress={() => goToCampus("sgw")}>
        <Text style={styles.buttonText}>SGW Campus</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={() => goToCampus("loyola")}>
        <Text style={styles.buttonText}>Loyola Campus</Text>
      </Pressable>

      <Pressable
        style={styles.button}
        onPress={() => {
          // ── Task 8: My Schedule button tapped ──────────────────────────────
          try {
            logEvent(getAnalytics(), "my_schedule_button_tapped", {
              time_since_home_load_ms: Date.now() - homeLoadTime.current,
            });
          } catch (e) {}
          router.push("/schedule" as any);
        }}
      >
        <Text style={styles.buttonText}>My Schedule</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  subtitle: {
    ...typography.subtitle,
    color: colors.offWhite,
    marginBottom: spacing.xl,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.offWhite,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  buttonText: {
    ...typography.button,
    color: colors.primary,
  },
});
