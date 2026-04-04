import { StyleSheet } from "react-native";
import { colors as defaultColors, type ThemePalette } from "../constants/theme";

export const createStyles = (colors: ThemePalette = defaultColors) =>
  StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: colors.offWhite,
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
    color: colors.gray500,
  },
  time: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.gray700,
  },
  noShuttle: {
    fontSize: 14,
    color: colors.gray500,
    fontStyle: "italic",
  },
  });

export const styles = createStyles();
