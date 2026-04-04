import {
    borderRadius,
    COLOR_ACCESSIBILITY_OPTIONS,
    colors,
    getThemePalette,
    spacing,
    typography,
} from "../constants/theme";

describe("Theme constants", () => {
  describe("colors", () => {
    it("exports primary brand colors", () => {
      expect(colors.primary).toBe("#912338");
      expect(colors.secondary).toBe("#C4A747");
    });

    it("exports gray scale colors including gray200 and gray400", () => {
      expect(colors.gray100).toBe("#e5e5e5");
      expect(colors.gray200).toBe("#d4d4d4");
      expect(colors.gray300).toBe("#b3b3b3");
      expect(colors.gray400).toBe("#9a9a9a");
      expect(colors.gray500).toBe("#737373");
      expect(colors.gray700).toBe("#404040");
    });

    it("exports semantic colors", () => {
      expect(colors.success).toBe("#2e7d32");
      expect(colors.warning).toBe("#f9a825");
      expect(colors.error).toBe("#c62828");
      expect(colors.info).toBe("#1565c0");
    });

    it("exports route colors by travel mode", () => {
      expect(colors.routeWalk).toBe("#912338");
      expect(colors.routeDrive).toBe("#1565c0");
      expect(colors.routeTransit).toBe("#2e7d32");
      expect(colors.routeBike).toBe("#C4A747");
      expect(colors.routeShuttle).toBe("#6a1b9a");
    });
  });

  describe("color accessibility palette helpers", () => {
    it("exports all color accessibility options", () => {
      const values = COLOR_ACCESSIBILITY_OPTIONS.map((o) => o.value);
      expect(values).toEqual([
        "classic",
        "redGreenSafe",
        "blueYellowSafe",
        "highContrast",
      ]);
    });

    it("returns correct palette per mode and falls back to classic", () => {
      const classic = getThemePalette("classic");
      const redGreenSafe = getThemePalette("redGreenSafe");
      const blueYellowSafe = getThemePalette("blueYellowSafe");
      const highContrast = getThemePalette("highContrast");

      expect(classic.primary).toBe("#912338");
      expect(redGreenSafe.primary).toBe("#1557B0");
      expect(blueYellowSafe.primary).toBe("#8E2B5C");
      expect(highContrast.primary).toBe("#111111");

      const fallback = getThemePalette("unknown" as any);
      expect(fallback.primary).toBe(classic.primary);
    });
  });

  describe("spacing", () => {
    it("exports spacing scale", () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing.xxl).toBe(48);
    });
  });

  describe("typography", () => {
    it("exports typography definitions", () => {
      expect(typography.title.fontSize).toBe(36);
      expect(typography.heading.fontSize).toBe(24);
      expect(typography.body.fontSize).toBe(14);
    });
  });

  describe("borderRadius", () => {
    it("exports border radius values", () => {
      expect(borderRadius.sm).toBe(6);
      expect(borderRadius.md).toBe(10);
      expect(borderRadius.lg).toBe(16);
      expect(borderRadius.full).toBe(9999);
    });
  });
});
