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
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
    zIndex: 90,
  },
  card: {
    flex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: "600",
    color: colors.gray700,
  },
  headerCount: {
    fontSize: typography.caption.fontSize,
    color: colors.gray500,
    marginLeft: spacing.xs,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeText: {
    fontSize: 20,
    color: colors.gray500,
    lineHeight: 24,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm + 2,
  },
  rowBody: {
    flex: 1,
  },
  rowName: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.gray700,
  },
  rowVicinity: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 1,
  },
  rowDistance: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.gray500,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.offWhite,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray100,
  },
  locationBannerText: {
    fontSize: 11,
    color: colors.gray500,
  },
});

export const styles = createStyles();
