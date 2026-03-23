import {
  getIndoorNavigationRoute,
  getRouteWaypointsForFloor,
} from "../utils/indoorNavigation";
import type { BuildingPlanAsset } from "../utils/mapAssets";

jest.mock("../utils/indoorBuildingPlan", () => ({
  getNormalizedBuildingPlan: jest.fn(),
}));

jest.mock("../utils/indoorRoomSearch", () => ({
  findIndoorRoomMatch: jest.fn(),
}));

jest.mock("../utils/mapAssets", () => ({
  getBuildingPlanAsset: jest.fn(),
}));

jest.mock("../utils/indoorPathFinding", () => ({
  resolveRoutingNodeId: jest.fn(),
  findShortestPath: jest.fn(),
}));

import { getNormalizedBuildingPlan } from "../utils/indoorBuildingPlan";
import {
  findShortestPath,
  resolveRoutingNodeId,
} from "../utils/indoorPathFinding";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import { getBuildingPlanAsset } from "../utils/mapAssets";

const mockedGetNormalizedBuildingPlan = getNormalizedBuildingPlan as jest.Mock;
const mockedFindIndoorRoomMatch = findIndoorRoomMatch as jest.Mock;
const mockedGetBuildingPlanAsset = getBuildingPlanAsset as jest.Mock;
const mockedResolveRoutingNodeId = resolveRoutingNodeId as jest.Mock;
const mockedFindShortestPath = findShortestPath as jest.Mock;

describe("utils/indoorNavigation", () => {
  const originRoom = {
    id: "room-a",
    buildingCode: "H",
    floor: 1,
    label: "H-101",
    roomNumber: "101",
    x: 10,
    y: 10,
    accessible: true,
    searchTerms: ["H-101", "101"],
    searchKeys: ["H101", "101"],
  };

  const destinationRoom = {
    ...originRoom,
    id: "room-b",
    floor: 2,
    label: "H-201",
    roomNumber: "201",
  };

  const baseAsset: BuildingPlanAsset = {
    meta: { buildingId: "H" },
    nodes: [],
    edges: [{ source: "n1", target: "n2", type: "walk", weight: 1, accessible: true }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNormalizedBuildingPlan.mockReturnValue({ rooms: [] });
    mockedFindIndoorRoomMatch.mockImplementation((_: unknown, query: string) => {
      if (query === "101") {
        return { room: originRoom, floor: 1, matchType: "exact_label", score: 900 };
      }
      if (query === "201") {
        return { room: destinationRoom, floor: 2, matchType: "exact_label", score: 900 };
      }
      return null;
    });
    mockedGetBuildingPlanAsset.mockReturnValue(baseAsset);
    mockedResolveRoutingNodeId.mockImplementation((_: unknown, roomId: string) => {
      if (roomId === "room-a") return "room-a";
      if (roomId === "room-b") return "room-b";
      return null;
    });
    mockedFindShortestPath.mockReturnValue({
      steps: [
        { node: { id: "room-a", x: 10, y: 10, floor: 1, type: "room", label: "H-101", accessible: true }, cumulativeDistance: 0 },
        { node: { id: "door-1", x: 15, y: 10, floor: 1, type: "doorway", label: "Door", accessible: true }, cumulativeDistance: 5 },
        { node: { id: "hall-1", x: 40, y: 10, floor: 1, type: "elevator_door", label: "Elev Lobby", accessible: true }, cumulativeDistance: 20 },
        { node: { id: "hall-2", x: 40, y: 10, floor: 2, type: "elevator_door", label: "Elev Lobby", accessible: true }, cumulativeDistance: 20 },
        { node: { id: "door-2", x: 60, y: 10, floor: 2, type: "doorway", label: "Door", accessible: true }, cumulativeDistance: 25 },
        { node: { id: "room-b", x: 80, y: 10, floor: 2, type: "room", label: "H-201", accessible: true }, cumulativeDistance: 30 },
      ],
      totalDistance: 30,
      fullyAccessible: true,
      floors: [1, 2],
    });
  });

  it("returns NO_GRAPH_DATA when plan is missing", () => {
    mockedGetNormalizedBuildingPlan.mockReturnValue(null);
    const result = getIndoorNavigationRoute("H", "101", "201");
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "NO_GRAPH_DATA" }),
    );
  });

  it("returns ORIGIN_NOT_FOUND and DESTINATION_NOT_FOUND errors", () => {
    const noOrigin = getIndoorNavigationRoute("H", "bad", "201");
    expect(noOrigin).toEqual(
      expect.objectContaining({ success: false, error: "ORIGIN_NOT_FOUND" }),
    );

    const noDestination = getIndoorNavigationRoute("H", "101", "bad");
    expect(noDestination).toEqual(
      expect.objectContaining({ success: false, error: "DESTINATION_NOT_FOUND" }),
    );
  });

  it("returns SAME_ROOM when origin and destination are identical", () => {
    mockedFindIndoorRoomMatch.mockReturnValue({
      room: originRoom,
      floor: 1,
      matchType: "exact_label",
      score: 900,
    });

    const result = getIndoorNavigationRoute("H", "101", "101");
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "SAME_ROOM" }),
    );
  });

  it("returns NO_GRAPH_DATA for missing edges and NO_PATH_FOUND for unresolved node/path", () => {
    mockedGetBuildingPlanAsset.mockReturnValueOnce({ meta: { buildingId: "H" }, nodes: [], edges: [] });
    const missingEdges = getIndoorNavigationRoute("H", "101", "201");
    expect(missingEdges).toEqual(
      expect.objectContaining({ success: false, error: "NO_GRAPH_DATA" }),
    );

    mockedResolveRoutingNodeId.mockImplementationOnce((_: unknown, roomId: string) => {
      if (roomId === "room-a") return null;
      return "room-b";
    });
    const unresolvedNode = getIndoorNavigationRoute("H", "101", "201");
    expect(unresolvedNode).toEqual(
      expect.objectContaining({ success: false, error: "NO_PATH_FOUND" }),
    );

    mockedFindShortestPath.mockReturnValueOnce(null);
    const missingPath = getIndoorNavigationRoute("H", "101", "201");
    expect(missingPath).toEqual(
      expect.objectContaining({ success: false, error: "NO_PATH_FOUND" }),
    );
  });

  it("builds an indoor route with segmented instructions", () => {
    const result = getIndoorNavigationRoute("H", "101", "201", {
      accessibleOnly: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(mockedFindShortestPath).toHaveBeenCalledWith(
      baseAsset,
      "room-a",
      "room-b",
      { accessibleOnly: true },
    );

    expect(result.route.segments.map((segment) => segment.kind)).toEqual(
      expect.arrayContaining(["exit_room", "walk", "elevator", "enter_room"]),
    );
    expect(result.route.estimatedSeconds).toBe(Math.round(30 / 1.4));
  });

  it("returns scaled route waypoints for a specific floor", () => {
    const route = {
      origin: originRoom,
      destination: destinationRoom,
      totalDistance: 50,
      fullyAccessible: true,
      estimatedSeconds: 36,
      floors: [1, 2],
      segments: [],
      path: {
        steps: [
          { node: { id: "a", x: 10, y: 20, floor: 1, type: "hallway", label: "A", accessible: true }, cumulativeDistance: 0 },
          { node: { id: "b", x: 30, y: 40, floor: 2, type: "hallway", label: "B", accessible: true }, cumulativeDistance: 10 },
          { node: { id: "c", x: 50, y: 60, floor: 2, type: "hallway", label: "C", accessible: true }, cumulativeDistance: 20 },
        ],
        totalDistance: 20,
        fullyAccessible: true,
        floors: [1, 2],
      },
    };

    expect(getRouteWaypointsForFloor(route as any, 2, 0.5)).toEqual([
      { x: 15, y: 20 },
      { x: 25, y: 30 },
    ]);
  });
});
