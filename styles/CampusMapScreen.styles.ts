import { StyleSheet } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

export const styles = StyleSheet.create({
  campusToggleContainer: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
    pointerEvents: "box-none",
  },
  campusToggle: {
    flexDirection: "row",
    backgroundColor: colors.offWhite,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    maxWidth: 160,
    opacity: 0.93,
  },
  campusToggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  campusToggleOptionLeft: {
    borderRightWidth: 1,
    borderRightColor: colors.primaryDarker,
  },
  campusToggleOptionActive: {
    backgroundColor: colors.primaryBarelyTransparent,
  },
  campusToggleText: {
    color: colors.primary,
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
  },
  campusToggleTextActive: {
    color: colors.white,
  },
  buttonStack: {
    position: "absolute",
    bottom: 50,
    right: spacing.md,
    gap: 12,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    borderColor: colors.primaryDarker,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  myLocationButtonActive: {
    backgroundColor: colors.primary,
  },
  shuttleDisabled: {
    backgroundColor: "#666",
    opacity: 0.8,
  },
  nextClassButton: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondaryDark,
  },
  nextClassButtonDisabled: {
    backgroundColor: colors.gray500,
    borderColor: colors.gray500,
    opacity: 0.5,
  },
});
