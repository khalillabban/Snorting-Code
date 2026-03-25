import { StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";

export const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray300,
    paddingHorizontal: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
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
