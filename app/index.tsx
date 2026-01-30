import { Text, View, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CampusKey } from "../constants/campuses";

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
    backgroundColor: "#912338",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#f2f2f2",
    marginBottom: 32,
  },
  button: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    marginBottom: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#912338",
  },
});
