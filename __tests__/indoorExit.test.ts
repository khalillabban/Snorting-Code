import { selectBestIndoorExit } from "../utils/indoorExit";
import type { BuildingPlanAsset } from "../utils/mapAssets";

jest.mock("../utils/mapAssets", () => {
  return {
    normalizeIndoorBuildingCode: (c: string) => (c ?? "").trim().toUpperCase(),
    getBuildingPlanAsset: jest.fn(),
  };
});

import { getBuildingPlanAsset } from "../utils/mapAssets";

describe("utils/indoorExit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the only exit when a building has one valid exit", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "room1", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "hall", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 0, label: "Hall", accessible: true },
        { id: "exit1", type: "building_entry_exit", buildingId: "H", floor: 1, x: 2, y: 0, label: "Exit", accessible: true },
      ],
      edges: [
        { source: "room1", target: "hall", type: "walk", weight: 1, accessible: true },
        { source: "hall", target: "exit1", type: "walk", weight: 1, accessible: true },
      ],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "room1", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exit.nodeId).toBe("exit1");
      expect(result.exit.pathDistance).toBe(2);
    }
  });

  it("chooses the best exit when multiple exits exist", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "origin", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "a", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 0, label: "A", accessible: true },
        { id: "b", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 1, label: "B", accessible: true },
        { id: "exitNear", type: "building_entry_exit", buildingId: "H", floor: 1, x: 2, y: 0, label: "Exit Near", accessible: true },
        { id: "exitFar", type: "building_entry_exit", buildingId: "H", floor: 1, x: 10, y: 0, label: "Exit Far", accessible: true },
      ],
      edges: [
        { source: "origin", target: "a", type: "walk", weight: 1, accessible: true },
        { source: "a", target: "exitNear", type: "walk", weight: 1, accessible: true },
        { source: "origin", target: "b", type: "walk", weight: 5, accessible: true },
        { source: "b", target: "exitFar", type: "walk", weight: 5, accessible: true },
      ],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exit.nodeId).toBe("exitNear");
      expect(result.exit.pathDistance).toBe(2);
    }
  });

  it("ignores unreachable exits", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "origin", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "exit1", type: "building_entry_exit", buildingId: "H", floor: 1, x: 2, y: 0, label: "Exit 1", accessible: true },
        { id: "exit2", type: "building_entry_exit", buildingId: "H", floor: 1, x: 10, y: 0, label: "Exit 2", accessible: true },
      ],
      edges: [
        { source: "origin", target: "exit1", type: "walk", weight: 1, accessible: true },
        // exit2 is disconnected
      ],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exit.nodeId).toBe("exit1");
    }
  });

  it("handles missing exit metadata safely", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "origin", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
      ],
      edges: [],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("NO_GRAPH_DATA");
    }
  });

  it("returns deterministic results for the same input", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "origin", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "exitA", type: "building_entry_exit", buildingId: "H", floor: 1, x: 2, y: 0, label: "A", accessible: true },
        { id: "exitB", type: "building_entry_exit", buildingId: "H", floor: 1, x: 2, y: 1, label: "B", accessible: true },
      ],
      edges: [
        { source: "origin", target: "exitA", type: "walk", weight: 2, accessible: true },
        { source: "origin", target: "exitB", type: "walk", weight: 2, accessible: true },
      ],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const run = () =>
      selectBestIndoorExit("H", { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 });

    const r1 = run();
    const r2 = run();
    expect(r1).toEqual(r2);
  });

    it("surfaces outdoorLatLng when present on the exit node", () => {
      const asset = {
        nodes: [
          {
            id: "A",
            type: "hallway_waypoint",
            buildingId: "TEST",
            floor: 1,
            x: 0,
            y: 0,
            accessible: true,
          },
          {
            id: "EXIT_1",
            type: "building_entry_exit",
            buildingId: "TEST",
            floor: 1,
            x: 10,
            y: 0,
            accessible: true,
            outdoorLatLng: { latitude: 45.0, longitude: -73.0 },
          },
        ],
        edges: [{ source: "A", target: "EXIT_1", weight: 1, accessible: true }],
      } as any;

      (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

      const result = selectBestIndoorExit(
        "TEST",
        { roomOrNodeId: "A", x: 0, y: 0, floor: 1 },
        {},
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.exit.outdoorLatLng).toEqual({ latitude: 45.0, longitude: -73.0 });
      }
    });
});
