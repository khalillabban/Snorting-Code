// AccessibilityIcons.styles.ts
import { ImageStyle, StyleSheet, ViewStyle } from "react-native";
import { spacing } from "../constants/theme";

export const styles = StyleSheet.create({
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  } as ViewStyle,
});

export const getIconSizeStyle = (size: number): ImageStyle => ({
  width: size,
  height: size,
});