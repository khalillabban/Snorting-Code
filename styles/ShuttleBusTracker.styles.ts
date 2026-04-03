import { StyleSheet } from "react-native";
import { colors as defaultColors, type ThemePalette } from "../constants/theme";

export const createStyles = (colors: ThemePalette = defaultColors) =>
  StyleSheet.create({
  container: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  card: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: colors.offWhite,
    borderRadius: 8,
  },
  bold: { fontWeight: "bold" },
  subtext: { fontSize: 12, color: colors.gray500 },
  busItem: { padding: 10, borderBottomWidth: 1, borderColor: colors.gray300 },
  coords: { fontSize: 10, color: colors.gray500 },
  emptyText: { fontStyle: "italic", color: colors.gray500, marginTop: 10 },
  });

export const styles = createStyles();
