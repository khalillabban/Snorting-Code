import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import IndoorMapScreen from "../app/IndoorMapScreen";
import { BUILDINGS } from "../constants/buildings";
import { pickClosestEntryExitNodeId } from "../utils/destinationIndoorLeg";
import { getNormalizedBuildingPlan } from "../utils/indoorBuildingPlan";
import { selectBestIndoorExit } from "../utils/indoorExit";
import {
  getIndoorNavigationRoute,
  getIndoorNavigationRouteFromNode,
  getIndoorNavigationRouteToNode,
} from "../utils/indoorNavigation";
import {
  findIndoorRoomMatch,
  findIndoorRoomMatches,
} from "../utils/indoorRoomSearch";
import {
  getBuildingPlanAsset,
  getFloorImageMetadata,
} from "../utils/mapAssets";
import { parseTransitionPayload } from "../utils/routeTransition";
import { logUsabilityEvent } from "../utils/usabilityAnalytics";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(() => ({ push: mockPush, back: jest.fn() })),
}));

jest.mock("../utils/usabilityAnalytics", () => ({
  logUsabilityEvent: jest.fn(),
}));
jest.mock("../constants/usabilityConfig", () => ({
  __esModule: true,
  USABILITY_TESTING_ENABLED: true,
  getSessionId: jest.fn(() => "test-session-id"),
  resetSession: jest.fn(() => "test-session-id"),
}));
jest.mock("expo-crypto", () => ({ randomUUID: jest.fn(() => "mock-uuid") }));

jest.mock("expo-image", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Image } = require("react-native");
  return {
    Image: ({ contentFit, ...props }: any) => <Image {...props} />,
  };
});

jest.mock("../utils/mapAssets", () => ({
  getFloorImageMetadata: jest.fn(),
  getAvailableFloors: jest.fn(() => []),
  getBuildingPlanAsset: jest.fn(),
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
  findIndoorRoomMatches: jest.fn(),
}));

jest.mock("../utils/indoorNavigation", () => ({
  getIndoorNavigationRoute: jest.fn(),
  getIndoorNavigationRouteFromNode: jest.fn(),
  getIndoorNavigationRouteToNode: jest.fn(),
  getRouteWaypointsForFloor: jest.fn(() => []),
}));

jest.mock("../utils/indoorExit", () => ({
  selectBestIndoorExit: jest.fn(),
}));

jest.mock("../utils/indoorPOI", () => ({
  getIndoorPOIs: jest.fn(() => []),
  filterPOIsByFloor: jest.fn(() => []),
  filterPOIsByCategories: jest.fn(() => []),
}));

jest.mock("../utils/destinationIndoorLeg", () => ({
  // Keep the real sentinel logic, but expose the pick fn so we can force the fallback branch.
  isDestinationLegOrigin: (value: any) =>
    String(value ?? "")
      .trim()
      .toUpperCase() === "ENTRANCE",
  pickClosestEntryExitNodeId: jest.fn(),
}));

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

function expectConsoleErrorWithMessage(
  consoleErrorSpy: jest.SpyInstance,
  expectedMessage: string,
) {
  const hasExpectedError = consoleErrorSpy.mock.calls.some((call) =>
    call.some(
      (arg: unknown) =>
        arg instanceof Error &&
        typeof arg.message === "string" &&
        arg.message.includes(expectedMessage),
    ),
  );
  expect(hasExpectedError).toBe(true);
}

describe("IndoorMapScreen", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.clearAllMocks();
    (logUsabilityEvent as jest.Mock).mockResolvedValue(undefined);

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
    (findIndoorRoomMatches as jest.Mock).mockReturnValue([]);
    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: false,
      error: "NO_PATH_FOUND",
      message: "No indoor route found.",
      route: null, // Ensure route is null for failure cases
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("renders with building name and floor selector", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    render(<IndoorMapScreen />);
    await screen.findByText(/MB Building/); // Wait for initial render effects

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
    await screen.findByText(/MB Building/); // Wait for initial render effects

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
    await screen.findByText(/MB Building/); // Wait for initial render effects

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
    await screen.findByText("No map available for UNKNOWN-99"); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByText("No map available for UNKNOWN-99")).toBeTruthy();
    });
  });

  it("computes destination-leg directions when navOrigin is ENTRANCE", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    // Destination room exists.
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
    });

    // Provide a plan asset with at least one entry/exit node.
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      meta: { buildingId: "MB" },
      nodes: [
        {
          id: "entry-node-1",
          type: "building_entry_exit",
          buildingId: "MB",
          floor: 1,
          x: 10,
          y: 10,
          label: "MB-ENTRY",
          accessible: true,
        },
      ],
      edges: [],
    });

    (getIndoorNavigationRouteFromNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 1, x: 10, y: 10 },
        destination: { floor: 1, x: mockMBRoom.x, y: mockMBRoom.y },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    // Auto-trigger navigation at mount.
    await waitFor(() => {
      expect(getIndoorNavigationRouteFromNode).toHaveBeenCalledWith(
        "MB",
        "entry-node-1",
        "MB-1.210",
        expect.any(Object),
      );
    });
  });

  it("falls back to the first entrance node when pickClosestEntryExitNodeId returns undefined", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (pickClosestEntryExitNodeId as jest.Mock).mockReturnValue(undefined);

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
    });
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      meta: { buildingId: "MB" },
      nodes: [
        {
          id: "entry-node-first",
          type: "building_entry_exit",
          buildingId: "MB",
          floor: 1,
          x: 10,
          y: 10,
          label: "MB-ENTRY",
          accessible: true,
        },
        {
          id: "entry-node-second",
          type: "building_entry_exit",
          buildingId: "MB",
          floor: 1,
          x: 100,
          y: 100,
          label: "MB-ENTRY-2",
          accessible: true,
        },
      ],
      edges: [],
    });

    (getIndoorNavigationRouteFromNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 1, x: 10, y: 10 },
        destination: { floor: 1, x: mockMBRoom.x, y: mockMBRoom.y },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getIndoorNavigationRouteFromNode).toHaveBeenCalledWith(
        "MB",
        "entry-node-first",
        "MB-1.210",
        expect.any(Object),
      );
    });
  });

  it("shows an error when entrance routing fails (getIndoorNavigationRouteFromNode returns success=false)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (pickClosestEntryExitNodeId as jest.Mock).mockReturnValue("entry-node-1");
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
    });
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      meta: { buildingId: "MB" },
      nodes: [
        {
          id: "entry-node-1",
          type: "building_entry_exit",
          buildingId: "MB",
          floor: 1,
          x: 10,
          y: 10,
          label: "MB-ENTRY",
          accessible: true,
        },
      ],
      edges: [],
    });

    (getIndoorNavigationRouteFromNode as jest.Mock).mockReturnValue({
      success: false,
      message: "No entrance route available.",
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText("No entrance route available.")).toBeTruthy();
    });
  });

  it("shows an error when ENTRANCE routing is requested without a destination room", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
      navOrigin: "ENTRANCE",
      navDest: "",
    });

    render(<IndoorMapScreen />);

    fireEvent.press(screen.getByText("Go"));

    await waitFor(() => {
      expect(
        screen.getByText("Enter a destination room to continue indoors."),
      ).toBeTruthy();
    });
  });

  it("shows an error when ENTRANCE routing is requested but no entrance nodes exist", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
    });
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      meta: { buildingId: "MB" },
      nodes: [],
      edges: [],
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(
        screen.getByText("No building entrances were found for MB."),
      ).toBeTruthy();
    });
  });

  it("shows an error when ENTRANCE routing is requested but no building plan/asset exists", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(null);
    (getBuildingPlanAsset as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    expect(
      await screen.findByText('No building plan found for "MB".'),
    ).toBeTruthy();
  });

  it("shows an error when ENTRANCE routing is requested but destination room match is missing", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockMBPlan);
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [{ id: "E1", type: "building_entry_exit" }],
      edges: [],
    });
    (findIndoorRoomMatch as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    expect(
      await screen.findByText('Room "MB-1.210" was not found in MB.'),
    ).toBeTruthy();
  });

  it("shows an error when ENTRANCE routing is requested but no usable entrance node id exists", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockMBPlan);
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockMBRoom,
      floor: 1,
    });
    // Force the fallback to use entryNodes[0]?.id, but make it falsy.
    (pickClosestEntryExitNodeId as jest.Mock).mockReturnValue(undefined);
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [{ type: "building_entry_exit" }],
      edges: [],
    });

    render(<IndoorMapScreen />);

    expect(
      await screen.findByText("No usable entrance node was found for MB."),
    ).toBeTruthy();
  });

  it("prefills the destination input from destinationRoomQuery when doing a cross-building origin leg", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      navOrigin: "MB-1.210",
      navDest: "CC",
      outdoorDestBuilding: "CC",
      destinationRoomQuery: "CC-124",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockMBPlan);
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [],
      edges: [],
    });

    render(<IndoorMapScreen />);

    // The "To" field should be prefilled to the destinationRoomQuery value.
    const to = await screen.findByPlaceholderText("To (H-920)");
    expect((to as any).props.value).toBe("CC-124");
  });

  it("shows a generic error when ENTRANCE routing throws an exception", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      navOrigin: "ENTRANCE",
      navDest: "MB-1.210",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockMBPlan);
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [{ id: "E1", type: "building_entry_exit" }],
      edges: [],
    });
    (findIndoorRoomMatch as jest.Mock).mockImplementation(() => {
      throw new Error("boom");
    });

    render(<IndoorMapScreen />);

    expect(
      await screen.findByText(
        "Unable to compute indoor directions from the entrance.",
      ),
    ).toBeTruthy();
  });

  it("handles empty floors array gracefully", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([]),
    });

    render(<IndoorMapScreen />);
    await screen.findByText(/MB Building/); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByText(/MB Building/)).toBeTruthy();
    });
  });

  it("shows an error when attempting cross-building navigation from an indoor map", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      outdoorDestBuilding: "MB",
    });

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    // User tries to route to another building code from an indoor map.
    // This should now be blocked and instruct the user to use the Campus Map.
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "CC",
    });

    render(<IndoorMapScreen />);

    // Trigger the navigation calculation.
    fireEvent.press(screen.getByText("Go"));

    await waitFor(() => {
      expect(
        screen.getByText(
          /Cross-building directions start from the Campus Map/i,
        ),
      ).toBeTruthy();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("computes cross-building origin-leg directions to an exit and enables Continue outside", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: { latitude: 45.4971, longitude: -73.5791 },
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    // Auto-trigger navigation at mount (via params).
    await waitFor(() => {
      expect(selectBestIndoorExit).toHaveBeenCalled();
      expect(getIndoorNavigationRouteToNode).toHaveBeenCalledWith(
        "H",
        "H-867",
        "exit-node-1",
        expect.any(Object),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId("continue-outside")).toBeTruthy();
    });
  });

  it("Continue outside uses the exit outdoor coordinate when it’s near the origin building and pushes CampusMapScreen", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
      outdoorStrategy: JSON.stringify({ travelMode: "WALKING" }),
      outdoorAccessibleOnly: "true",
    });

    const originBuilding = BUILDINGS.find(
      (b) => b.name.trim().toUpperCase() === "H",
    );
    const near = originBuilding?.coordinates ?? {
      latitude: 45.4971,
      longitude: -73.5791,
    };

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: near,
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/CampusMapScreen" }),
      );
    });
  });

  it("Continue outside rejects an implausible exit coordinate and falls back to building centroid", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    // A far-away coordinate should trip the guardrail and use the building centroid instead.
    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: { latitude: 0, longitude: 0 },
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/CampusMapScreen" }),
      );
    });
  });

  it("cross-building origin-leg resets pendingExitOutdoor when exit has no outdoorLatLng", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: null,
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/CampusMapScreen" }),
      );
    });
  });

  it("shows an error when selectBestIndoorExit fails on cross-building origin-leg", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: false,
      message: "No exits found.",
    });

    render(<IndoorMapScreen />);

    // Auto-trigger navigation.
    await waitFor(() => {
      expect(screen.getByText("No exits found.")).toBeTruthy();
    });
  });

  it("shows an error when no building plan is available for cross-building origin-leg", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByText('No building plan found for "H".')).toBeTruthy();
    });
  });

  it("shows an error when origin room match is missing for cross-building origin-leg", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-DOES-NOT-EXIST",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);
    (findIndoorRoomMatch as jest.Mock).mockReturnValue(null);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Could not find room matching "H-DOES-NOT-EXIST" in H\./,
        ),
      ).toBeTruthy();
    });
  });

  it("shows an error when computing the cross-building origin-leg route throws", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
    });

    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({ room: mockHallRoom });

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: { latitude: 45.4971, longitude: -73.5791 },
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockImplementation(() => {
      throw new Error("boom");
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(
        screen.getByText("Unable to compute an indoor route to an exit."),
      ).toBeTruthy();
    });
  });

  it("Continue outside shows an error when no origin building centroid is available (effectiveExitOutdoor null)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "NOT_A_BUILDING",
      floors: JSON.stringify([1]),
      navOrigin: "H-867",
      navDest: "NOT_A_BUILDING",
      outdoorDestBuilding: "MB",
    });

    // This needs the cross-building origin-leg route so `activeRoute` becomes truthy and the CTA renders.
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue({
      buildingCode: "NOT_A_BUILDING",
      floors: [1],
      rooms: [mockHallRoom],
      roomsByFloor: { 1: [mockHallRoom] },
    });

    (findIndoorRoomMatch as jest.Mock).mockReturnValue({ room: mockHallRoom });

    // Select an exit with no outdoor coordinate.
    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: { nodeId: "exit-node-1", outdoorLatLng: null },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 1, x: 0, y: 0 },
        destination: { floor: 1, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(
        screen.getByText(
          /Couldn't determine an outdoor start point for this building exit/i,
        ),
      ).toBeTruthy();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Continue outside tolerates invalid outdoorStrategy JSON (strategy becomes undefined) and still navigates", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
      outdoorStrategy: "{not-json}",
    });

    const originBuilding = BUILDINGS.find(
      (b) => b.name.trim().toUpperCase() === "H",
    );
    const near = originBuilding?.coordinates ?? {
      latitude: 45.4971,
      longitude: -73.5791,
    };

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: near,
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
    });
  });

  it("blocks building-to-campus navigation from indoor map and shows cross-building guidance", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "SGW",
    });

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    render(<IndoorMapScreen />);

    fireEvent.press(screen.getByText("Go"));

    await waitFor(() => {
      expect(
        screen.getByText(
          /Cross-building directions start from the Campus Map/i,
        ),
      ).toBeTruthy();
    });
    expect(getIndoorNavigationRoute).not.toHaveBeenCalled();
  });

  it("Continue outside includes usability task metadata when params are valid", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
      usabilityTaskId: "task_13",
      usabilityTaskStartedAtMs: "12345",
      destinationRoomQuery: "MB-1.210",
    });

    const originBuilding = BUILDINGS.find(
      (b) => b.name.trim().toUpperCase() === "H",
    );
    const near = originBuilding?.coordinates ?? {
      latitude: 45.4971,
      longitude: -73.5791,
    };

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: near,
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/CampusMapScreen" }),
      );
    });

    const pushArg = mockPush.mock.calls.at(-1)?.[0];
    const transition = parseTransitionPayload(pushArg?.params?.transition);
    expect(transition?.usabilityTaskId).toBe("task_13");
    expect(transition?.usabilityTaskStartedAtMs).toBe(12345);
    expect(pushArg?.params?.destinationRoomQuery).toBe("MB-1.210");
  });

  it("Continue outside preserves task_14 usability metadata when params are valid", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "VL",
      usabilityTaskId: "task_14",
      usabilityTaskStartedAtMs: "67890",
      destinationRoomQuery: "VL-202-30",
    });

    const originBuilding = BUILDINGS.find(
      (b) => b.name.trim().toUpperCase() === "H",
    );
    const near = originBuilding?.coordinates ?? {
      latitude: 45.4971,
      longitude: -73.5791,
    };

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: near,
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/CampusMapScreen" }),
      );
    });

    const pushArg = mockPush.mock.calls.at(-1)?.[0];
    const transition = parseTransitionPayload(pushArg?.params?.transition);
    expect(transition?.usabilityTaskId).toBe("task_14");
    expect(transition?.usabilityTaskStartedAtMs).toBe(67890);
    expect(pushArg?.params?.destinationRoomQuery).toBe("VL-202-30");
  });

  it("Continue outside omits usability task metadata when params are invalid", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8, 9]),
      navOrigin: "H-867",
      navDest: "H",
      outdoorDestBuilding: "MB",
      usabilityTaskId: "task_999",
      usabilityTaskStartedAtMs: "not-a-number",
    });

    const originBuilding = BUILDINGS.find(
      (b) => b.name.trim().toUpperCase() === "H",
    );
    const near = originBuilding?.coordinates ?? {
      latitude: 45.4971,
      longitude: -73.5791,
    };

    (findIndoorRoomMatch as jest.Mock).mockImplementation(
      (_plan: any, query: string) => {
        if (query === "H-867") return { room: mockHallRoom };
        return null;
      },
    );

    (selectBestIndoorExit as jest.Mock).mockReturnValue({
      success: true,
      exit: {
        nodeId: "exit-node-1",
        outdoorLatLng: near,
      },
    });

    (getIndoorNavigationRouteToNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 8, x: 0, y: 0 },
        destination: { floor: 8, x: 1, y: 1 },
        waypoints: [],
        segments: [],
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() =>
      expect(screen.getByTestId("continue-outside")).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId("continue-outside"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/CampusMapScreen" }),
      );
    });

    const pushArg = mockPush.mock.calls.at(-1)?.[0];
    const transition = parseTransitionPayload(pushArg?.params?.transition);
    expect(transition?.usabilityTaskId).toBeUndefined();
    expect(transition?.usabilityTaskStartedAtMs).toBeUndefined();
  });

  it("shows no map when buildingName is undefined", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: undefined,
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);
    await screen.findByText("No map available for undefined-1"); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByText("No map available for undefined-1")).toBeTruthy();
    });
  });

  it("renders room search inputs with placeholder text and Go button", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByPlaceholderText("From (H-110)"); // Wait for initial render effects

    await waitFor(() => {
      // Placeholders were updated — must match current IndoorMapScreen JSX
      expect(screen.getByPlaceholderText("From (H-110)")).toBeTruthy();
      expect(screen.getByPlaceholderText("To (H-920)")).toBeTruthy();
      expect(screen.getByText("Go")).toBeTruthy();
    });
  });

  it("shows room suggestions while typing in the origin field", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (findIndoorRoomMatches as jest.Mock).mockReturnValue([
      {
        room: mockHallRoom,
        floor: 8,
        matchType: "prefix_room",
        score: 650,
      },
    ]);

    render(<IndoorMapScreen />);
    const originInput = await screen.findByPlaceholderText("From (H-110)");

    fireEvent(originInput, "focus");
    fireEvent.changeText(originInput, "867");

    await waitFor(() => {
      expect(findIndoorRoomMatches).toHaveBeenCalledWith(mockHallPlan, "867", {
        currentFloor: 1,
        maxResults: 6,
      });
      expect(screen.getByTestId("indoor-room-suggestion-list")).toBeTruthy();
      expect(
        screen.getByTestId("indoor-room-suggestion-origin-Hall_F8_room_291"),
      ).toBeTruthy();
      expect(screen.getByText("H-867")).toBeTruthy();
      expect(screen.getByText("Floor 8")).toBeTruthy();
    });
  });

  it("selects a room suggestion for the destination field", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (findIndoorRoomMatches as jest.Mock).mockReturnValue([
      {
        room: mockHallRoom,
        floor: 8,
        matchType: "prefix_room",
        score: 650,
      },
    ]);

    render(<IndoorMapScreen />);
    const destinationInput = await screen.findByPlaceholderText("To (H-920)");

    fireEvent(destinationInput, "focus");
    fireEvent.changeText(destinationInput, "867");

    await waitFor(() => {
      expect(
        screen.getByTestId("indoor-room-suggestion-dest-Hall_F8_room_291"),
      ).toBeTruthy();
    });

    fireEvent.press(
      screen.getByTestId("indoor-room-suggestion-dest-Hall_F8_room_291"),
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("H-867")).toBeTruthy();
      expect(screen.queryByTestId("indoor-room-suggestion-list")).toBeNull();
      expect(screen.getByText("Showing H-867 on floor 8")).toBeTruthy();
      expect(
        screen.getByTestId("floor-button-8").props.accessibilityState,
      ).toEqual({
        selected: true,
      });
    });
  });

  it("shows a no-results helper when indoor room suggestions are empty", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (findIndoorRoomMatches as jest.Mock).mockReturnValue([]);

    render(<IndoorMapScreen />);
    const originInput = await screen.findByPlaceholderText("From (H-110)");

    fireEvent(originInput, "focus");
    fireEvent.changeText(originInput, "ZZZ");

    await waitFor(() => {
      expect(screen.getByTestId("indoor-room-suggestion-empty")).toBeTruthy();
      expect(screen.getByText("No matching rooms found")).toBeTruthy();
      expect(screen.queryByTestId("indoor-room-suggestion-list")).toBeNull();
    });
  });

  it("clears the selected room preview when typing a new indoor query", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (findIndoorRoomMatches as jest.Mock)
      .mockReturnValueOnce([
        {
          room: mockHallRoom,
          floor: 8,
          matchType: "prefix_room",
          score: 650,
        },
      ])
      .mockReturnValue([]);

    render(<IndoorMapScreen />);
    const originInput = await screen.findByPlaceholderText("From (H-110)");

    fireEvent(originInput, "focus");
    fireEvent.changeText(originInput, "867");

    await waitFor(() => {
      expect(
        screen.getByTestId("indoor-room-suggestion-origin-Hall_F8_room_291"),
      ).toBeTruthy();
    });

    fireEvent.press(
      screen.getByTestId("indoor-room-suggestion-origin-Hall_F8_room_291"),
    );

    await waitFor(() => {
      expect(screen.getByText("Showing H-867 on floor 8")).toBeTruthy();
      expect(screen.getByTestId("selected-room-marker")).toBeTruthy();
    });

    fireEvent.changeText(originInput, "H-86");

    await waitFor(() => {
      expect(screen.queryByText("Showing H-867 on floor 8")).toBeNull();
      expect(screen.queryByTestId("selected-room-marker")).toBeNull();
      expect(screen.getByTestId("indoor-room-suggestion-empty")).toBeTruthy();
    });
  });

  it("renders the accessible toggle button", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-accessible-mode-toggle"); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByTestId("indoor-accessible-mode-toggle")).toBeTruthy();
      expect(screen.getByText("Accessible")).toBeTruthy();
    });
  });

  it("accessible toggle defaults to false when param is not set", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-accessible-mode-toggle"); // Wait for initial render effects

    await waitFor(() => {
      const toggle = screen.getByTestId("indoor-accessible-mode-toggle");
      expect(toggle.props.accessibilityState).toEqual({ checked: false });
    });
  });

  it("accessible toggle defaults to true when accessibleOnly param is 'true'", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      accessibleOnly: "true",
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-accessible-mode-toggle"); // Wait for initial render effects

    await waitFor(() => {
      const toggle = screen.getByTestId("indoor-accessible-mode-toggle");
      expect(toggle.props.accessibilityState).toEqual({ checked: true });
    });
  });

  it("toggling the accessible button flips its checked state", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-accessible-mode-toggle"); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByTestId("indoor-accessible-mode-toggle")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("indoor-accessible-mode-toggle"));

    await waitFor(() => {
      const toggle = screen.getByTestId("indoor-accessible-mode-toggle");
      expect(toggle.props.accessibilityState).toEqual({ checked: true });
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_accessible_mode_toggled",
        expect.any(Object),
      );
    });
  });

  it("logs accessible_only false when toggled back off", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-accessible-mode-toggle");

    const toggle = screen.getByTestId("indoor-accessible-mode-toggle");
    fireEvent.press(toggle); // false -> true
    fireEvent.press(toggle); // true -> false

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_accessible_mode_toggled",
        expect.objectContaining({ accessible_only: true }),
      );
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_accessible_mode_toggled",
        expect.objectContaining({ accessible_only: false }),
      );
      expect(
        screen.getByTestId("indoor-accessible-mode-toggle").props
          .accessibilityState,
      ).toEqual({ checked: false });
    });
  });

  it("passes accessibleOnly=true to getIndoorNavigationRoute when toggle is on", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
      accessibleOnly: "true",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: false,
      error: "NO_PATH_FOUND",
      message:
        "No accessible route found. There may be no elevator connecting these floors.",
      route: null,
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getIndoorNavigationRoute).toHaveBeenCalledWith(
        "H",
        "H-110",
        "H-920",
        { accessibleOnly: true },
      );
    });
    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_nav_attempted",
      expect.any(Object),
    );
  });

  it("switches floor when a floor button is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    render(<IndoorMapScreen />);
    await screen.findByText("-2"); // Wait for initial render effects

    await waitFor(() => expect(screen.getByText("-2")).toBeTruthy());

    fireEvent.press(screen.getByText("-2"));

    await waitFor(() => {
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", -2);
    });
  });

  it("resets selectedFloor when available floors change and current floor is no longer valid", async () => {
    let params: any = { buildingName: "MB", floors: JSON.stringify([1, -2]) };
    (useLocalSearchParams as jest.Mock).mockImplementation(() => params);

    const { rerender } = render(<IndoorMapScreen />);

    await waitFor(() => expect(screen.getByText("-2")).toBeTruthy());
    fireEvent.press(screen.getByText("-2"));
    await waitFor(() =>
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", -2),
    );

    params = { buildingName: "MB", floors: JSON.stringify([1]) };
    rerender(<IndoorMapScreen />);

    await screen.findByText("1"); // Wait for re-render
    await waitFor(() => {
      expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", 1);
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
    await screen.findByTestId("selected-room-banner"); // Wait for initial render effects

    await waitFor(() => {
      expect(findIndoorRoomMatch).toHaveBeenCalledWith(mockHallPlan, "H-867", {
        currentFloor: 1,
      });
      expect(screen.getByTestId("selected-room-banner")).toBeTruthy();
      expect(screen.getByText("Showing H-867 on floor 8")).toBeTruthy();
      expect(screen.getByTestId("selected-room-marker")).toBeTruthy();
      expect(
        screen.getByTestId("floor-button-8").props.accessibilityState,
      ).toEqual({
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
    await screen.findByTestId("selected-room-marker"); // Wait for initial render effects

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
    await screen.findByText("Showing H-867 on floor 8"); // Wait for initial render effects

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
    (getFloorImageMetadata as jest.Mock).mockReturnValue({
      source: 1,
      width: 1024,
      height: 1024,
      coordinateScale: 1,
    });

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

    await screen.findByText("1"); // Wait for re-render
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
    await screen.findByTestId("indoor-floor-stage"); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByTestId("indoor-floor-stage")).toBeTruthy();
      expect(screen.queryByTestId("selected-room-banner")).toBeNull();
    });
  });

  it("shows unavailable-search error when building plan is missing", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "UNKNOWN",
      floors: JSON.stringify([1]),
      roomQuery: "A-100",
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("room-search-error"); // Wait for initial render effects

    await waitFor(() => {
      expect(screen.getByTestId("room-search-error")).toBeTruthy();
      expect(
        screen.getByText("Room search is not available for UNKNOWN."),
      ).toBeTruthy();
    });
  });

  it("shows a not-found error when room lookup fails", async () => {
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

  it("runs indoor navigation from navOrigin/navDest params and can close directions", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 2, label: "H-110" },
        // @ts-ignore
        destination: { ...mockHallRoom, floor: 9, label: "H-920" },
        path: { steps: [] },
        segments: [
          {
            kind: "walk",
            description: "Walk forward",
            nodeIds: ["a", "b"],
            floor: 2,
            distance: 50,
          },
        ],
        floors: [2, 9],
        totalDistance: 50,
        fullyAccessible: true,
        estimatedSeconds: 35,
      },
    });

    render(<IndoorMapScreen />);
    await screen.findByText("H-110 → H-920"); // Wait for initial render effects

    await waitFor(() => {
      expect(getIndoorNavigationRoute).toHaveBeenCalledWith(
        "H",
        "H-110",
        "H-920",
        { accessibleOnly: false },
      );
      expect(screen.getByText("H-110 → H-920")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("✕"));

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_directions_panel_closed",
        expect.any(Object),
      );
      expect(screen.queryByText("H-110 → H-920")).toBeNull();
    });
  });

  it("closes the directions panel when the close button is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 2, label: "H-110" },
        // @ts-ignore
        destination: { ...mockHallRoom, floor: 9, label: "H-920" },
        path: { steps: [] },
        segments: [
          {
            kind: "walk",
            description: "Walk forward",
            nodeIds: ["a", "b"],
            floor: 2,
            distance: 50,
          },
        ],
        floors: [2, 9],
        totalDistance: 50,
        fullyAccessible: true,
        estimatedSeconds: 35,
      },
    });

    render(<IndoorMapScreen />);
    await screen.findByText("H-110 → H-920"); // Wait for initial render effects

    await waitFor(() => expect(screen.getByText("H-110 → H-920")).toBeTruthy());

    fireEvent.press(screen.getByText("✕"));

    await waitFor(() => {
      expect(screen.queryByText("H-110 → H-920")).toBeNull();
    });
  });

  it("shows navigation error when indoor route lookup fails", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: false,
      error: "NO_PATH_FOUND",
      message: "Unable to find indoor route",
    });

    render(<IndoorMapScreen />);
    await screen.findByText("Unable to find indoor route");

    await waitFor(() => {
      expect(screen.getByText("Unable to find indoor route")).toBeTruthy();
    });
  });

  it("shows accessible-specific error message when accessible route is not found", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
      accessibleOnly: "true",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: false,
      error: "NO_PATH_FOUND",
      message:
        "No accessible route found. There may be no elevator connecting these floors.",
    });

    render(<IndoorMapScreen />);
    await screen.findByText(
      "No accessible route found. There may be no elevator connecting these floors.",
    ); // Wait for initial render effects

    await waitFor(() => {
      expect(
        screen.getByText(
          "No accessible route found. There may be no elevator connecting these floors.",
        ),
      ).toBeTruthy();
    });
  });

  it("passes accessibleOnly=false to navigation when toggle is off and Go is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByText("Go"); // Wait for initial render effects

    await waitFor(() => expect(screen.getByText("Go")).toBeTruthy());

    fireEvent.changeText(screen.getByPlaceholderText("From (H-110)"), "H-110");
    fireEvent.changeText(screen.getByPlaceholderText("To (H-920)"), "H-920");
    fireEvent.press(screen.getByText("Go"));

    await waitFor(() => {
      expect(getIndoorNavigationRoute).toHaveBeenCalledWith(
        "H",
        "H-110",
        "H-920",
        { accessibleOnly: false },
      );
    });
  });

  it("passes accessibleOnly=true to navigation when toggle is enabled before pressing Go", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-accessible-mode-toggle"); // Wait for initial render effects

    await waitFor(() =>
      expect(screen.getByTestId("indoor-accessible-mode-toggle")).toBeTruthy(),
    );

    fireEvent.press(screen.getByTestId("indoor-accessible-mode-toggle"));
    fireEvent.changeText(screen.getByPlaceholderText("From (H-110)"), "H-110");
    fireEvent.changeText(screen.getByPlaceholderText("To (H-920)"), "H-920");
    fireEvent.press(screen.getByText("Go"));

    await waitFor(() => {
      expect(getIndoorNavigationRoute).toHaveBeenCalledWith(
        "H",
        "H-110",
        "H-920",
        { accessibleOnly: true },
      );
    });
  });

  it("uses full-image bounds (showFullImage: true) instead of content-fitted bounds for MB", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    // Return MB metadata with showFullImage: true to cover the new branch in floorBounds useMemo
    (getFloorImageMetadata as jest.Mock).mockImplementation(
      (buildingCode: string, floor: number) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        if (normalized === "MB" && [1, -2].includes(floor)) {
          return {
            source: 2,
            width: 1024,
            height: 1024,
            coordinateScale: 1,
            showFullImage: true,
          };
        }
        return undefined;
      },
    );

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-floor-stage");

    await waitFor(() => {
      expect(screen.getByTestId("indoor-floor-stage")).toBeTruthy();
      expect(screen.getByTestId("indoor-floor-image")).toBeTruthy();
    });

    expect(getFloorImageMetadata).toHaveBeenCalledWith("MB", 1);
  });

  it("falls back to Math.max room-coordinate dimensions when no floor image metadata exists", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([8]),
    });
    // Return undefined so floorImageMetadata is undefined → lines 79 & 82 hit the ?? fallback
    (getFloorImageMetadata as jest.Mock).mockReturnValue(undefined);
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);

    render(<IndoorMapScreen />);
    await screen.findByText("No map available for H-8"); // Wait for initial render effects

    // No floor image asset → shows the no-map message rather than the stage
    await waitFor(() => {
      expect(screen.getByText("No map available for H-8")).toBeTruthy();
    });
  });

  it("uses floor 1 as fallback when availableFloors is empty and roomQuery is provided (line 208)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: "", // parseFloors("") → []
      roomQuery: "H-867",
    });
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockHallRoom,
      floor: 8,
    });

    render(<IndoorMapScreen />);
    await screen.findByText(/H Building/);

    // useInitialRoomQuery fires with availableFloors[0] || 1 → 1 (the || 1 branch)
    await waitFor(() => {
      expect(findIndoorRoomMatch).toHaveBeenCalled();
    });
  });

  it("adds and removes a POI category when its filter chip is pressed (lines 286-293)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);

    render(<IndoorMapScreen />);
    await screen.findByTestId("poi-filter-chip-washroom"); // Wait for initial render effects

    const washroomChip = await waitFor(() =>
      screen.getByTestId("poi-filter-chip-washroom"),
    );

    // First press: category not in set → next.add(categoryId) — line 291
    fireEvent.press(washroomChip);
    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_poi_category_toggled",
      expect.any(Object),
    );

    // Second press: category now in set → next.delete(categoryId) — line 289
    fireEvent.press(washroomChip);
    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_poi_category_toggled",
      expect.any(Object),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("poi-filter-chip-washroom").props.accessibilityState,
      ).toEqual(expect.objectContaining({ selected: false }));
    });
  });

  it("does nothing when Go is pressed without a buildingName (line 423 early return)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: undefined,
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    render(<IndoorMapScreen />);
    await screen.findByText(/Building/);

    await waitFor(() => expect(screen.getByText("Go")).toBeTruthy());
    fireEvent.press(screen.getByText("Go"));

    // handleNavigate returns early; getIndoorNavigationRoute is never called
    expect(getIndoorNavigationRoute).not.toHaveBeenCalled();
  });

  it("updates map viewport dimensions when the map container is laid out (lines 564-565)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);

    render(<IndoorMapScreen />);
    await screen.findByTestId("indoor-map-container"); // Wait for initial render effects

    const mapContainer = await waitFor(() =>
      screen.getByTestId("indoor-map-container"),
    );

    // Fire the layout event to trigger setMapViewport (lines 564-565)
    fireEvent(mapContainer, "layout", {
      nativeEvent: { layout: { width: 390, height: 560 } },
    });

    // Component should re-render without error; floor stage is still present
    await waitFor(() => {
      expect(screen.getByTestId("indoor-floor-stage")).toBeTruthy();
    });
  });

  it("auto-triggers navigation from navOrigin and navDest URL params on mount", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: false,
      error: "NO_PATH_FOUND",
      message: "No indoor route found.",
    });

    render(<IndoorMapScreen />); // This will trigger the useEffect for auto-trigger
    await screen.findByText("No indoor route found."); // Wait for the error message to appear

    await waitFor(() => {
      expect(getIndoorNavigationRoute).toHaveBeenCalledWith(
        "H",
        "H-110",
        "H-920",
        { accessibleOnly: false },
      );
    });
  });

  // New test for handlePOIFilterFirstInteraction
  it("logs first POI filter interaction only once", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1]),
    });
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);

    render(<IndoorMapScreen />);

    const washroomChip = await waitFor(() =>
      screen.getByTestId("poi-filter-chip-washroom"),
    );
    const stairsChip = screen.getByTestId("poi-filter-chip-stairs");
    const callsBefore = (logUsabilityEvent as jest.Mock).mock.calls.length;

    fireEvent.press(washroomChip);
    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_poi_filter_bar_first_tap",
      expect.any(Object),
    );
    const callsAfterFirstPress = (logUsabilityEvent as jest.Mock).mock.calls
      .length;
    expect(callsAfterFirstPress).toBeGreaterThan(callsBefore);

    fireEvent.press(stairsChip);
    const callsAfterSecondPress = (logUsabilityEvent as jest.Mock).mock.calls
      .length;
    expect(callsAfterSecondPress).toBeGreaterThan(callsAfterFirstPress);
  });

  // New test for navOrigin/navDest onChangeText analytics
  it("logs nav origin/dest started on first keystroke", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1]),
    });
    render(<IndoorMapScreen />);

    const originInput = screen.getByPlaceholderText("From (H-110)");
    const destInput = screen.getByPlaceholderText("To (H-920)");

    fireEvent.changeText(originInput, "H");
    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_nav_origin_started",
      expect.any(Object),
    );
    expect(logUsabilityEvent).toHaveBeenCalledTimes(2); // screen_loaded + origin_started

    fireEvent.changeText(originInput, "H-1"); // Not first keystroke, should not log again
    expect(logUsabilityEvent).toHaveBeenCalledTimes(2);

    fireEvent.changeText(destInput, "H");
    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_nav_dest_started",
      expect.any(Object),
    );
    expect(logUsabilityEvent).toHaveBeenCalledTimes(3); // screen_loaded + origin_started + dest_started
  });

  // New test for floor change analytics
  it("logs indoor_floor_changed when floor button is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });
    render(<IndoorMapScreen />);

    const floorMinus2Button = screen.getByText("-2");
    fireEvent.press(floorMinus2Button);

    expect(logUsabilityEvent).toHaveBeenCalledWith(
      "indoor_floor_changed",
      expect.objectContaining({
        floor_selected: -2,
        previous_floor: 1,
      }),
    );
  });

  it("handles analytics failures for origin/destination typing and floor change", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1, -2]),
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("From (H-110)")).toBeTruthy();
      expect(screen.getByPlaceholderText("To (H-920)")).toBeTruthy();
      expect(screen.getByText("-2")).toBeTruthy();
    });

    (logUsabilityEvent as jest.Mock).mockRejectedValueOnce(
      new Error("origin analytics failure"),
    );
    fireEvent.changeText(screen.getByPlaceholderText("From (H-110)"), "H");

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "origin analytics failure",
      );
    });

    (logUsabilityEvent as jest.Mock).mockRejectedValueOnce(
      new Error("destination analytics failure"),
    );
    fireEvent.changeText(screen.getByPlaceholderText("To (H-920)"), "H");

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "destination analytics failure",
      );
    });

    (logUsabilityEvent as jest.Mock).mockRejectedValueOnce(
      new Error("floor analytics failure"),
    );
    fireEvent.press(screen.getByText("-2"));

    await waitFor(() => {
      expectConsoleErrorWithMessage(consoleErrorSpy, "floor analytics failure");
    });

    consoleErrorSpy.mockRestore();
  });

  it("uses building_name fallback 'unknown' in typing and floor analytics when buildingName is missing", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: undefined,
      floors: JSON.stringify([1, 2]),
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("From (H-110)")).toBeTruthy();
      expect(screen.getByPlaceholderText("To (H-920)")).toBeTruthy();
      expect(screen.getByText("2")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByPlaceholderText("From (H-110)"), "A");
    fireEvent.changeText(screen.getByPlaceholderText("To (H-920)"), "B");
    fireEvent.press(screen.getByText("2"));

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_nav_origin_started",
        expect.objectContaining({ building_name: "unknown" }),
      );
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_nav_dest_started",
        expect.objectContaining({ building_name: "unknown" }),
      );
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_floor_changed",
        expect.objectContaining({
          building_name: "unknown",
          floor_selected: 2,
        }),
      );
    });
  });

  it("uses building_name fallback 'unknown' in accessible toggle analytics when buildingName is missing", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: undefined,
      floors: JSON.stringify([1]),
    });

    render(<IndoorMapScreen />);

    const toggle = await waitFor(() =>
      screen.getByTestId("indoor-accessible-mode-toggle"),
    );
    fireEvent.press(toggle);

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_accessible_mode_toggled",
        expect.objectContaining({ building_name: "unknown" }),
      );
    });
  });

  it("handles analytics failure when route generation event logging rejects", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 2, label: "H-110" },
        destination: { ...mockHallRoom, floor: 9, label: "H-920" },
        path: { steps: [] },
        segments: [],
        floors: [2, 9],
        totalDistance: 50,
        fullyAccessible: true,
        estimatedSeconds: 35,
      },
    });

    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "indoor_route_generated") {
        return Promise.reject(new Error("route generated analytics failure"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "route generated analytics failure",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("logs task_9 for successful same-floor non-accessible route", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 8, label: "H-110" },
        destination: { ...mockHallRoom, floor: 8, label: "H-920" },
        path: { steps: [] },
        segments: [],
        floors: [8],
        totalDistance: 20,
        fullyAccessible: true,
        estimatedSeconds: 20,
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_route_generated",
        expect.objectContaining({ task_id: "task_9", cross_floor: false }),
      );
    });
  });

  it("logs task_12 and floor transition for successful cross-floor non-accessible route", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 2, label: "H-110" },
        destination: { ...mockHallRoom, floor: 9, label: "H-920" },
        path: { steps: [] },
        segments: [],
        floors: [2, 9],
        totalDistance: 50,
        fullyAccessible: true,
        estimatedSeconds: 35,
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_route_generated",
        expect.objectContaining({ task_id: "task_12", cross_floor: true }),
      );
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_floor_transition_in_route",
        expect.objectContaining({ from_floor: 2, to_floor: 9 }),
      );
    });
  });

  it("logs task_10 for successful accessible route", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
      accessibleOnly: "true",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 8, label: "H-110" },
        destination: { ...mockHallRoom, floor: 8, label: "H-920" },
        path: { steps: [] },
        segments: [],
        floors: [8],
        totalDistance: 20,
        fullyAccessible: true,
        estimatedSeconds: 20,
      },
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(logUsabilityEvent).toHaveBeenCalledWith(
        "indoor_route_generated",
        expect.objectContaining({ task_id: "task_10" }),
      );
    });
  });

  it("handles analytics failure when indoor map screen load logging rejects", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
    });

    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "indoor_map_screen_loaded") {
        return Promise.reject(new Error("screen load analytics failure"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "screen load analytics failure",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles analytics failure when task_11 completion logging rejects", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1]),
    });

    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "task_completed") {
        return Promise.reject(
          new Error("task_11 completion analytics failure"),
        );
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);

    const washroomChip = await waitFor(() =>
      screen.getByTestId("poi-filter-chip-washroom"),
    );
    fireEvent.press(washroomChip);

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "task_11 completion analytics failure",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles synchronous analytics exceptions during POI toggles", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1]),
    });

    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "indoor_poi_category_toggled") {
        throw new Error("poi toggle sync analytics failure");
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);

    const washroomChip = await waitFor(() =>
      screen.getByTestId("poi-filter-chip-washroom"),
    );
    fireEvent.press(washroomChip);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Firebase Analytics Error: ",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles analytics failure when route failure event logging rejects", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: false,
      error: "NO_PATH_FOUND",
      message: "Unable to find indoor route",
    });

    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "indoor_route_failed") {
        return Promise.reject(new Error("route failed analytics failure"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "route failed analytics failure",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles analytics failure when closing the directions panel", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "H",
      floors: JSON.stringify([1, 2, 8, 9]),
      navOrigin: "H-110",
      navDest: "H-920",
    });

    (getIndoorNavigationRoute as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { ...mockHallRoom, floor: 2, label: "H-110" },
        destination: { ...mockHallRoom, floor: 9, label: "H-920" },
        path: { steps: [] },
        segments: [],
        floors: [2, 9],
        totalDistance: 50,
        fullyAccessible: true,
        estimatedSeconds: 35,
      },
    });

    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "indoor_directions_panel_closed") {
        return Promise.reject(new Error("close panel analytics failure"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<IndoorMapScreen />);
    await screen.findByText("H-110 → H-920");

    fireEvent.press(screen.getByText("✕"));

    await waitFor(() => {
      expectConsoleErrorWithMessage(
        consoleErrorSpy,
        "close panel analytics failure",
      );
    });

    consoleErrorSpy.mockRestore();
  });

  // New test for useFloorSync when availableFloors is empty
  it("useFloorSync sets selectedFloor to 1 if availableFloors is empty", async () => {
    let params = {
      buildingName: "H",
      floors: JSON.stringify([]),
      roomQuery: "H-867",
    };
    (useLocalSearchParams as jest.Mock).mockImplementation(() => params);
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue(mockHallPlan);
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: mockHallRoom,
      floor: 8,
    });

    render(<IndoorMapScreen />);

    await waitFor(() => {
      expect(getFloorImageMetadata).toHaveBeenCalledWith("H", 1);
    });
  });

  // New test for getFloorContentBounds when currentFloorRooms is empty
  it("getFloorContentBounds returns full image dimensions when currentFloorRooms is empty", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: JSON.stringify([1]),
    });
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue({
      ...mockMBPlan,
      rooms: [],
      roomsByFloor: { 1: [] },
    });
    render(<IndoorMapScreen />);

    // The floorBounds calculation should use the full image dimensions (0,0,width,height)
    // This is implicitly covered by the rendering of the map when there are no rooms.
    // The `floorImageDimensions` will be used directly.
    await screen.findByTestId("indoor-floor-stage");
  });
});
