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
  gray300: "#b3b3b3", // Medium Gray
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
