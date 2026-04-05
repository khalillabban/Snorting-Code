type PaletteSeed = {
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
};

export type ColorAccessibilityMode =
  | "classic"
  | "redGreenSafe"
  | "blueYellowSafe"
  | "highContrast";

export const COLOR_ACCESSIBILITY_OPTIONS: Array<{
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

export function hexToRgb(hex: string) {
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

export function withOpacity(hex: string, opacity: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function buildPalette(seed: PaletteSeed) {
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
  routeShuttle: "#5b5bd6",
});

export type ThemePalette = typeof CLASSIC_PALETTE;

export function getThemePalette(mode: ColorAccessibilityMode): ThemePalette {
  switch (mode) {
    case "redGreenSafe":
      return RED_GREEN_SAFE_PALETTE;
    case "blueYellowSafe":
      return BLUE_YELLOW_SAFE_PALETTE;
    case "highContrast":
      return HIGH_CONTRAST_PALETTE;
    default:
      return CLASSIC_PALETTE;
  }
}

// Color palette
export const colors = {
  // Brand colors (Concordia)
  primary: "#912338", // Dark Red
  primaryTransparent: "rgba(145, 35, 56, 0.5)", // Dark Red with 50% opacity
  primarySemiTransparent: "rgba(145, 35, 56, 0.75)", // Dark Red with 75% opacity
  primaryBarelyTransparent: "rgba(145, 35, 56, 0.90)", // Dark Red with 90% opacity
  primaryDark: "#6d1a2a", // Dark Red
  primaryDarker: "#4b0f1a", // Darker Red
  primaryLight: "#b84d5f", // Light Red
  secondary: "#C4A747", // Gold
  secondaryTransparent: "rgba(196, 167, 71, 0.5)", // Gold with 50% opacity
  secondarySemiTransparent: "rgba(196, 167, 71, 0.75)", // Gold with 75% opacity
  secondaryDark: "#8b6e34", // Dark Gold
  secondaryLight: "#d9b85c", // Light Gold

  // Neutrals
  white: "#ffffff",
  offWhite: "#f2f2f2", // Light Gray
  gray100: "#e5e5e5", // Light Gray
  gray200: "#d4d4d4", // Lighter Medium Gray
  gray300: "#b3b3b3", // Medium Gray
  gray400: "#9a9a9a", // Medium Dark Gray
  gray500: "#737373", // Dark Gray
  gray700: "#404040", // Darkest Gray
  black: "#1a1a1a", // Black

  // Semantic
  success: "#2e7d32", // Green
  warning: "#f9a825", // Yellow
  error: "#c62828", // Red
  info: "#1565c0", // Blue

  // Map-specific (useful for navigation features later)
  mapOverlay: "rgba(145, 35, 56, 0.15)",
  routePath: "#1565c0",
  /** Route line color by travel mode */
  routeWalk: "#6a1b9a", // primary (walking)
  routeDrive: "#1565c0", // info/blue (car)
  routeTransit: "#2e7d32", // success/green (transit)
  routeBike: "#C4A747", // secondary/gold (bike)
  routeShuttle: "#6a1b9a", // purple for shuttle
} as const;

// Typography
export const typography = {
  title: {
    fontSize: 36,
    fontWeight: "700" as const,
  },
  heading: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  body: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
} as const;

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Border radii
export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const;
