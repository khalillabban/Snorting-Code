import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";
import { colors } from "../constants/theme";
import { styles } from "../styles/ShuttleUnvailableBanner.styles";

type ShuttleUnavailableBannerProps = Readonly<{
  reason: string;
  operatingSummary?: string;
  compact?: boolean;
}>;

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
        <Text
          style={[styles.reason, compact && styles.reasonCompact]}
          numberOfLines={2}
        >
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
