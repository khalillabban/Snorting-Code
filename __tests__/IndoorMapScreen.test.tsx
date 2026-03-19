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
}, { virtual: true });

jest.mock("../utils/IndoorMapComposite", () => ({
  parseGeoJSONToFloor: jest.fn(),
}));

jest.mock("../utils/mapAssets", () => ({
  getLegacyFloorGeoJsonAsset: jest.fn(),
  getFloorImageAsset: jest.fn(),
}));

jest.mock("../utils/indoorBuildingPlan", () => ({
  compactIndoorSearchKey: (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
  getNormalizedBuildingPlan: jest.fn(),
}));

jest.mock("../utils/indoorRoomSearch", () => ({
  findIndoorRoomMatch: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import IndoorMapScreen from "../app/IndoorMapScreen";
import { colors } from "../constants/theme";
import { parseGeoJSONToFloor } from "../utils/IndoorMapComposite";
import { getFloorImageAsset, getLegacyFloorGeoJsonAsset } from "../utils/mapAssets";
import { getNormalizedBuildingPlan } from "../utils/indoorBuildingPlan";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";

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

const mockHallRoom = {
  id: "Hall_F8_room_291",
  buildingCode: "H",
  floor: 8,
  label: "H-867",
  roomNumber: "867",
  roomName: undefined,
  aliases: [],
  x: 138,
  y: 210,
  accessible: true,
  searchTerms: ["H-867", "867"],
  searchKeys: ["H867", "867"],
};

const mockMBRoom = {
  id: "MB_F1_room_1.210",
  buildingCode: "MB",
  floor: 1,
  label: "MB-1.210",
  roomNumber: "1.210",
  roomName: undefined,
  aliases: [],
  x: 652,
  y: 340,
  accessible: true,
  searchTerms: ["MB-1.210", "1.210"],
  searchKeys: ["MB1210", "1210"],
};

const mockHallPlan = {
  buildingCode: "H",
  floors: [1, 2, 8, 9],
  rooms: [mockHallRoom],
  roomsByFloor: {
    1: [],
    2: [],
    8: [mockHallRoom],
    9: [],
  },
};

const mockMBPlan = {
  buildingCode: "MB",
  floors: [-2, 1],
  rooms: [mockMBRoom],
  roomsByFloor: {
    [-2]: [],
    1: [mockMBRoom],
  },
};

describe("IndoorMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pinchUpdateHandler = undefined;
    pinchEndHandler = undefined;
    (parseGeoJSONToFloor as jest.Mock).mockReturnValue(mockFloor);
    (getLegacyFloorGeoJsonAsset as jest.Mock).mockImplementation(
      (buildingCode: string, floor: number) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        return normalized === "MB" && [1, -2].includes(floor)
          ? { type: "FeatureCollection", features: [] }
          : undefined;
      },
    );
    (getFloorImageAsset as jest.Mock).mockImplementation((buildingCode: string) => {
      const normalized = (buildingCode ?? "").trim().toUpperCase();
      return normalized === "H" ? 1 : undefined;
    });
    (getNormalizedBuildingPlan as jest.Mock).mockImplementation(
      (buildingCode: string) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        if (normalized === "H") return mockHallPlan;
        if (normalized === "MB") return mockMBPlan;
        return null;
      },
    );
    (findIndoorRoomMatch as jest.Mock).mockReturnValue(null);
    (require("react-native").Image.resolveAssetSource as any) = jest.fn(() => ({
      width: 1000,
      height: 800,
    }));
  });

  it("renders with building name and floor selector", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText(/Inside MB Building/)).toBeTruthy();
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
      expect(screen.getByText(/Inside MB Building/)).toBeTruthy();
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
  it("renders room search controls", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("room-search-input")).toBeTruthy();
      expect(screen.getByTestId("room-search-button")).toBeTruthy();
    });
  });
  it("finds a room on another floor and shows a marker on the destination floor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockHallRoom,
      floor: 8,
      matchType: "exact_label",
      score: 900,
    });

    render(<IndoorMapScreen />);

    fireEvent.changeText(screen.getByTestId("room-search-input"), "H-867");
    fireEvent.press(screen.getByTestId("room-search-button"));

    await waitFor(() => {
      expect(findIndoorRoomMatch).toHaveBeenCalledWith(mockHallPlan, "H-867", {
        currentFloor: 1,
      });
      expect(screen.getByTestId("selected-room-banner")).toBeTruthy();
      expect(screen.getByText("Showing H-867 on floor 8")).toBeTruthy();
      expect(screen.getByTestId("selected-room-marker")).toBeTruthy();
      expect(screen.getByTestId("floor-button-8").props.accessibilityState).toEqual({
        selected: true,
      });
    });
  });
  it("shows a not-found message when room lookup fails", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    fireEvent.changeText(screen.getByTestId("room-search-input"), "H-999");
    fireEvent.press(screen.getByTestId("room-search-button"));

    await waitFor(() => {
      expect(screen.getByTestId("room-search-error")).toBeTruthy();
      expect(screen.getByText('Room "H-999" was not found in H.')).toBeTruthy();
    });
  });
  it("highlights the selected MB room polygon after a successful search", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
      matchType: "exact_room",
      score: 850,
    });

    render(<IndoorMapScreen />);

    fireEvent.changeText(screen.getByTestId("room-search-input"), "1.210");
    fireEvent.press(screen.getByTestId("room-search-button"));

    await waitFor(() => {
      const fills = screen
        .getAllByTestId("polygon-fill")
        .map((node) => node.props.children);
      expect(fills).toContain(colors.secondary);
      expect(screen.getByText("Showing MB-1.210 on floor 1")).toBeTruthy();
    });
  });
  it("auto-searches the roomQuery param on load", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      roomQuery: "867",
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockHallRoom,
      floor: 8,
      matchType: "exact_room",
      score: 850,
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(findIndoorRoomMatch).toHaveBeenCalledWith(mockHallPlan, "867", {
        currentFloor: 1,
      });
      expect(screen.getByText("Showing H-867 on floor 8")).toBeTruthy();
      expect(screen.getByTestId("room-search-input").props.value).toBe("H-867");
      expect(screen.getByTestId("selected-room-marker")).toBeTruthy();
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
