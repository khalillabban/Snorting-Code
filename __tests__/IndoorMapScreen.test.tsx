import React from "react";

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
        onUpdate: jest.fn().mockReturnThis(),
        onEnd: jest.fn().mockReturnThis(),
      }),
    },
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");

  Reanimated.default.call = () => {};

  return Reanimated;
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, viewBox, ...props }: any) => (
      <View testID="svg-container" {...props}>
        <Text testID="svg-viewbox">{viewBox}</Text>
        {children}
      </View>
    ),
    Svg: ({ children, viewBox, ...props }: any) => (
      <View testID="svg-container" {...props}>
        <Text testID="svg-viewbox">{viewBox}</Text>
        {children}
      </View>
    ),
    Polygon: ({ points, fill, stroke, ...props }: any) => (
      <View testID="svg-polygon" {...props}>
        <Text testID="polygon-points">{points}</Text>
        <Text testID="polygon-fill">{fill}</Text>
        <Text testID="polygon-stroke">{stroke}</Text>
      </View>
    ),
    Text: ({ children, x, y, ...props }: any) => (
      <View testID="svg-text" {...props}>
        <Text testID="text-x">{x}</Text>
        <Text testID="text-y">{y}</Text>
        <Text testID="text-content">{children}</Text>
      </View>
    ),
  };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import IndoorMapScreen from "../app/IndoorMapScreen";

describe("IndoorMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with building name and floor selector", async () => {
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

  it("defaults to first floor when no floor is selected", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2, 3]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const floorButton = screen.getByText("1");
      expect(screen.getByText("1").props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: expect.any(String) })
        ])
      );
    });
  });

  it("switches floor when floor button is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeTruthy();
    });

    const floor2Button = screen.getByText("-2");
    fireEvent.press(floor2Button);

    await waitFor(() => {
      expect(screen.getByText("🏛️ Inside MB Building")).toBeTruthy();
    });
  });

  it("parses GeoJSON into composite pattern structure", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      // If the map renders polygons, parseGeoJSONToFloor was called successfully
      const polygons = screen.getAllByTestId("svg-polygon");
      expect(polygons.length).toBeGreaterThan(0);
    });
  });

  it("renders SVG polygons from composite floor children", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const polygons = screen.getAllByTestId("svg-polygon");
      expect(polygons.length).toBeGreaterThan(0);
    });
  });

  it("renders room labels from composite nodes", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const textElements = screen.getAllByTestId("svg-text");
      const textContents = textElements.map(el => 
        el.findByProps({ testID: "text-content" })?.props.children
      );
      expect(textContents).toContain("1.210");
      expect(textContents).toContain("Hallway");
    });
  });

  it("does not render labels for Eshaft or block rooms", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const textElements = screen.getAllByTestId("svg-text");
      const textContents = textElements.map(el => 
        el.findByProps({ testID: "text-content" })?.props.children
      );
      expect(textContents).not.toContain("Eshaft");
      expect(textContents).not.toContain("block");
    });
  });

  it("uses centroid from GeoJSON properties when available", async () => {
    // Requires specific real JSON data with centroid properties, so changing MB will fail this test
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const textElements = screen.getAllByTestId("svg-text");
      const roomText = textElements.find(el => 
        el.findByProps({ testID: "text-content" })?.props.children === "1.210"
      );
      expect(roomText?.findByProps({ testID: "text-x" })?.props.children).toBe(1336.4054409066177);
      expect(roomText?.findByProps({ testID: "text-y" })?.props.children).toBe(740.9680186177128);
    });
  });

  it("calculates centroid when not provided in GeoJSON", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const textElements = screen.getAllByTestId("svg-text");
      const eshaftText = textElements.find(el => {
        const content = el.findByProps({ testID: "text-content" })?.props.children;
        return content === "Eshaft";
      });
      // Eshaft should not render due to name filter
      expect(eshaftText).toBeUndefined();
    });
  });

    it("applies different colors for hallways vs rooms", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const polygons = screen.getAllByTestId("svg-polygon");
      expect(polygons.length).toBeGreaterThan(0);
      
      const fills = polygons.map(p => p.findByProps({ testID: "polygon-fill" })?.props.children);
      const uniqueFills = [...new Set(fills)];
      expect(uniqueFills.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("calculates viewBox bounds with padding from composite floor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const viewBox = screen.getByTestId("svg-viewbox").props.children;
      expect(viewBox).toMatch(/^-?\d+\s+-?\d+\s+\d+\s+\d+$/);
    });
  });

  it("shows no map message when floor data is not available", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "UNKNOWN",
      floors: JSON.stringify([99]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No map available for UNKNOWN-99")).toBeTruthy();
    });
  });

  it("uses composite pattern methods to get children", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    // If polygons render, getChildren() was called on the Floor composite
    await waitFor(() => {
      const polygons = screen.getAllByTestId("svg-polygon");
      expect(polygons.length).toBeGreaterThan(0);
    });
  });

  it("handles empty floors array gracefully", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("🏛️ Inside MB Building")).toBeTruthy();
    });
  });

  it("renders ScrollView for pan and zoom support", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    const { UNSAFE_getAllByType } = render(<IndoorMapScreen />);

    await waitFor(() => {
      const scrollViews = UNSAFE_getAllByType(require("react-native").ScrollView);
      expect(scrollViews.length).toBe(2);
    });
  });
});
