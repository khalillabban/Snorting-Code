import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { spacing } from "../constants/theme";
import { RouteStep } from "../constants/type";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { useBottomInset } from "../hooks/useBottomInset";
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
  const bottomInset = useBottomInset();
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (steps.length === 0) return null;

  const stepSignature = steps
    .map(
      (step) =>
        `${step.instruction}|${step.distance ?? ""}|${step.duration ?? ""}|${Boolean(step.onPress)}`,
    )
    .join("||");

  React.useEffect(() => {
    setIsExpanded(false);
  }, [stepSignature, strategy.mode]);

  const stepCountLabel = `${steps.length} step${steps.length === 1 ? "" : "s"}`;

  return (
    <View
      style={[styles.panel, { bottom: spacing.lg + spacing.md + bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <View style={styles.modeBadge}>
              <MaterialCommunityIcons
                name={strategy.icon as any}
                size={18}
                color={colors.white}
              />
              <Text style={styles.modeLabel}>{strategy.label}</Text>
            </View>
            <Text style={styles.headerSummary}>
              {isExpanded
                ? stepCountLabel
                : `${stepCountLabel} hidden to keep the route visible`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {onFocusUser && (
              <Pressable
                onPress={onFocusUser}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Center on my location"
              >
                <MaterialIcons name="my-location" size={18} color={colors.primary} />
              </Pressable>
            )}
            <Pressable
              onPress={() => setIsExpanded((value) => !value)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded ? "Collapse directions steps" : "Expand directions steps"
              }
            >
              <MaterialIcons
                name={isExpanded ? "expand-more" : "expand-less"}
                size={18}
                color={colors.primary}
              />
            </Pressable>
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
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel="Close directions"
              >
                <MaterialIcons name="close" size={18} color={colors.gray500} />
              </Pressable>
            )}
          </View>
        </View>

        {isExpanded ? (
          <ScrollView
            style={styles.stepsScroll}
            contentContainerStyle={styles.stepsContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            {steps.map((step, index) => {
              const normalizedInstruction = step.instruction.toLowerCase();
              const isShuttle =
                normalizedInstruction.includes("shuttle") ||
                normalizedInstruction.includes("board");

              const stepKey = `${step.instruction}-${step.distance ?? ""}-${step.duration ?? ""}-${index}`;
              const isContinueIndoorsCta =
                Boolean(step.onPress) && index === steps.length - 1;

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
                        {[step.distance, step.duration].filter(Boolean).join(" - ")}
                      </Text>
                    )}
                  </View>

                  {isContinueIndoorsCta && (
                    <View style={styles.ctaChevron}>
                      <MaterialIcons
                        name="chevron-right"
                        size={24}
                        color={colors.primary}
                      />
                    </View>
                  )}
                </StepWrapper>
              );
            })}
          </ScrollView>
        ) : (
          <Pressable
            style={styles.collapsedPreview}
            onPress={() => setIsExpanded(true)}
            accessibilityRole="button"
            accessibilityLabel="Open route steps preview"
          >
            <Text style={styles.collapsedPreviewTitle}>{stepCountLabel} available</Text>
            <Text style={styles.collapsedPreviewText}>
              Expand to view turn-by-turn directions without covering the map by
              default.
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
