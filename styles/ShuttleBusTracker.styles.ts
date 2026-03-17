import {
    StyleSheet
} from "react-native";
export const styles = StyleSheet.create({
  container: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  card: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  bold: { fontWeight: "bold" },
  subtext: { fontSize: 12, color: "#555" },
  busItem: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc" },
  coords: { fontSize: 10, color: "#888" },
  emptyText: { fontStyle: "italic", color: "#999", marginTop: 10 },
});
