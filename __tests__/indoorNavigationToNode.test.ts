import {
  getIndoorNavigationRouteToNode,
} from "../utils/indoorNavigation";

jest.mock("../utils/indoorBuildingPlan", () => {
  return {
    getNormalizedBuildingPlan: jest.fn(),
  };
});

jest.mock("../utils/indoorRoomSearch", () => {
  return {
    findIndoorRoomMatch: jest.fn(),
  };
});

jest.mock("../utils/mapAssets", () => {
  return {
    getBuildingPlanAsset: jest.fn(),
  };
});

jest.mock("../utils/indoorPathFinding", () => {
  return {
    resolveRoutingNodeId: jest.fn(),
    findShortestPath: jest.fn(),
  };
});

import { getNormalizedBuildingPlan } from "../utils/indoorBuildingPlan";
import { findIndoorRoomMatch } from "../utils/indoorRoomSearch";
import { getBuildingPlanAsset } from "../utils/mapAssets";
import { resolveRoutingNodeId, findShortestPath } from "../utils/indoorPathFinding";

describe("getIndoorNavigationRouteToNode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("routes from an origin room to a destination nodeId", () => {
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue({ rooms: [] });
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: {
        id: "room1",
        label: "H-101",
        floor: 1,
        x: 0,
        y: 0,
        accessible: true,
      },
    });

    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [
        { id: "originNode", floor: 1, x: 0, y: 0, type: "hallway" },
        { id: "exitNode", floor: 1, x: 10, y: 0, type: "building_entry_exit", label: "Exit" },
      ],
      edges: [{ source: "originNode", target: "exitNode", weight: 1, accessible: true }],
    });

    (resolveRoutingNodeId as jest.Mock).mockReturnValue("originNode");
    (findShortestPath as jest.Mock).mockReturnValue({
      steps: [
        { node: { id: "originNode", floor: 1, x: 0, y: 0, type: "hallway" }, cumulativeDistance: 0 },
        { node: { id: "exitNode", floor: 1, x: 10, y: 0, type: "building_entry_exit" }, cumulativeDistance: 1 },
      ],
      floors: [1],
      totalDistance: 1,
      fullyAccessible: true,
    });

    const result = getIndoorNavigationRouteToNode("H", "H-101", "exitNode");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.route.destination.id).toBe("exitNode");
      expect(result.route.totalDistance).toBe(1);
    }
  });

  it("fails when destination nodeId does not exist", () => {
    (getNormalizedBuildingPlan as jest.Mock).mockReturnValue({ rooms: [] });
    (findIndoorRoomMatch as jest.Mock).mockReturnValue({
      room: {
        id: "room1",
        label: "H-101",
        floor: 1,
        x: 0,
        y: 0,
        accessible: true,
      },
    });

    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [{ id: "originNode", floor: 1, x: 0, y: 0, type: "hallway" }],
      edges: [{ source: "originNode", target: "originNode", weight: 0, accessible: true }],
    });

    (resolveRoutingNodeId as jest.Mock).mockReturnValue("originNode");

    const result = getIndoorNavigationRouteToNode("H", "H-101", "missingExit");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("DESTINATION_NOT_FOUND");
    }
  });
});
