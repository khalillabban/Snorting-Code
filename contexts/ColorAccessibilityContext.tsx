import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type ColorAccessibilityMode,
  type ThemePalette,
} from "../constants/theme";

const STORAGE_KEY = "snorting-code.color-accessibility-mode";

const COLOR_ACCESSIBILITY_OPTIONS: Array<{
  value: ColorAccessibilityMode;
  label: string;
  description: string;
}> = [
  {
    value: "classic",
    label: "Classic Concordia",
    description: "Original campus red and gold branding.",
  },
  {
    value: "redGreenSafe",
    label: "Red-Green Safe",
    description:
      "Uses blue, teal, and amber to reduce confusion for red-green deficiencies.",
  },
  {
    value: "blueYellowSafe",
    label: "Blue-Yellow Safe",
    description:
      "Uses magenta and olive tones to improve tritanopia readability.",
  },
  {
    value: "highContrast",
    label: "High Contrast",
    description: "Stronger contrast with a simpler, bolder palette.",
  },
];

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((part) => part + part)
          .join("")
      : normalized;
  const value = Number.parseInt(expanded, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function withOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function buildPalette(seed: {
  primary: string;
  primaryDark: string;
  primaryDarker: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  routeWalk: string;
  routeDrive: string;
  routeTransit: string;
  routeBike: string;
  routeShuttle: string;
}) {
  return {
    primary: seed.primary,
    primaryTransparent: withOpacity(seed.primary, 0.5),
    primarySemiTransparent: withOpacity(seed.primary, 0.75),
    primaryBarelyTransparent: withOpacity(seed.primary, 0.9),
    primaryDark: seed.primaryDark,
    primaryDarker: seed.primaryDarker,
    primaryLight: seed.primaryLight,
    secondary: seed.secondary,
    secondaryTransparent: withOpacity(seed.secondary, 0.5),
    secondarySemiTransparent: withOpacity(seed.secondary, 0.75),
    secondaryDark: seed.secondaryDark,
    secondaryLight: seed.secondaryLight,

    white: "#ffffff",
    offWhite: "#f2f2f2",
    gray100: "#e5e5e5",
    gray300: "#b3b3b3",
    gray500: "#737373",
    gray700: "#404040",
    black: "#1a1a1a",

    success: seed.success,
    warning: seed.warning,
    error: seed.error,
    info: seed.info,

    mapOverlay: withOpacity(seed.primary, 0.15),
    routePath: seed.info,
    routeWalk: seed.routeWalk,
    routeDrive: seed.routeDrive,
    routeTransit: seed.routeTransit,
    routeBike: seed.routeBike,
    routeShuttle: seed.routeShuttle,
  } as const;
}

const CLASSIC_PALETTE = buildPalette({
  primary: "#912338",
  primaryDark: "#6d1a2a",
  primaryDarker: "#4b0f1a",
  primaryLight: "#b84d5f",
  secondary: "#C4A747",
  secondaryDark: "#8b6e34",
  secondaryLight: "#d9b85c",
  success: "#2e7d32",
  warning: "#f9a825",
  error: "#c62828",
  info: "#1565c0",
  routeWalk: "#6a1b9a",
  routeDrive: "#1565c0",
  routeTransit: "#2e7d32",
  routeBike: "#C4A747",
  routeShuttle: "#6a1b9a",
});

const RED_GREEN_SAFE_PALETTE = buildPalette({
  primary: "#1557B0",
  primaryDark: "#0f3d7a",
  primaryDarker: "#0a2850",
  primaryLight: "#4a84cc",
  secondary: "#C47A18",
  secondaryDark: "#8a520e",
  secondaryLight: "#e0a34a",
  success: "#00796b",
  warning: "#cb8b00",
  error: "#c62828",
  info: "#0b6bd3",
  routeWalk: "#7b1fa2",
  routeDrive: "#cb8b00",
  routeTransit: "#00796b",
  routeBike: "#6a4c93",
  routeShuttle: "#8e24aa",
});

const BLUE_YELLOW_SAFE_PALETTE = buildPalette({
  primary: "#8E2B5C",
  primaryDark: "#641f42",
  primaryDarker: "#42132b",
  primaryLight: "#ba5c86",
  secondary: "#6C8A1E",
  secondaryDark: "#4f6715",
  secondaryLight: "#9eb74b",
  success: "#2e7d32",
  warning: "#a86c00",
  error: "#c62828",
  info: "#0e7490",
  routeWalk: "#8e24aa",
  routeDrive: "#6C8A1E",
  routeTransit: "#0e7490",
  routeBike: "#c26d20",
  routeShuttle: "#5b5bd6",
});

const HIGH_CONTRAST_PALETTE = buildPalette({
  primary: "#111111",
  primaryDark: "#000000",
  primaryDarker: "#000000",
  primaryLight: "#3a3a3a",
  secondary: "#ffbf00",
  secondaryDark: "#8a5f00",
  secondaryLight: "#ffd84d",
  success: "#00695c",
  warning: "#ff9800",
  error: "#b00020",
  info: "#0057d9",
  routeWalk: "#6a1b9a",
  routeDrive: "#0057d9",
  routeTransit: "#00695c",
  routeBike: "#ff9800",
  routeShuttle: "#7b1fa2",
});

type ColorAccessibilityContextValue = {
  mode: ColorAccessibilityMode;
  colors: ThemePalette;
  options: typeof COLOR_ACCESSIBILITY_OPTIONS;
  setMode: (mode: ColorAccessibilityMode) => void;
  isHydrated: boolean;
};

const defaultValue: ColorAccessibilityContextValue = {
  mode: "classic",
  colors: CLASSIC_PALETTE,
  options: COLOR_ACCESSIBILITY_OPTIONS,
  setMode: () => {},
  isHydrated: true,
};

const ColorAccessibilityContext =
  createContext<ColorAccessibilityContextValue>(defaultValue);

export function ColorAccessibilityProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isTestEnvironment = process.env.NODE_ENV === "test";
  const [mode, setMode] = useState<ColorAccessibilityMode>("classic");
  const [isHydrated, setIsHydrated] = useState(isTestEnvironment);

  useEffect(() => {
    if (isTestEnvironment) {
      return;
    }

    let cancelled = false;

    const loadMode = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (
          saved &&
          COLOR_ACCESSIBILITY_OPTIONS.some((option) => option.value === saved)
        ) {
          setMode(saved as ColorAccessibilityMode);
        }
      } catch (error) {
        console.warn("Failed to load color accessibility mode.", error);
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    };

    void loadMode();

    return () => {
      cancelled = true;
    };
  }, [isTestEnvironment]);

  useEffect(() => {
    if (!isHydrated || isTestEnvironment) return;
    Promise.resolve(AsyncStorage.setItem(STORAGE_KEY, mode)).catch((error) => {
      console.warn("Failed to save color accessibility mode.", error);
    });
  }, [isHydrated, isTestEnvironment, mode]);

  const value = useMemo<ColorAccessibilityContextValue>(
    () => ({
      mode,
      colors:
        mode === "redGreenSafe"
          ? RED_GREEN_SAFE_PALETTE
          : mode === "blueYellowSafe"
            ? BLUE_YELLOW_SAFE_PALETTE
            : mode === "highContrast"
              ? HIGH_CONTRAST_PALETTE
              : CLASSIC_PALETTE,
      options: COLOR_ACCESSIBILITY_OPTIONS,
      setMode,
      isHydrated,
    }),
    [isHydrated, mode],
  );

  return (
    <ColorAccessibilityContext.Provider value={value}>
      {children}
    </ColorAccessibilityContext.Provider>
  );
}

export function useColorAccessibility() {
  return useContext(ColorAccessibilityContext);
}
