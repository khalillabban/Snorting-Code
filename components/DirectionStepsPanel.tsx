import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { spacing } from "../constants/theme";
import { RouteStep } from "../constants/type";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { useBottomInset } from "../hooks/useBottomInset";
import { RouteStrategy } from "../services/Routing";
import { createStyles } from "../styles/DirectionStepsPanel.styles";

function parseDistanceMeters(value: string): number | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/^([\d.]+)\s*(km|m|mi|ft)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  switch (match[2]) {
    case "km":
      return amount * 1000;
    case "mi":
      return amount * 1609.34;
    case "ft":
      return amount * 0.3048;
    default:
      return amount;
  }
}

function parseDurationMinutes(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const hourMatch = /(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)\b/.exec(
    normalized,
  );
  const minuteMatch = /(\d+(?:\.\d+)?)\s*(?:minutes|minute|mins|min|m)\b/.exec(
    normalized,
  );
  const secondMatch = /(\d+(?:\.\d+)?)\s*(?:seconds|second|secs|sec|s)\b/.exec(
    normalized,
  );

  if (!hourMatch && !minuteMatch && !secondMatch) return null;

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  const seconds = secondMatch ? Number(secondMatch[1]) : 0;

  if (![hours, minutes, seconds].every(Number.isFinite)) return null;

  return hours * 60 + minutes + seconds / 60;
}

function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "";
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km % 1 === 0 ? km.toFixed(0) : km.toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = Math.round(minutes % 60);
    if (remaining === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
    return `${hours} hr${hours === 1 ? "" : "s"} ${remaining} min`;
  }
  return `${Math.round(minutes)} min`;
}

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

type RouteSummary = {
  readonly duration?: string;
  readonly distance?: string;
} | null;

interface DirectionStepsPanelProps {
  readonly steps: ActionableRouteStep[];
  readonly strategy: RouteStrategy;
  readonly routeSummary?: RouteSummary;
  readonly onChangeRoute: () => void;
  readonly onDismiss?: () => void;
  readonly onFocusUser?: () => void;
}

export function DirectionStepsPanel({
  steps,
  strategy,
  routeSummary,
  onChangeRoute,
  onDismiss,
  onFocusUser,
}: DirectionStepsPanelProps) {
  const { colors } = useColorAccessibility();
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useBottomInset();

  const computedRouteSummary = React.useMemo(() => {
    const totalMeters = steps.reduce((total, step) => {
      if (!step.distance) return total;
      const parsed = parseDistanceMeters(step.distance);
      return parsed == null ? total : total + parsed;
    }, 0);

    const totalMinutes = steps.reduce((total, step) => {
      if (!step.duration) return total;
      const parsed = parseDurationMinutes(step.duration);
      return parsed == null ? total : total + parsed;
    }, 0);

    const distanceText = formatDistance(totalMeters);
    const durationText = formatDuration(totalMinutes);

    if (!distanceText && !durationText) return null;

    return [durationText, distanceText].filter(Boolean).join(" · ");
  }, [steps]);

  const summaryText = routeSummary
    ? [routeSummary.duration, routeSummary.distance].filter(Boolean).join(" · ")
    : computedRouteSummary;

  if (steps.length === 0) return null;

  return (
    <View
      style={[styles.panel, { bottom: spacing.lg + spacing.md + bottomInset }]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.modeBadge}>
              <MaterialCommunityIcons
                name={strategy.icon as any}
                size={18}
                color={colors.white}
              />
              <Text style={styles.modeLabel}>{strategy.label}</Text>
            </View>
            {summaryText && (
              <Text style={styles.routeSummary}>{summaryText}</Text>
            )}
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
      </View>
    </View>
  );
}
