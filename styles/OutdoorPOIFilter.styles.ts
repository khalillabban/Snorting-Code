import { StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";

export const styles = StyleSheet.create({
  wrapper: {
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
    color: colors.gray700,
  },
  chipLabelActive: {
    color: "#fff",
  },
});
