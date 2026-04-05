import { getIconSizeStyle } from "../styles/AccessibilityIcons.styles";
import { createStyles as createNextClassStyles } from "../styles/NextClassDirectionsPanel.styles";
import { createStyles as createShuttleScheduleStyles } from "../styles/ShuttleSchedulePanel.styles";

describe("styles coverage helpers", () => {
  it("returns icon width/height from getIconSizeStyle", () => {
    expect(getIconSizeStyle(18)).toEqual({ width: 18, height: 18 });
  });

  it("supports fallback border color when primaryBarelyTransparent is missing", () => {
    const styles = createShuttleScheduleStyles({
      white: "#fff",
      black: "#000",
      primary: "#111",
      primaryDark: "#222",
      primaryDarker: "#333",
      primaryLight: "#444",
      primaryTransparent: "rgba(1,1,1,0.4)",
      primarySemiTransparent: "rgba(1,1,1,0.7)",
      secondary: "#555",
      secondaryTransparent: "rgba(5,5,5,0.4)",
      secondarySemiTransparent: "rgba(5,5,5,0.7)",
      secondaryDark: "#666",
      secondaryLight: "#777",
      offWhite: "#f4f4f4",
      gray100: "#e5e5e5",
      gray300: "#b3b3b3",
      gray500: "#737373",
      gray700: "#404040",
      success: "#0a0",
      warning: "#aa0",
      error: "#a00",
      info: "#08c",
      mapOverlay: "rgba(0,0,0,0.1)",
      routePath: "#08c",
      routeWalk: "#111",
      routeDrive: "#222",
      routeTransit: "#333",
      routeBike: "#444",
      routeShuttle: "#555",
    } as any);

    expect(styles.nextCard.borderColor).toBe("#e5e5e5");
  });

  it("creates next-class sheet styles with expected full-screen container", () => {
    const styles = createNextClassStyles();
    expect(styles.keyboardContainer.height).toBe("100%");
    expect(styles.overlay.backgroundColor).toBe("rgba(0,0,0,0.3)");
  });

  it("uses Android error-banner top offset in CampusMap styles", () => {
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock("react-native", () => {
        const actual = jest.requireActual("react-native");
        return {
          Platform: { OS: "android", select: actual.Platform.select },
          StyleSheet: actual.StyleSheet,
        };
      });

      const { styles } = require("../styles/CampusMap.styles");
      expect(styles.errorBanner.top).toBe(40);
    });
    jest.dontMock("react-native");
  });

  it("computes FULL_HEIGHT differently for iOS and Android", () => {
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock("react-native", () => {
        const actual = jest.requireActual("react-native");
        return {
          Platform: { OS: "ios", select: actual.Platform.select },
          StyleSheet: actual.StyleSheet,
          Dimensions: {
            get: jest.fn(() => ({ width: 400, height: 1000 })),
          },
        };
      });

      const { FULL_HEIGHT } = require("../styles/NextClassDirectionsPanel.styles");
      expect(FULL_HEIGHT).toBe(900);
    });

    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock("react-native", () => {
        const actual = jest.requireActual("react-native");
        return {
          Platform: { OS: "android", select: actual.Platform.select },
          StyleSheet: actual.StyleSheet,
          Dimensions: {
            get: jest.fn(() => ({ width: 400, height: 1000 })),
          },
        };
      });

      const { FULL_HEIGHT } = require("../styles/NextClassDirectionsPanel.styles");
      expect(FULL_HEIGHT).toBe(950);
    });

    jest.dontMock("react-native");
  });
});
