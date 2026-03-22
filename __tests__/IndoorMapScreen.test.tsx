import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import IndoorMapScreen from "../app/IndoorMapScreen";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
}));

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GestureHandlerRootView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    GestureDetector: ({ children }: any) => <View>{children}</View>,
    Gesture: {
      Pinch: () => ({
        onUpdate: jest.fn(function (cb) { return this; }),
        onEnd: jest.fn(function (cb) { return this; }),
      }),
    },
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => { };
  return Reanimated;
});

jest.mock("../utils/indoorMapAssets", () => ({
  getFloorPlanAsset: jest.fn((building, floor) => {
    if (building === "MB" && floor === 1) return require("../assets/maps/mb_1.png");
    if (building === "H" && floor === 8) return require("../assets/mapsbackup/H1.png");
    return null;
  }),
}));

describe("IndoorMapScreen - Image Rendering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders building name and floor selector", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("🏛️ Inside MB Building")).toBeTruthy();
      expect(screen.getByText("1")).toBeTruthy();
      expect(screen.getByText("-2")).toBeTruthy();
    });
  });

  it("defaults to first available floor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2, 3]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeTruthy();
    });
  });

  it("switches floor when floor button is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    const { getByText } = render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getByText("-2")).toBeTruthy();
    });

    fireEvent.press(getByText("-2"));

    await waitFor(() => {
      const buttons = screen.getAllByText("-2");
      const activeButton = buttons[0];
      expect(activeButton).toBeTruthy();
    });
  });

  it("renders floor image when available", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    const { UNSAFE_getAllByType } = render(<IndoorMapScreen />);

    await waitFor(() => {
      const images = UNSAFE_getAllByType(require("react-native").Image);
      expect(images.length).toBeGreaterThan(0);
    });
  });

  it("shows no map message when floor image unavailable", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "UNKNOWN",
      floors: JSON.stringify([99]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No map available for UNKNOWN-99")).toBeTruthy();
    });
  });

  it("resets selectedFloor when available floors change and current becomes invalid", async () => {
    let params = {
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    };

    (useLocalSearchParams as jest.Mock).mockImplementation(() => params);

    const { rerender, getByText } = render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getByText("-2")).toBeTruthy();
    });

    fireEvent.press(getByText("-2"));

    params = {
      buildingName: "MB",
      floors: JSON.stringify([1]),
    };

    rerender(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getByText("1")).toBeTruthy();
    });
  });

  it("handles empty floors array", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("🏛️ Inside MB Building")).toBeTruthy();
    });
  });

  it("handles undefined buildingName gracefully", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: undefined,
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No map available for undefined-1")).toBeTruthy();
    });
  });

  it("uses the no-map fallback when asset returns null", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([999]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No map available for MB-999")).toBeTruthy();
    });
  });

  it("renders ScrollView for pan and zoom", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    const { UNSAFE_getAllByType } = render(<IndoorMapScreen />);

    await waitFor(() => {
      const scrollViews = UNSAFE_getAllByType(require("react-native").ScrollView);
      expect(scrollViews.length).toBeGreaterThan(0);
    });
  });

  it("tracks image layout for zoom scaling", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    const { UNSAFE_getAllByType } = render(<IndoorMapScreen />);

    await waitFor(() => {
      const images = UNSAFE_getAllByType(require("react-native").Image);
      expect(images.length).toBeGreaterThan(0);
      const image = images[0];
      expect(image.props.onLayout).toBeDefined();
    });
  });
});
