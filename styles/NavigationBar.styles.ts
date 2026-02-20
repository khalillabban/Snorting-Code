import { Dimensions, StyleSheet } from "react-native";
import { colors, spacing } from "../constants/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
export const FULL_HEIGHT = SCREEN_HEIGHT * 0.9;
export const PEEK_HEIGHT = 120;

export const styles = StyleSheet.create({
  keyboardContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 1000,
    justifyContent: "flex-end",
  },
  sheet: {
    height: FULL_HEIGHT,
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    shadowColor: "#000",
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
  header: {
    width: "100%",
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: "white",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    width: 40,
    height: 5,
    backgroundColor: "#D1D1D6",
    borderRadius: 3,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  content: {
    padding: spacing.lg,
    flex: 1,
  },
  originDestinationCard: {
    backgroundColor: colors.offWhite,
    borderRadius: 12,
    marginBottom: spacing.lg,
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
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.black,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: colors.primary,
    minHeight: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.lg,
  },
  searchButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 999,
  },
  suggestionList: {
    marginTop: spacing.xs,
    maxHeight: 280,
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
  modeSection: {
    marginBottom: spacing.lg,
  },
  modeContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  routeSummaryText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.gray700,
    textAlign: "center",
  },
  modeButton: {
    flex: 1,
    minWidth: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.gray100,
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
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "600",
  },
});
