import { Platform, StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";
export const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    right: spacing.md,
    top: "38%",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: 6,
    alignItems: "center",
    // Matches your existing busPin shadow style
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 46,
  },
  pillLabel: {
    fontSize: 10,
    color: colors.gray500 ?? "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  floorBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  floorBtnActive: {
    backgroundColor: colors.primary,
  },
  floorBtnText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.primaryDark ?? "#444",
  },
  floorBtnTextActive: {
    color: colors.white,
  },
  exitBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 16,
    left: spacing.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  exitText: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.primary,
  },
});
