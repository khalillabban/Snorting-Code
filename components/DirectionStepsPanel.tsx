import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { borderRadius, colors, spacing, typography } from "../constants/theme";
import { RouteStep } from "../services/GoogleDirectionsService";
import { RouteStrategy } from "../services/Routing";

interface DirectionStepsPanelProps {
  steps: RouteStep[];
  strategy: RouteStrategy;
  onChangeRoute: () => void;
  onDismiss?: () => void;
}

export function DirectionStepsPanel({
  steps,
  strategy,
  onChangeRoute,
  onDismiss,
}: DirectionStepsPanelProps) {
  if (steps.length === 0) return null;

  return (
    <View style={styles.panel} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.modeBadge}>
            <MaterialCommunityIcons
              name={strategy.icon as any}
              size={18}
              color={colors.white}
            />
            <Text style={styles.modeLabel}>{strategy.label}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={onChangeRoute}
              style={styles.changeButton}
              accessibilityRole="button"
              accessibilityLabel="Change route or travel mode"
            >
              <Text style={styles.changeButtonText}>Change route</Text>
            </Pressable>
            {onDismiss && (
              <Pressable
                onPress={onDismiss}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close directions"
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
        <ScrollView
          style={styles.stepsScroll}
          contentContainerStyle={styles.stepsContent}
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
        >
          {steps.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={styles.stepLeft}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                {index < steps.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepInstruction}>{step.instruction}</Text>
                {(step.distance || step.duration) && (
                  <Text style={styles.stepMeta}>
                    {[step.distance, step.duration].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: 120,
    maxHeight: "42%",
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    gap: 6,
  },
  modeLabel: {
    color: colors.white,
    fontSize: typography.body.fontSize,
    fontWeight: "600",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
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
  closeText: {
    fontSize: 20,
    color: colors.gray500,
    lineHeight: 24,
  },
  stepsScroll: {
    maxHeight: 240,
  },
  stepsContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    paddingLeft: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  stepLeft: {
    alignItems: "center",
    marginRight: spacing.sm + 2,
  },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepLine: {
    width: 2,
    minHeight: 20,
    marginTop: 4,
    backgroundColor: colors.gray100,
    borderRadius: 1,
  },
  stepNumberText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
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
  stepMeta: {
    fontSize: typography.caption.fontSize,
    color: colors.gray500,
    marginTop: 4,
    letterSpacing: 0.2,
  },
});
