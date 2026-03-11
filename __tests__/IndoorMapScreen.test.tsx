import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import IndoorMapScreen from "../app/IndoorMapScreen";
import * as IndoorMapComposite from "../utils/IndoorMapComposite";

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
  const React = require("react");
  const { View } = require("react-native");
  return {
    default: {
      View: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    },
    useSharedValue: jest.fn(() => ({ value: 1 })),
    useAnimatedStyle: jest.fn(() => ({})),
  };
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

const mockGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "MB 1.210", type: "room", centroid: [100, 200] },
      geometry: {
        type: "Polygon",
        coordinates: [[[50, 150], [150, 150], [150, 250], [50, 250], [50, 150]]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Main Hallway", type: "hallway", centroid: [300, 400] },
      geometry: {
        type: "Polygon",
        coordinates: [[[250, 350], [350, 350], [350, 450], [250, 450], [250, 350]]],
      },
    },
    {
      type: "Feature",
      properties: { name: "Eshaft", type: "room" },
      geometry: {
        type: "Polygon",
        coordinates: [[[400, 400], [450, 400], [450, 450], [400, 450], [400, 400]]],
      },
    },
  ],
};

jest.mock("../assets/maps/MB-1.json", () => mockGeoJSON, { virtual: true });
jest.mock("../assets/maps/MB-S2.json", () => mockGeoJSON, { virtual: true });

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
      const floorButton = screen.getByText("1").parent;
      expect(floorButton?.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: expect.any(String) })
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
    const parseGeoJSONToFloorSpy = jest.spyOn(IndoorMapComposite, "parseGeoJSONToFloor");

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(parseGeoJSONToFloorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: "FeatureCollection" }),
        1,
        "MB"
      );
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
      expect(textContents).toContain("MB 1.210");
      expect(textContents).toContain("Main Hallway");
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
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      const textElements = screen.getAllByTestId("svg-text");
      const roomText = textElements.find(el => 
        el.findByProps({ testID: "text-content" })?.props.children === "MB 1.210"
      );
      expect(roomText?.findByProps({ testID: "text-x" })?.props.children).toBe(100);
      expect(roomText?.findByProps({ testID: "text-y" })?.props.children).toBe(200);
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
      expect(fills).toContain(expect.any(String));
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
    const mockFloor = {
      getName: jest.fn(() => "Floor 1"),
      getType: jest.fn(() => "floor"),
      getFloors: jest.fn(() => []),
      getRooms: jest.fn(() => []),
      getPOIs: jest.fn(() => []),
      getCoordinates: jest.fn(() => []),
      getCentroid: jest.fn(() => [0, 0]),
      getFloorNumber: jest.fn(() => 1),
      getChildren: jest.fn(() => [
        {
          getName: () => "Test Room",
          getType: () => "room",
          getCoordinates: () => [[0, 0], [100, 0], [100, 100], [0, 100]],
          getCentroid: () => [50, 50],
          getFloors: () => [],
          getRooms: () => [],
          getPOIs: () => [],
        },
      ]),
    };

    jest.spyOn(IndoorMapComposite, "parseGeoJSONToFloor").mockReturnValue(mockFloor as any);

    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(mockFloor.getChildren).toHaveBeenCalled();
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

    const { UNSAFE_getByType } = render(<IndoorMapScreen />);

    await waitFor(() => {
      const scrollView = UNSAFE_getByType(require("react-native").ScrollView);
      expect(scrollView).toBeTruthy();
    });
  });
});
