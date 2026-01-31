import { Text, View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CampusKey } from "../constants/campuses";
import { colors, typography, spacing, borderRadius } from "../constants/theme";

export default function Index() {
  const router = useRouter();

  const goToCampus = (campus: CampusKey) => {
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
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    alignItems: "center",
  },
  buttonText: {
    ...typography.button,
    color: colors.primary,
  },
});
