import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";

interface ShuttleUnavailableBannerProps {
  /** Reason to show (e.g. "No bus available during weekend") */
  reason: string;
  /** Optional operating hours summary (e.g. "Mon–Fri 9:15 AM – 7:00 PM") */
  operatingSummary?: string;
  /** Compact style for use near the shuttle button */
  compact?: boolean;
}

/**
 * Informs the user when the Concordia shuttle is not available (time or location).
 * Meets acceptance criterion: "User is informed if shuttle not available".
 */
export function ShuttleUnavailableBanner({
  reason,
  operatingSummary,
  compact = false,
}: ShuttleUnavailableBannerProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <MaterialCommunityIcons
        name="bus-alert"
        size={compact ? 18 : 22}
        color={colors.primaryDark}
        style={styles.icon}
      />
      <View style={styles.textWrap}>
        <Text style={[styles.reason, compact && styles.reasonCompact]} numberOfLines={2}>
          {reason}
        </Text>
        {operatingSummary != null && operatingSummary !== "" && (
          <Text style={[styles.summary, compact && styles.summaryCompact]}>
            {operatingSummary}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.offWhite,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: 4,
  },
  compact: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  icon: {
    marginRight: spacing.sm,
  },
  textWrap: {
    flex: 1,
  },
  reason: {
    ...typography.body,
    color: colors.gray700,
    fontWeight: "500",
  },
  reasonCompact: {
    fontSize: 12,
  },
  summary: {
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
  },
  summaryCompact: {
    fontSize: 11,
  },
});
