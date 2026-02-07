// BuildingInfoPopup.styles.ts 
import { StyleSheet } from "react-native";
import { borderRadius, colors, spacing, typography } from "../constants/theme";

export const styles = StyleSheet.create({
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: spacing.md,
    zIndex: 1000,
    elevation: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20, 
    marginBottom: spacing.lg,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.gray300,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    color: colors.primary,
  },
  address: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: colors.offWhite,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  closeText: {
    fontSize: 16,
    color: colors.gray700,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    ...typography.body,
    fontWeight: "600",
    marginRight: 8,
  },
  value: {
    ...typography.body,
    color: colors.gray700,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  actionButtonText: {
    ...typography.button,
    color: colors.white,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.offWhite,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  tabFull: {
    flex: 1,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.gray700,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabContent: {
    maxHeight: 110,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  tabItem: {
    ...typography.body,
    color: colors.gray700,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryTransparent, 
    backgroundColor: colors.offWhite,
    borderRadius: borderRadius.sm,
    textAlign: "left",
  },
});