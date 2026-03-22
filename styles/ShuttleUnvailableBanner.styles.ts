import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
export const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.offWhite,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 4,
  },
  compact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  icon: {
    marginRight: spacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  reason: {
    ...typography.body,
    color: colors.gray700,
    fontWeight: "500",
  },
  reasonCompact: {
    fontSize: 12,
  },
  summary: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  summaryCompact: {
    fontSize: 11,
  },
});
