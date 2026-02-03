// Color palette
export const colors = {
  // Brand colors (Concordia)
  primary: "#912338",
  primaryTransparent: "rgba(145, 35, 56, 0.5)",
  primaryDark: "#6d1a2a",
  primaryLight: "#b84d5f",

  // Neutrals
  white: "#ffffff",
  offWhite: "#f2f2f2",
  gray100: "#e5e5e5",
  gray300: "#b3b3b3",
  gray500: "#737373",
  gray700: "#404040",
  black: "#1a1a1a",

  // Semantic
  success: "#2e7d32",
  warning: "#f9a825",
  error: "#c62828",
  info: "#1565c0",

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
