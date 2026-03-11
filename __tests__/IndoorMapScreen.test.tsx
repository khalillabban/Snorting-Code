import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

const mockGeoJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Room 101", type: "room", centroid: [100, 100] },
      geometry: { type: "Polygon", coordinates: [[[90, 90], [110, 90], [110, 110], [90, 110], [90, 90]]] }
    },
    {
      type: "Feature",
      properties: { name: "Hallway", type: "hallway", centroid: [200, 200] },
      geometry: { type: "Polygon", coordinates: [[[190, 190], [210, 190], [210, 210], [190, 210], [190, 190]]] }
    }
  ]
};

jest.mock("../assets/maps/MB-1.json", () => mockGeoJSON, { virtual: true });
jest.mock("../assets/maps/MB-S2.json", () => mockGeoJSON, { virtual: true });

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
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
      View: ({ children, style, ...props }: any) => <View style={style} {...props}>{children}</View>,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (callback: () => any) => callback(),
  };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    Svg: ({ children, ...props }: any) => <View testID="svg" {...props}>{children}</View>,
    Polygon: ({ points, ...props }: any) => (
      <View testID="svg-polygon" {...props}>
        <Text testID="polygon-points">{points}</Text>
      </View>
    ),
    Text: ({ children, ...props }: any) => <Text testID="svg-text" {...props}>{children}</Text>,
  };
});

import IndoorMapScreen from "../app/IndoorMapScreen";
import { useLocalSearchParams } from "expo-router";

const mockUseLocalSearchParams = useLocalSearchParams as jest.MockedFunction<typeof useLocalSearchParams>;

describe("IndoorMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the building header with building name", () => {
    mockUseLocalSearchParams.mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2]),
    });

    render(<IndoorMapScreen />);
    expect(screen.getByText(/Inside MB Building/)).toBeTruthy();
  });

  it("renders floor selector with available floors", () => {
    mockUseLocalSearchParams.mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2, 3]),
    });

    render(<IndoorMapScreen />);
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("selects the first floor by default", () => {
    mockUseLocalSearchParams.mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2]),
    });

    render(<IndoorMapScreen />);
    
    const floor1Text = screen.getByText("1");
    const floor2Text = screen.getByText("2");
    
    expect(floor1Text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#ffffff" })])
    );
    
    expect(floor2Text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: "#912338" })])
    );
  });

  it("shows no map message when floor data is unavailable", () => {
    mockUseLocalSearchParams.mockReturnValue({
      buildingName: "UNKNOWN",
      floors: JSON.stringify([99]),
    });

    render(<IndoorMapScreen />);
    expect(screen.getByText(/No map available for UNKNOWN-99/)).toBeTruthy();
  });

  it("handles missing floors parameter gracefully", () => {
    mockUseLocalSearchParams.mockReturnValue({
      buildingName: "MB",
      floors: undefined as any,
    });

    render(<IndoorMapScreen />);
    expect(screen.getByText(/Inside MB Building/)).toBeTruthy();
  });


});
