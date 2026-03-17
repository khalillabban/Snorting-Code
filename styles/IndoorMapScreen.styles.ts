import { StyleSheet } from "react-native";

import { borderRadius, colors, spacing, typography } from "../constants/theme";
export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.secondaryLight,
  },
  title: {
    flex: 1,
    fontSize: typography.heading.fontSize,
    fontWeight: typography.heading.fontWeight,
    color: colors.secondaryDark,
    marginLeft: spacing.sm,
  },
  floorSelectorWrapper: {
    backgroundColor: colors.offWhite,
  },
  floorSelector: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  floorButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray300,
  },
  floorButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  floorButtonText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.button.fontWeight,
    color: colors.primary,
  },
  floorButtonTextActive: {
    color: colors.white,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.gray100,
  },
  scrollContent: {
    flexGrow: 1,
  },
  mapImage: {
    width: "100%",
    height: "100%",
  },
});
