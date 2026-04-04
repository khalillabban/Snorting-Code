import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { ALL_STRATEGIES } from "../constants/strategies";
import { colors } from "../constants/theme";
import { RouteStrategy } from "../services/Routing";

interface StrategyButtonStyles {
  modeButton: ViewStyle;
  activeModeButton: ViewStyle;
  disabledModeButton: ViewStyle;
  modeText?: object;
  modeSummary?: object;
}

type RouteSummaries = Partial<Record<RouteStrategy["mode"], string | null>>;

interface StrategyModeSelectorProps {
  selectedStrategy: RouteStrategy;
  onSelect: (strategy: RouteStrategy) => void;
  shuttleAvailable?: boolean;
  testIDPrefix?: string;
  buttonStyles: StrategyButtonStyles;
  containerStyle?: StyleProp<ViewStyle>;
  routeSummaries?: RouteSummaries;
  summariesLoading?: boolean;
}

export function StrategyModeSelector({
  selectedStrategy,
  onSelect,
  shuttleAvailable = true,
  testIDPrefix = "mode-button",
  buttonStyles,
  containerStyle,
  routeSummaries,
  summariesLoading = false,
}: Readonly<StrategyModeSelectorProps>) {
  return (
    <View style={containerStyle}>
      {ALL_STRATEGIES.map((strategy) => {
        const isActive = selectedStrategy.mode === strategy.mode;
        const isShuttle = strategy.mode === "shuttle";
        const isDisabled = isShuttle && !shuttleAvailable;
        const textColor = (() => {
          if (isDisabled) return colors.gray400;
          if (isActive) return colors.white;
          return colors.primary;
        })();
        return (
          <Pressable
            key={strategy.mode}
            testID={`${testIDPrefix}-${strategy.mode}`}
            onPress={() => {
              if (!isDisabled) onSelect(strategy);
            }}
            disabled={isDisabled}
            style={[
              buttonStyles.modeButton,
              isActive && buttonStyles.activeModeButton,
              isDisabled && buttonStyles.disabledModeButton,
            ]}
            accessibilityState={{ disabled: isDisabled }}
            accessibilityHint={
              isDisabled ? "Shuttle is currently unavailable" : undefined
            }
          >
            <MaterialCommunityIcons
              name={strategy.icon as any}
              size={22}
              color={textColor}
            />
            <Text style={[buttonStyles.modeText, { color: textColor }]}>
              {strategy.label}
            </Text>
            <Text
              style={[
                buttonStyles.modeSummary,
                { color: textColor, opacity: isDisabled ? 0.7 : 0.9 },
              ]}
            >
              {summariesLoading
                ? "Loading…"
                : (routeSummaries?.[strategy.mode] ?? "—")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
