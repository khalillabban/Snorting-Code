import {
  getIndoorNavigationRoute,
  getRouteWaypointsForFloor
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
  resolveRoutingNodeId
} from "../utils/indoorPathFinding";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import { getBuildingPlanAsset } from "../utils/mapAssets";

const mockedGetNormalizedBuildingPlan = getNormalizedBuildingPlan as jest.Mock;
const mockedFindIndoorRoomMatch = findIndoorRoomMatch as jest.Mock;
const mockedGetBuildingPlanAsset = getBuildingPlanAsset as jest.Mock;
const mockedResolveRoutingNodeId = resolveRoutingNodeId as jest.Mock;
const mockedFindShortestPath = findShortestPath as jest.Mock;

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
  edges: [
    { source: "n1", target: "n2", type: "walk", weight: 1, accessible: true },
  ],
};
const baseAsset: BuildingPlanAsset = {
  meta: { buildingId: "H" },
  nodes: [],
  edges: [
    { source: "n1", target: "n2", type: "walk", weight: 1, accessible: true },
  ],
};
const elevatorPath = {
  steps: [
    {
      node: {
        id: "room-a",
        x: 10,
        y: 10,
        floor: 1,
        type: "room",
        label: "H-101",
        accessible: true,
      },
      cumulativeDistance: 0,
    },
    {
      node: {
        id: "door-1",
        x: 15,
        y: 10,
        floor: 1,
        type: "doorway",
        label: "Door",
        accessible: true,
      },
      cumulativeDistance: 5,
    },
    {
      node: {
        id: "elev-1",
        x: 40,
        y: 10,
        floor: 1,
        type: "elevator_door",
        label: "Elev Lobby",
        accessible: true,
      },
      cumulativeDistance: 20,
    },
    {
      node: {
        id: "elev-2",
        x: 40,
        y: 10,
        floor: 2,
        type: "elevator_door",
        label: "Elev Lobby",
        accessible: true,
      },
      cumulativeDistance: 20,
    },
    {
      node: {
        id: "door-2",
        x: 60,
        y: 10,
        floor: 2,
        type: "doorway",
        label: "Door",
        accessible: true,
      },
      cumulativeDistance: 25,
    },
    {
      node: {
        id: "room-b",
        x: 80,
        y: 10,
        floor: 2,
        type: "room",
        label: "H-201",
        accessible: true,
      },
      cumulativeDistance: 30,
    },
  ],
  totalDistance: 30,
  fullyAccessible: true,
  floors: [1, 2],
};

const stairsPath = {
  steps: [
    {
      node: {
        id: "room-a",
        x: 10,
        y: 10,
        floor: 1,
        type: "room",
        label: "H-101",
        accessible: true,
      },
      cumulativeDistance: 0,
    },
    {
      node: {
        id: "hall-1",
        x: 20,
        y: 10,
        floor: 1,
        type: "hallway",
        label: "Hall",
        accessible: true,
      },
      cumulativeDistance: 10,
    },
    {
      node: {
        id: "stair-1",
        x: 30,
        y: 10,
        floor: 1,
        type: "stair_landing",
        label: "Stair",
        accessible: false,
      },
      cumulativeDistance: 20,
    },
    {
      node: {
        id: "stair-2",
        x: 30,
        y: 10,
        floor: 2,
        type: "stair_landing",
        label: "Stair",
        accessible: false,
      },
      cumulativeDistance: 20,
    },
    {
      node: {
        id: "hall-2",
        x: 20,
        y: 10,
        floor: 2,
        type: "hallway",
        label: "Hall",
        accessible: true,
      },
      cumulativeDistance: 30,
    },
    {
      node: {
        id: "room-b",
        x: 10,
        y: 10,
        floor: 2,
        type: "room",
        label: "H-201",
        accessible: true,
      },
      cumulativeDistance: 40,
    },
  ],
  totalDistance: 40,
  fullyAccessible: false,
  floors: [1, 2],
};

describe("utils/indoorNavigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetNormalizedBuildingPlan.mockReturnValue({ rooms: [] });
    mockedFindIndoorRoomMatch.mockImplementation(
      (_: unknown, query: string) => {
        if (query === "101") {
          return {
            room: originRoom,
            floor: 1,
            matchType: "exact_label",
            score: 900,
          };
        }
        if (query === "201") {
          return {
            room: destinationRoom,
            floor: 2,
            matchType: "exact_label",
            score: 900,
          };
        }
        return null;
      },
    );
    mockedGetBuildingPlanAsset.mockReturnValue(baseAsset);
    mockedResolveRoutingNodeId.mockImplementation(
      (_: unknown, roomId: string) => {
        if (roomId === "room-a") return "room-a";
        if (roomId === "room-b") return "room-b";
        return null;
      },
    );
    mockedFindShortestPath.mockReturnValue({
      steps: [
        {
          node: {
            id: "room-a",
            x: 10,
            y: 10,
            floor: 1,
            type: "room",
            label: "H-101",
            accessible: true,
          },
          cumulativeDistance: 0,
        },
        {
          node: {
            id: "door-1",
            x: 15,
            y: 10,
            floor: 1,
            type: "doorway",
            label: "Door",
            accessible: true,
          },
          cumulativeDistance: 5,
        },
        {
          node: {
            id: "hall-1",
            x: 40,
            y: 10,
            floor: 1,
            type: "hallway",
            label: "Elev Lobby",
            accessible: true,
          },
          cumulativeDistance: 20,
        },
        {
          node: {
            id: "hall-2",
            x: 40,
            y: 10,
            floor: 2,
            type: "hallway",
            label: "Elev Lobby",
            accessible: true,
          },
          cumulativeDistance: 20,
        },
        {
          node: {
            id: "door-2",
            x: 60,
            y: 10,
            floor: 2,
            type: "doorway",
            label: "Door",
            accessible: true,
          },
          cumulativeDistance: 25,
        },
        {
          node: {
            id: "room-b",
            x: 80,
            y: 10,
            floor: 2,
            type: "room",
            label: "H-201",
            accessible: true,
          },
          cumulativeDistance: 30,
        },
      ],
      totalDistance: 30,
      fullyAccessible: true,
      floors: [1, 2],
    });
    mockedResolveRoutingNodeId.mockImplementation(
      (_: unknown, roomId: string) => {
        if (roomId === "room-a") return "room-a";
        if (roomId === "room-b") return "room-b";
        return null;
      },
    );
    mockedFindShortestPath.mockReturnValue(elevatorPath);
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
      expect.objectContaining({
        success: false,
        error: "DESTINATION_NOT_FOUND",
      }),
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

  it("returns NO_GRAPH_DATA when the asset has no edges", () => {
    mockedGetBuildingPlanAsset.mockReturnValueOnce({
      meta: { buildingId: "H" },
      nodes: [],
      edges: [],
    });
    expect(getIndoorNavigationRoute("H", "101", "201")).toEqual(
      expect.objectContaining({ success: false, error: "NO_GRAPH_DATA" }),
    );
  });
  it("returns NO_PATH_FOUND when origin node cannot be resolved to the graph", () => {
    mockedResolveRoutingNodeId.mockImplementationOnce(
      (_: unknown, roomId: string) => {
        if (roomId === "room-a") return null;
        return "room-b";
      },
    );
    expect(getIndoorNavigationRoute("H", "101", "201")).toEqual(
      expect.objectContaining({ success: false, error: "NO_PATH_FOUND" }),
    );
  });

  it("returns NO_PATH_FOUND when pathfinding returns null (standard route)", () => {
    mockedFindShortestPath.mockReturnValueOnce(null);
    const result = getIndoorNavigationRoute("H", "101", "201");
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "NO_PATH_FOUND" }),
    );
    if (!result.success) {
      expect(result.message).toMatch(/not be connected/i);
    }
  });

  it("returns accessible-specific error message when pathfinding returns null in accessible mode", () => {
    mockedFindShortestPath.mockReturnValueOnce(null);
    const result = getIndoorNavigationRoute("H", "101", "201", {
      accessibleOnly: true,
    });
    expect(result).toEqual(
      expect.objectContaining({ success: false, error: "NO_PATH_FOUND" }),
    );
    if (!result.success) {
      expect(result.message).toMatch(/no accessible route/i);
      expect(result.message).toMatch(/elevator/i);
    }
  });
  it("returns NO_GRAPH_DATA for missing edges and NO_PATH_FOUND for unresolved node/path", () => {
    mockedGetBuildingPlanAsset.mockReturnValueOnce({
      meta: { buildingId: "H" },
      nodes: [],
      edges: [],
    });
    const missingEdges = getIndoorNavigationRoute("H", "101", "201");
    expect(missingEdges).toEqual(
      expect.objectContaining({ success: false, error: "NO_GRAPH_DATA" }),
    );

    mockedResolveRoutingNodeId.mockImplementationOnce(
      (_: unknown, roomId: string) => {
        if (roomId === "room-a") return null;
        return "room-b";
      },
    );
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

  it("builds a route with elevator segments when accessibleOnly=true", () => {
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
    expect(result.route.estimatedSeconds).toBe(Math.round(30 / 10 / 1.4));
    const kinds = result.route.segments.map((s) => s.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["exit_room", "walk", "elevator", "enter_room"]),
    );
    expect(result.route.fullyAccessible).toBe(true);
    expect(result.route.estimatedSeconds).toBe(Math.round(30 / 10 / 1.4));
  });

  it("builds a route with stair segments on a standard (non-accessible) route", () => {
    mockedFindShortestPath.mockReturnValueOnce(stairsPath);
    const result = getIndoorNavigationRoute("H", "101", "201");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(mockedFindShortestPath).toHaveBeenCalledWith(
      baseAsset,
      "room-a",
      "room-b",
      {},
    );

    const kinds = result.route.segments.map((s) => s.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(["exit_room", "walk", "stairs", "enter_room"]),
    );
    expect(result.route.fullyAccessible).toBe(false);
  });

  it("passes accessibleOnly=false explicitly when toggle is off", () => {
    getIndoorNavigationRoute("H", "101", "201", { accessibleOnly: false });
    expect(mockedFindShortestPath).toHaveBeenCalledWith(
      baseAsset,
      "room-a",
      "room-b",
      { accessibleOnly: false },
    );
  });

  it("populates route metadata correctly", () => {
    const result = getIndoorNavigationRoute("H", "101", "201");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.route.origin).toEqual(originRoom);
    expect(result.route.destination).toEqual(destinationRoom);
    expect(result.route.floors).toEqual([1, 2]);
    expect(result.route.totalDistance).toBe(30);
  });

  it("returns scaled waypoints only for the requested floor", () => {
    const route = {
      origin: originRoom,
      destination: destinationRoom,
      totalDistance: 20,
      fullyAccessible: true,
      estimatedSeconds: 36,
      floors: [1, 2],
      segments: [],
      path: {
        steps: [
          {
            node: {
              id: "a",
              x: 10,
              y: 20,
              floor: 1,
              type: "hallway",
              label: "A",
              accessible: true,
            },
            cumulativeDistance: 0,
          },
          {
            node: {
              id: "b",
              x: 30,
              y: 40,
              floor: 2,
              type: "hallway",
              label: "B",
              accessible: true,
            },
            cumulativeDistance: 10,
          },
          {
            node: {
              id: "c",
              x: 50,
              y: 60,
              floor: 2,
              type: "hallway",
              label: "C",
              accessible: true,
            },
            cumulativeDistance: 20,
          },
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

  it("returns only floor-1 waypoints without scaling when coordinateScale defaults to 1", () => {
    const route = {
      origin: originRoom,
      destination: destinationRoom,
      totalDistance: 10,
      fullyAccessible: true,
      estimatedSeconds: 1,
      floors: [1, 2],
      segments: [],
      path: {
        steps: [
          {
            node: {
              id: "a",
              x: 10,
              y: 20,
              floor: 1,
              type: "hallway",
              label: "A",
              accessible: true,
            },
            cumulativeDistance: 0,
          },
          {
            node: {
              id: "b",
              x: 30,
              y: 40,
              floor: 2,
              type: "hallway",
              label: "B",
              accessible: true,
            },
            cumulativeDistance: 10,
          },
        ],
        totalDistance: 10,
        fullyAccessible: true,
        floors: [1, 2],
      },
    };

    expect(getRouteWaypointsForFloor(route as any, 1)).toEqual([
      { x: 10, y: 20 },
    ]);
  });

  it("returns empty array when no steps exist on the requested floor", () => {
    const route = {
      origin: originRoom,
      destination: destinationRoom,
      totalDistance: 10,
      fullyAccessible: true,
      estimatedSeconds: 1,
      floors: [1],
      segments: [],
      path: {
        steps: [
          {
            node: {
              id: "a",
              x: 10,
              y: 20,
              floor: 1,
              type: "hallway",
              label: "A",
              accessible: true,
            },
            cumulativeDistance: 0,
          },
        ],
        totalDistance: 10,
        fullyAccessible: true,
        floors: [1],
      },
    };

    expect(getRouteWaypointsForFloor(route as any, 9)).toEqual([]);
  });
});
