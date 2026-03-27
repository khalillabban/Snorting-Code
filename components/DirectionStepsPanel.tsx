import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { colors } from "../constants/theme";
import { RouteStep } from "../constants/type";
import { RouteStrategy } from "../services/Routing";
import { styles } from "../styles/DirectionStepsPanel.styles";

type StepWrapperProps = {
  readonly onPress?: () => void;
  readonly children: React.ReactNode;
};

function StepWrapper({ onPress, children }: StepWrapperProps) {
  if (!onPress) {
    return <View style={styles.stepRow}>{children}</View>;
  }

  return (
    <Pressable
      style={styles.stepRow}
      onPress={onPress}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

type ActionableRouteStep = RouteStep & {
  readonly onPress?: () => void;
};

interface DirectionStepsPanelProps {
  readonly steps: ActionableRouteStep[];
  readonly strategy: RouteStrategy;
  readonly onChangeRoute: () => void;
  readonly onDismiss?: () => void;
  readonly onFocusUser?: () => void;
}

export function DirectionStepsPanel({
  steps,
  strategy,
  onChangeRoute,
  onDismiss,
  onFocusUser,
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
            {onFocusUser && (
              <Pressable
                onPress={onFocusUser}
                style={styles.locationButton}
                accessibilityRole="button"
                accessibilityLabel="Center on my location"
              >
                <MaterialIcons
                  name="my-location"
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
            )}
            <Pressable
              onPress={onChangeRoute}
              style={styles.changeButton}
              accessibilityRole="button"
              accessibilityLabel="Change route"
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
          {steps.map((step, index) => {
            // Check if this is a shuttle-specific step
            const isShuttle =
              step.instruction.toLowerCase().includes("shuttle") ||
              step.instruction.toLowerCase().includes("board");

            const stepKey = `${step.instruction}-${step.distance ?? ""}-${step.duration ?? ""}-${index}`;

            return (
              <StepWrapper key={stepKey} onPress={step.onPress}>
                <View style={styles.stepLeft}>
                  <View
                    style={[
                      styles.stepIconContainer,
                      isShuttle && styles.shuttleStepHighlight,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isShuttle ? "bus" : "walk"}
                      size={14}
                      color={colors.white}
                    />
                  </View>
                  {index < steps.length - 1 && <View style={styles.stepLine} />}
                </View>

                <View style={styles.stepBody}>
                  {/* Make the shuttle instruction bold to stand out */}
                  <Text
                    style={[
                      styles.stepInstruction,
                      isShuttle && styles.shuttleTextBold,
                    ]}
                  >
                    {step.instruction}
                  </Text>

                  {(step.distance || step.duration) && (
                    <Text style={styles.stepMeta}>
                      {[step.distance, step.duration]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  )}
                </View>
              </StepWrapper>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
