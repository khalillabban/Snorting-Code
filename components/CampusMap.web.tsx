import { StyleSheet, View, Text, Linking, Pressable } from "react-native";

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function CampusMap({ coordinates }: { coordinates: Coordinates }) {
  const mapsUrl = `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`;

  return (
    <View style={styles.container}>
      <View style={styles.fallback}>
        <Text style={styles.text}>Maps are available in the mobile app.</Text>
        <Pressable
          style={styles.button}
          onPress={() => Linking.openURL(mapsUrl)}
        >
          <Text style={styles.buttonText}>Open in Google Maps</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  text: {
    fontSize: 16,
    marginBottom: 16,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
