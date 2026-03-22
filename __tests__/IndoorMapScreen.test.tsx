import React from "react";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
}));

jest.mock("expo-image", () => {
  const React = require("react");
  const { Image } = require("react-native");
  return {
    Image: ({ contentFit, ...props }: any) => <Image {...props} />,
  };
});

jest.mock("../utils/mapAssets", () => ({
  getFloorImageMetadata: jest.fn(),
  getLegacyFloorGeoJsonAsset: jest.fn(),
  normalizeIndoorBuildingCode: jest.fn((buildingCode: string) =>
    (buildingCode ?? "").trim().toUpperCase(),
  ),
}));

jest.mock("../utils/indoorBuildingPlan", () => ({
  getNormalizedBuildingPlan: jest.fn(),
}));

jest.mock("../utils/indoorRoomSearch", () => ({
  findIndoorRoomMatch: jest.fn(),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import IndoorMapScreen from "../app/IndoorMapScreen";
import { getNormalizedBuildingPlan } from "../utils/indoorBuildingPlan";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import { getFloorImageMetadata } from "../utils/mapAssets";

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

    (getFloorImageMetadata as jest.Mock).mockImplementation(
      (buildingCode: string, floor: number) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        if (normalized === "H" && [1, 2, 8, 9].includes(floor)) {
          return {
            source: 1,
            width: 1024,
            height: 1024,
            coordinateScale: 0.5,
          };
        }
        if (normalized === "MB" && [1, -2].includes(floor)) {
          return {
            source: 2,
            width: 1024,
            height: 1024,
            coordinateScale: 1,
          };
        }
        return undefined;
      },
    );

    (getNormalizedBuildingPlan as jest.Mock).mockImplementation(
      (buildingCode: string) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        if (normalized === "H") return mockHallPlan;
        if (normalized === "MB") return mockMBPlan;
        return null;
      },
    );

    (findIndoorRoomMatch as jest.Mock).mockReturnValue(null);
  });

  it("renders with building name and floor selector", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText(/MB Building/)).toBeTruthy();
      expect(screen.getByText("1")).toBeTruthy();
      expect(screen.getByText("-2")).toBeTruthy();
      expect(screen.getByTestId("indoor-floor-stage")).toBeTruthy();
      expect(screen.getByTestId("indoor-floor-image")).toBeTruthy();
    });
  });

  it("defaults to the first available floor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, 2, 3]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", 1);
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

    fireEvent.press(screen.getByText("-2"));

    await waitFor(() => {
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", -2);
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

  it("handles empty floors array gracefully", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText(/MB Building/)).toBeTruthy();
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

  it("renders room search controls", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("From room…")).toBeTruthy();
      expect(screen.getByPlaceholderText("To room…")).toBeTruthy();
      expect(screen.getByText("Go")).toBeTruthy();
    });
  });

  it("finds a room on another floor and shows a marker on the destination floor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      roomQuery: "H-867",
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockHallRoom,
      floor: 8,
      matchType: "exact_label",
      score: 900,
    });

    render(<IndoorMapScreen />);

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
      roomQuery: "H-999",
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("room-search-error")).toBeTruthy();
      expect(screen.getByText('Room "H-999" was not found in H.')).toBeTruthy();
    });
  });

  it("highlights the selected MB room with the marker overlay after a successful search", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
      roomQuery: "1.210",
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
      matchType: "exact_room",
      score: 850,
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("selected-room-marker")).toBeTruthy();
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
      expect(screen.getByTestId("selected-room-marker")).toBeTruthy();
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
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", -2);
    });

    params = {
      buildingName: "MB",
      floors: JSON.stringify([1]),
    };

    rerender(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", 1);
    });
  });

  it("renders the floor inside the fitted stage container", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("indoor-floor-stage")).toBeTruthy();
      expect(screen.queryByTestId("selected-room-banner")).toBeNull();
    });
  });
});
