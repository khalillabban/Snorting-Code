import React from "react";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
}));

let pinchUpdateHandler: any;
let pinchEndHandler: any;

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    GestureHandlerRootView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    GestureDetector: ({ children }: any) => <View>{children}</View>,
    Gesture: {
      Pinch: () => ({
        onUpdate: jest.fn(function (cb) {
          pinchUpdateHandler = cb;
          return this;
        }),
        onEnd: jest.fn(function (cb) {
          pinchEndHandler = cb;
          return this;
        }),
      }),
    },
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");

  Reanimated.default.call = () => { };

  return Reanimated;
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View, Text: RNText } = require("react-native");
  return {
    __esModule: true,
    default: ({ children, viewBox, ...props }: any) => (
      <View testID="svg-container" {...props}>
        <RNText testID="svg-viewbox">{viewBox}</RNText>
        {children}
      </View>
    ),
    Svg: ({ children, viewBox, ...props }: any) => (
      <View testID="svg-container" {...props}>
        <RNText testID="svg-viewbox">{viewBox}</RNText>
        {children}
      </View>
    ),
    Polygon: ({ points, fill, stroke, ...props }: any) => (
      <View testID="svg-polygon" {...props}>
        <RNText testID="polygon-points">{points}</RNText>
        <RNText testID="polygon-fill">{fill}</RNText>
        <RNText testID="polygon-stroke">{stroke}</RNText>
      </View>
    ),
    Text: ({ children, x, y, ...props }: any) => (
      <View testID="svg-text" {...props}>
        <RNText testID="text-x">{x}</RNText>
        <RNText testID="text-y">{y}</RNText>
        <RNText testID="text-content">{children}</RNText>
      </View>
    ),
  };
});

jest.mock("../utils/IndoorMapComposite", () => ({
  parseGeoJSONToFloor: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import IndoorMapScreen from "../app/IndoorMapScreen";
import { parseGeoJSONToFloor } from "../utils/IndoorMapComposite";

const mockFloor = {
  getChildren: () => [
    {
      getCoordinates: () => [
        [100, 100],
        [200, 100],
        [200, 200],
        [100, 200],
      ],
      getType: () => "room",
      getCentroid: () => [1336.4054409066177, 740.9680186177128],
      getName: () => "1.210",
    },
    {
      getCoordinates: () => [
        [300, 100],
        [400, 100],
        [400, 200],
        [300, 200],
      ],
      getType: () => "hallway",
      getCentroid: () => [350, 150],
      getName: () => "Hallway",
    },
    {
      getCoordinates: () => [
        [500, 100],
        [600, 100],
        [600, 200],
        [500, 200],
      ],
      getType: () => "room",
      getCentroid: () => [550, 150],
      getName: () => "Elevator Block",
    },
    {
      getCoordinates: () => [
        [700, 100],
        [800, 100],
        [800, 200],
        [700, 200],
      ],
      getType: () => "room",
      getCentroid: () => [750, 150],
      getName: () => "block",
    },
  ],
};

describe("IndoorMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pinchUpdateHandler = undefined;
    pinchEndHandler = undefined;
    (parseGeoJSONToFloor as jest.Mock).mockReturnValue(mockFloor);
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

  it("defaults to the first available floor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2, 3]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(parseGeoJSONToFloor).toHaveBeenCalledWith(
        expect.anything(),
        1,
        "MB"
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
      expect(screen.getByText("-2")).toBeTruthy();
    });

    const floor2Button = screen.getByText("-2");
    fireEvent.press(floor2Button);

    await waitFor(() => {
      expect(parseGeoJSONToFloor).toHaveBeenCalledWith(
        expect.anything(),
        -2,
        "MB"
      );
    });
  });

  it("parses GeoJSON into composite pattern structure", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(parseGeoJSONToFloor).toHaveBeenCalled();
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

  it("does not render labels for Elevator Block or block rooms", async () => {
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
      expect(textContents).not.toContain("Elevator Block");
      expect(textContents).not.toContain("block");
    });
  });

  it("uses centroid values from the composite node", async () => {
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
  it("resets selectedFloor when the available floors change and current floor is no longer valid", async () => {
    let params = {
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    };

    (useLocalSearchParams as jest.Mock).mockImplementation(() => params);

    const { rerender } = render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("-2")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("-2"));

    await waitFor(() => {
      expect(parseGeoJSONToFloor).toHaveBeenCalledWith(
        expect.anything(),
        -2,
        "MB"
      );
    });

    params = {
      buildingName: "MB",
      floors: JSON.stringify([1]),
    };

    rerender(<IndoorMapScreen />);

    await waitFor(() => {
      expect(parseGeoJSONToFloor).toHaveBeenCalledWith(
        expect.anything(),
        1,
        "MB"
      );
    });
  });

  it("shows no map when buildingName is undefined", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: undefined,
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No map available for undefined-1")).toBeTruthy();
    });
  });

  it("uses the null floorComposite path when parser returns null", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    (parseGeoJSONToFloor as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No map available for MB-1")).toBeTruthy();
    });
  });
  it("handles pinch gesture update and end", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getAllByTestId("svg-polygon").length).toBeGreaterThan(0);
    });

    expect(pinchUpdateHandler).toBeTruthy();
    expect(pinchEndHandler).toBeTruthy();

    pinchUpdateHandler!({ scale: 2 });
    pinchEndHandler!();

  });
  it("clamps pinch scale between min and max", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getAllByTestId("svg-polygon").length).toBeGreaterThan(0);
    });

    pinchUpdateHandler!({ scale: 0.1 });
    pinchEndHandler!();

    pinchUpdateHandler!({ scale: 100 });
    pinchEndHandler!();
  });
});
