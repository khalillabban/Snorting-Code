import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { RouteStep } from "../constants/type";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { RouteStrategy } from "../services/Routing";
import { createStyles } from "../styles/DirectionStepsPanel.styles";

type StepWrapperProps = {
  readonly styles: ReturnType<typeof createStyles>;
  readonly onPress?: () => void;
  readonly isCallToAction?: boolean;
  readonly children: React.ReactNode;
};

export function StepWrapper({
  styles,
  onPress,
  isCallToAction = false,
  children,
}: StepWrapperProps) {
  if (!onPress) {
    return <View style={styles.stepRow}>{children}</View>;
  }

  return (
    <Pressable
      style={[styles.stepRow, isCallToAction && styles.ctaRow]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint={isCallToAction ? "Opens indoor directions" : undefined}
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
  const { colors } = useColorAccessibility();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

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

            const isContinueIndoorsCta = Boolean(step.onPress) && index === steps.length - 1;

            let iconName: "door-open" | "bus" | "walk" = "walk";
            if (isContinueIndoorsCta) {
              iconName = "door-open";
            } else if (isShuttle) {
              iconName = "bus";
            }

            return (
              <StepWrapper
                key={stepKey}
                styles={styles}
                onPress={step.onPress}
                isCallToAction={isContinueIndoorsCta}
              >
                <View style={styles.stepLeft}>
                  <View
                    style={[
                      styles.stepIconContainer,
                      isContinueIndoorsCta && styles.ctaIconContainer,
                      isShuttle && styles.shuttleStepHighlight,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
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
                      isContinueIndoorsCta && styles.ctaInstruction,
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

                {isContinueIndoorsCta && (
                  <View style={styles.ctaChevron}>
                    <MaterialIcons name="chevron-right" size={24} color={colors.primary} />
                  </View>
                )}
              </StepWrapper>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}
