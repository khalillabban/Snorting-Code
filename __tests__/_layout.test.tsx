import { render } from "@testing-library/react-native";
import Constants from "expo-constants";
import React from "react";
import RootLayout from "../app/_layout";

// Mock expo-constants
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    executionEnvironment: "development",
  },
}));

// Mock expo-router to avoid requiring LinkPreview context in tests
let capturedStateListener: ((e: any) => void) | null = null;
jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  const Stack = ({ children, screenListeners }: any) => {
    capturedStateListener = screenListeners?.state ?? null;
    return <View testID="mock-stack">{children}</View>;
  };

  Stack.Screen = () => null;

  return {
    __esModule: true,
    Stack,
  };
});

// Mock react-native-smartlook-analytics
const mockSetProjectKey = jest.fn();
const mockStart = jest.fn();
const mockTrackNavigationEnter = jest.fn();
const mockTrackNavigationExit = jest.fn();
const mockSmartlook = {
  instance: {
    preferences: {
      setProjectKey: mockSetProjectKey,
    },
    start: mockStart,
    analytics: {
      trackNavigationEnter: mockTrackNavigationEnter,
      trackNavigationExit: mockTrackNavigationExit,
    },
  },
};
jest.mock("react-native-smartlook-analytics", () => ({
  __esModule: true,
  default: mockSmartlook,
}));

describe("RootLayout", () => {
  const originalEnv = process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;
  const consoleWarnSpy = jest
    .spyOn(console, "warn")
    .mockImplementation(() => {});

  beforeEach(() => {
    jest.resetAllMocks();
    capturedStateListener = null;
    process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY = "test-key";
    (Constants as any).executionEnvironment = "development";
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY = originalEnv;
    consoleWarnSpy.mockRestore();
  });

  it("initializes Smartlook when project key is present and not in storeClient environment", () => {
    render(<RootLayout />);
    expect(mockSetProjectKey).toHaveBeenCalledWith("test-key");
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("does not initialize Smartlook when project key is missing", () => {
    delete process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;
    render(<RootLayout />);
    expect(mockSetProjectKey).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("does not initialize Smartlook when execution environment is 'storeClient'", () => {
    (Constants as any).executionEnvironment = "storeClient";
    render(<RootLayout />);
    expect(mockSetProjectKey).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it("logs a warning if Smartlook initialization fails", () => {
    mockSetProjectKey.mockImplementation(() => {
      throw new Error("Smartlook init failed");
    });
    render(<RootLayout />);
    expect(mockSetProjectKey).toHaveBeenCalledWith("test-key");
    expect(mockStart).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Smartlook is not available in this build.",
      expect.any(Error),
    );
  });

  describe("handleStateChange navigation tracking", () => {
    const fireState = (state: any) => {
      capturedStateListener?.({ data: { state } });
    };

    it("tracks navigation enter on first route change", () => {
      render(<RootLayout />);
      fireState({ index: 0, routes: [{ name: "index" }] });
      expect(mockTrackNavigationEnter).toHaveBeenCalledWith("index");
      expect(mockTrackNavigationExit).not.toHaveBeenCalled();
    });

    it("tracks exit then enter when route changes", () => {
      render(<RootLayout />);
      fireState({ index: 0, routes: [{ name: "index" }] });
      fireState({ index: 1, routes: [{ name: "index" }, { name: "CampusMapScreen" }] });
      expect(mockTrackNavigationExit).toHaveBeenCalledWith("index");
      expect(mockTrackNavigationEnter).toHaveBeenCalledWith("CampusMapScreen");
    });

    it("does not track when route name is unchanged", () => {
      render(<RootLayout />);
      fireState({ index: 0, routes: [{ name: "index" }] });
      jest.clearAllMocks();
      fireState({ index: 0, routes: [{ name: "index" }] });
      expect(mockTrackNavigationEnter).not.toHaveBeenCalled();
      expect(mockTrackNavigationExit).not.toHaveBeenCalled();
    });

    it("does nothing when state is null", () => {
      render(<RootLayout />);
      fireState(null);
      expect(mockTrackNavigationEnter).not.toHaveBeenCalled();
    });

    it("does nothing when route is missing", () => {
      render(<RootLayout />);
      fireState({ index: 5, routes: [] });
      expect(mockTrackNavigationEnter).not.toHaveBeenCalled();
    });

    it("does nothing when Smartlook was not initialized", () => {
      delete process.env.EXPO_PUBLIC_SMARTLOOK_PROJECT_KEY;
      render(<RootLayout />);
      fireState({ index: 0, routes: [{ name: "index" }] });
      expect(mockTrackNavigationEnter).not.toHaveBeenCalled();
    });
  });
});
