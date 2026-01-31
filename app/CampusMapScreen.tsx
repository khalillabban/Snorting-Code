import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import CampusMap from "../components/CampusMap";
import { CAMPUSES, CampusKey } from "../constants/campuses";

export default function CampusMapScreen() {
  const { campus } = useLocalSearchParams<{ campus?: CampusKey }>();

  const [currentCampus, setCurrentCampus] = useState<CampusKey>(
    campus === "loyola" ? "loyola" : "sgw"
  );

  const toggleCampus = () => {
    setCurrentCampus((prev) => (prev === "sgw" ? "loyola" : "sgw"));
  };

  return (
    <View style={{ flex: 1 }}>
      <CampusMap coordinates={CAMPUSES[currentCampus].coordinates} />

      {/* Toggle Button Overlay */}
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
    bottom: 30,
    right: 20,
    backgroundColor: "#912338",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    elevation: 5,
  },
  toggleText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
