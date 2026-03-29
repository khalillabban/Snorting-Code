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
  poiPanel: {
    position: "absolute",
    top: 80,
    left: spacing.md,
    right: spacing.md,
    zIndex: 9,
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  poiSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  poiSearchButtonDisabled: {
    opacity: 0.6,
  },
  poiSearchButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
});
