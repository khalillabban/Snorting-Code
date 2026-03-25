import { StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";

export const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray300,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
    gap: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.gray700,
  },
  chipLabelActive: {
    color: "#fff",
  },
});
