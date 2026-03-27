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
jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");

  const Stack = ({ children }: { children?: React.ReactNode }) => (
    <View testID="mock-stack">{children}</View>
  );

  Stack.Screen = () => null;

  return {
    __esModule: true,
    Stack,
  };
});

// Mock react-native-smartlook-analytics
const mockSetProjectKey = jest.fn();
const mockStart = jest.fn();
const mockSmartlook = {
  instance: {
    preferences: {
      setProjectKey: mockSetProjectKey,
    },
    start: mockStart,
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
    jest.clearAllMocks();
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
    expect(mockStart).not.toHaveBeenCalled(); // Start is not called if setProjectKey fails
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Smartlook is not available in this build.",
      expect.any(Error),
    );
  });
});
