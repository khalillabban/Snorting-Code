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
  const match = /^([\d.]+)\s*(km|m|mi|ft)$/.exec(value.trim().toLowerCase());
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

  const hourMatch =
    /(\d{1,10}(?:\.\d{1,10})?)\s{0,10}(?:hours|hour|hrs|hr|h)\b/.exec(
      normalized,
    );
  const minuteMatch =
    /(\d{1,10}(?:\.\d{1,10})?)\s{0,10}(?:minutes|minute|mins|min|m)\b/.exec(
      normalized,
    );
  const secondMatch =
    /(\d{1,10}(?:\.\d{1,10})?)\s{0,10}(?:seconds|second|secs|sec|s)\b/.exec(
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

type StepIconName = "door-open" | "bus" | "subway" | "train" | "walk";

const SUBWAY_TYPES = new Set(["subway", "metro_rail"]);
const TRAIN_TYPES = new Set(["rail", "commuter_train"]);

function resolveStepIcon(
  isShuttle: boolean,
  isTransit: boolean,
  isCta: boolean,
  vehicleType?: string,
): StepIconName {
  if (isCta) return "door-open";
  if (!isShuttle && !isTransit) return "walk";
  const vt = vehicleType?.toLowerCase();
  if (vt && SUBWAY_TYPES.has(vt)) return "subway";
  if (vt && TRAIN_TYPES.has(vt)) return "train";
  return "bus";
}

function buildTransitMetaText(
  details: NonNullable<RouteStep["transitDetails"]>,
): string {
  return [
    details.lineName && `Line ${details.lineName}`,
    details.departureTime && `Departs ${details.departureTime}`,
    details.arrivalTime && `Arrives ${details.arrivalTime}`,
    details.numStops != null && `${details.numStops} stops`,
  ]
    .filter(Boolean)
    .join(" · ");
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
  const [isExpanded, setIsExpanded] = React.useState(false);

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

    return [durationText, distanceText].filter(Boolean).join(" \u00B7 ");
  }, [steps]);

  const summaryText = routeSummary
    ? [routeSummary.duration, routeSummary.distance]
        .filter(Boolean)
        .join(" \u00B7 ")
    : computedRouteSummary;

  const stepSignature = steps
    .map(
      (step) =>
        `${step.instruction}|${step.distance ?? ""}|${step.duration ?? ""}|${Boolean(step.onPress)}`,
    )
    .join("||");

  React.useEffect(() => {
    setIsExpanded(false);
  }, [stepSignature, strategy.mode]);

  if (steps.length === 0) return null;

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
            {summaryText && (
              <Text style={styles.routeSummary}>{summaryText}</Text>
            )}
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
                <MaterialIcons
                  name="my-location"
                  size={18}
                  color={colors.primary}
                />
              </Pressable>
            )}
            <Pressable
              onPress={() => setIsExpanded((value) => !value)}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded
                  ? "Collapse directions steps"
                  : "Expand directions steps"
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
              const isTransit = Boolean(step.transitDetails);
              const stepKey = `${step.instruction}-${step.distance ?? ""}-${step.duration ?? ""}-${index}`;
              const isContinueIndoorsCta =
                Boolean(step.onPress) && index === steps.length - 1;
              const metadataText = [step.distance, step.duration]
                .filter(Boolean)
                .join(" \u00B7 ");
              const iconName = resolveStepIcon(
                isShuttle,
                isTransit,
                isContinueIndoorsCta,
                step.transitDetails?.vehicleType,
              );

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
                    {index < steps.length - 1 && (
                      <View style={styles.stepLine} />
                    )}
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

                    {isTransit && step.transitDetails && (
                      <Text style={styles.stepMeta}>
                        {buildTransitMetaText(step.transitDetails)}
                      </Text>
                    )}

                    {metadataText ? (
                      <Text style={styles.stepMeta}>{metadataText}</Text>
                    ) : null}
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
            <Text style={styles.collapsedPreviewTitle}>
              {stepCountLabel} available
            </Text>
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
