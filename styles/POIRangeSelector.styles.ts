import { StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";

export const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.gray500,
  },
  buttonsRow: {
    flexDirection: "row",
    flex: 1,
    gap: spacing.xs,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: colors.white,
  },
  buttonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  buttonLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.gray700,
  },
  buttonLabelActive: {
    color: "#fff",
  },
});
