import { StyleSheet } from "react-native";
import {
  borderRadius,
  colors as defaultColors,
  spacing,
  typography,
  type ThemePalette,
} from "../constants/theme";

export const createStyles = (colors: ThemePalette = defaultColors) =>
  StyleSheet.create({
    panel: {
      position: "absolute",
      left: spacing.md,
      right: spacing.md,
      bottom: spacing.lg + spacing.md,
      maxHeight: "38%",
      zIndex: 100,
    },
    card: {
      backgroundColor: colors.white,
      borderRadius: borderRadius.lg,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: colors.white,
      borderBottomWidth: 1,
      borderBottomColor: colors.gray100,
    },
    headerCopy: {
      flex: 1,
      gap: spacing.xs,
      marginRight: spacing.sm,
    },
    modeBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
      borderRadius: borderRadius.full,
      gap: 6,
      alignSelf: "flex-start",
    },
    modeLabel: {
      color: colors.white,
      fontSize: typography.body.fontSize,
      fontWeight: "600",
    },
    routeSummary: {
      color: colors.gray700,
      fontSize: typography.caption.fontSize,
      fontWeight: "500",
      lineHeight: 16,
    },
    headerSummary: {
      color: colors.gray500,
      fontSize: typography.caption.fontSize,
      lineHeight: 16,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    iconButton: {
      padding: spacing.xs + 2,
      borderRadius: borderRadius.full,
      backgroundColor: colors.gray100,
    },
    changeButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm + 2,
      backgroundColor: colors.gray100,
      borderRadius: borderRadius.md,
    },
    changeButtonText: {
      color: colors.primary,
      fontSize: typography.caption.fontSize,
      fontWeight: "600",
    },
    stepsScroll: {
      maxHeight: 220,
    },
    stepsContent: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
      paddingLeft: spacing.sm,
    },
    collapsedPreview: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      gap: spacing.xs,
    },
    collapsedPreviewTitle: {
      color: colors.primaryDark,
      fontSize: typography.body.fontSize,
      fontWeight: "600",
    },
    collapsedPreviewText: {
      color: colors.gray500,
      fontSize: typography.caption.fontSize,
      lineHeight: 18,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: spacing.md,
    },
    ctaRow: {
      backgroundColor: colors.primary + "14",
      borderWidth: 1,
      borderColor: colors.primary + "55",
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      marginLeft: -spacing.xs,
      marginRight: -spacing.xs,
    },
    stepLeft: {
      alignItems: "center",
      marginRight: spacing.sm + 2,
    },
    stepIconContainer: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    ctaIconContainer: {
      backgroundColor: colors.primary,
    },
    shuttleStepHighlight: {
      backgroundColor: colors.routeShuttle,
    },
    shuttleTextBold: {
      fontWeight: "700",
      color: colors.black,
    },
    stepLine: {
      width: 2,
      minHeight: 20,
      marginTop: 4,
      backgroundColor: colors.gray100,
      borderRadius: 1,
    },
    stepBody: {
      flex: 1,
      paddingTop: 2,
    },
    stepInstruction: {
      fontSize: 15,
      color: colors.gray700,
      lineHeight: 22,
      fontWeight: "500",
    },
    ctaInstruction: {
      color: colors.primary,
      fontWeight: "700",
    },
    stepMeta: {
      fontSize: typography.caption.fontSize,
      color: colors.gray500,
      marginTop: 4,
      letterSpacing: 0.2,
    },
    ctaChevron: {
      alignSelf: "center",
      marginLeft: spacing.sm,
    },
  });

export const styles = createStyles();
