import {
    StyleSheet
} from "react-native";
import { colors, spacing, typography } from "../constants/theme";
export const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 20,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 0,
  },
  card: {
    zIndex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "80%",
    paddingBottom: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gray100,
    marginTop: 8,
    marginBottom: 6,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.primaryDark,
  },
  currentTimeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 2,
  },
  currentTimeLabel: {
    fontSize: 10,
    color: colors.white,
    opacity: 0.9,
  },
  currentTimeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  closeButton: {
    padding: 6,
    marginTop: -2,
  },
  closeText: {
    fontSize: 20,
    color: colors.gray700,
  },

  weekendMessage: {
    padding: spacing.lg,
    alignItems: "center",
  },
  weekendText: {
    ...typography.body,
    color: colors.gray700,
    textAlign: "center",
  },
  weekendSubtext: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.gray500,
  },

  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontWeight: "700",
    color: colors.gray700,
  },
  tabTextActive: {
    color: colors.white,
  },

  nextCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.primaryTransparent,
    borderWidth: 1,
    borderColor: colors.primaryBarelyTransparent ?? colors.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nextCardLeft: {
    flex: 1,
  },
  nextCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDark,
    opacity: 0.9,
    marginBottom: 4,
  },
  nextCardTime: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  nextCardRight: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  nextInLabel: {
    fontSize: 11,
    color: colors.gray500,
    fontWeight: "700",
  },
  nextInValue: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.primaryDark,
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  modePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.primary,
  },
  modePillText: {
    fontWeight: "800",
    color: colors.gray700,
  },
  modePillTextActive: {
    color: colors.white,
  },

  scroll: {
    marginTop: spacing.sm,
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.gray700,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  hourHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  hourHeaderText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.gray500,
    letterSpacing: 0.3,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.white,
  },
  rowHighlight: {
    backgroundColor: colors.primaryTransparent,
    borderColor: colors.primary,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  timeCell: {
    fontSize: 15,
    color: colors.gray700,
    fontWeight: "700",
  },
  timeCellHighlight: {
    color: colors.primaryDark,
  },
  subRow: {
    marginTop: 4,
    fontSize: 12,
    color: colors.gray500,
    fontWeight: "600",
  },
  subRowEmph: {
    color: colors.primaryDark,
    fontWeight: "900",
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeNow: {
    backgroundColor: colors.primary,
  },
  badgeNext: {
    backgroundColor: colors.gray700,
  },
  badgeEta: {
    backgroundColor: colors.gray100,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.white,
  },

  linkButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 14,
  },
});
