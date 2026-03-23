import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#f0f4f8",
    borderRadius: 8,
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  departureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: "#555",
  },
  time: {
    fontSize: 14,
    fontWeight: "600",
    color: "#222",
  },
  noShuttle: {
    fontSize: 14,
    color: "#888",
    fontStyle: "italic",
  },
});
