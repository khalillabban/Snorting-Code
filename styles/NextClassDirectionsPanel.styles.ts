import { Dimensions, Platform, StyleSheet } from "react-native";
import {
  borderRadius,
  colors as defaultColors,
  spacing,
  typography,
  type ThemePalette,
} from "../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
export const FULL_HEIGHT = SCREEN_HEIGHT * (Platform.OS === "ios" ? 0.9 : 0.95);

export const createStyles = (colors: ThemePalette = defaultColors) =>
  StyleSheet.create({
    keyboardContainer: {
      position: "absolute",
      width: "100%",
      height: "100%",
      zIndex: 1000,
      justifyContent: "flex-end",
    },
    sheet: {
      height: FULL_HEIGHT,
      backgroundColor: colors.white,
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: -10 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 20,
    },
    gestureArea: {
      width: "100%",
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    handle: {
      width: 40,
      height: 5,
      backgroundColor: "#D1D1D6",
      borderRadius: 3,
      marginBottom: 10,
    },
    content: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.3)",
      zIndex: 999,
    },

    // Next Class Info
    classInfoCard: {
      backgroundColor: colors.offWhite,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    classInfoHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: spacing.xs,
    },
    classInfoTitle: {
      fontSize: typography.heading.fontSize,
      fontWeight: "700",
      color: colors.primary,
    },
    classInfoTime: {
      fontSize: typography.body.fontSize,
      color: colors.gray700,
      fontWeight: "500",
    },
    classInfoLocation: {
      fontSize: typography.body.fontSize,
      color: colors.gray500,
    },
    classInfoDate: {
      fontSize: typography.caption.fontSize,
      color: colors.gray500,
      flex: 1,
      marginTop: 2,
    },
    classInfoLabel: {
      fontSize: typography.caption.fontSize,
      color: colors.gray300,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.xs,
    },
    secondaryActionButton: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.white,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.md,
    },
    secondaryActionButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "600",
    },

    // Error banner
    errorBanner: {
      backgroundColor: "#fce4ec",
      borderRadius: borderRadius.sm,
      padding: spacing.sm,
      marginBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    errorText: {
      fontSize: typography.caption.fontSize,
      color: colors.error,
      flex: 1,
    },

    // Origin/destination inputs
    originDestinationCard: {
      backgroundColor: colors.offWhite,
      borderRadius: 12,
      marginBottom: spacing.md,
      overflow: "hidden",
    },
    inputGroup: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.md,
      minHeight: 52,
    },
    inputGroupFirst: {
      paddingTop: 4,
      paddingBottom: 2,
    },
    inputGroupLast: {
      paddingTop: 2,
      paddingBottom: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.gray100,
    },
    inputIconWrap: {
      marginRight: spacing.sm,
      width: 24,
      alignItems: "center",
    },
    originDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    swapButton: {
      alignSelf: "center",
      padding: spacing.sm,
      marginVertical: 2,
    },
    pickButton: {
      padding: spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: colors.black,
      paddingVertical: 12,
    },

    // Mode/strategy buttons
    modeSection: {
      marginBottom: spacing.md,
    },
    modeContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 4,
    },
    modeButton: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: spacing.xs,
      paddingHorizontal: 2,
      borderRadius: 8,
      backgroundColor: colors.gray100,
    },
    disabledModeButton: {
      backgroundColor: colors.gray300,
      opacity: 0.6,
    },
    activeModeButton: {
      backgroundColor: colors.primary,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    modeText: {
      fontSize: 10,
      marginTop: 2,
      fontWeight: "600",
    },
    modeSummary: {
      fontSize: 10,
      marginTop: 1,
      fontWeight: "500",
      textAlign: "center",
    },
    routeSummaryText: {
      marginTop: spacing.sm,
      fontSize: 14,
      color: colors.gray700,
      textAlign: "center",
    },

    // Suggestion list (courses/buildings)
    suggestionList: {
      marginTop: spacing.xs,
      maxHeight: 220,
      backgroundColor: colors.white,
      borderRadius: 12,
      overflow: "hidden",
    },
    suggestionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.gray100,
    },
    suggestionText: {
      fontSize: 15,
      color: "#333",
      fontWeight: "500",
    },
    suggestionSubtext: {
      fontSize: 12,
      color: "#999",
    },

    // Get Directions button
    searchButton: {
      backgroundColor: colors.primary,
      minHeight: 52,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
      marginTop: spacing.md,
    },
    searchButtonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: "bold",
    },

    roomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.secondaryTransparent,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.gray100,
    },
    roomBadgeText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary,
    },

    roomTag: {
      backgroundColor: colors.secondaryTransparent,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    roomTagText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.secondary,
    },
  });

export const styles = createStyles();
