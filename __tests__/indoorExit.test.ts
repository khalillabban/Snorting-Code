import { getBuildingOutdoorFallback, selectBestIndoorExit } from "../utils/indoorExit";
import { findShortestPath, resolveRoutingNodeId } from "../utils/indoorPathFinding";
import type { BuildingPlanAsset } from "../utils/mapAssets";
import { getBuildingPlanAsset } from "../utils/mapAssets";

jest.mock("../utils/mapAssets", () => {
  return {
    normalizeIndoorBuildingCode: (c: string) => (c ?? "").trim().toUpperCase(),
    getBuildingPlanAsset: jest.fn(),
  };
});

jest.mock("../utils/indoorPathFinding", () => {
  return {
    resolveRoutingNodeId: jest.fn(),
    findShortestPath: jest.fn(),
  };
});

describe("utils/indoorExit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveRoutingNodeId as jest.Mock).mockImplementation(
      (_asset: any, roomOrNodeId: string) => roomOrNodeId,
    );

    // Simple deterministic path model:
    // - If there's an edge (origin -> dest), we return weight (respecting accessibleOnly).
    // - Otherwise, unreachable.
    (findShortestPath as jest.Mock).mockImplementation(
      (asset: any, originId: string, destId: string, options: any = {}) => {
        const edges = asset?.edges ?? [];
        const edge = edges.find(
          (e: any) => e.source === originId && e.target === destId,
        );
        if (!edge) return null;
        if (options?.accessibleOnly && edge.accessible === false) return null;
        return { path: [originId, destId], totalDistance: edge.weight ?? 0 };
      },
    );
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
        { source: "room1", target: "exit1", type: "walk", weight: 2, accessible: true },
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
        { source: "origin", target: "exitNear", type: "walk", weight: 2, accessible: true },
        { source: "origin", target: "exitFar", type: "walk", weight: 10, accessible: true },
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

  it("returns NO_EXIT_NODES when the graph has no exit nodes", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        {
          id: "origin",
          type: "room",
          buildingId: "H",
          floor: 1,
          x: 0,
          y: 0,
          label: "H-101",
          accessible: true,
        },
        {
          id: "hall",
          type: "hallway",
          buildingId: "H",
          floor: 1,
          x: 1,
          y: 0,
          label: "Hall",
          accessible: true,
        },
      ],
      edges: [{ source: "origin", target: "hall", type: "walk", weight: 1, accessible: true }],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("NO_EXIT_NODES");
    }
  });

  it("returns NO_ORIGIN_NODE when origin can't be resolved", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        {
          id: "exit1",
          type: "building_entry_exit",
          buildingId: "H",
          floor: 1,
          x: 2,
          y: 0,
          label: "Exit",
          accessible: true,
        },
      ],
      edges: [{ source: "origin", target: "exit1", type: "walk", weight: 1, accessible: true }],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);
    (resolveRoutingNodeId as jest.Mock).mockReturnValue(null);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("NO_ORIGIN_NODE");
    }
  });

  it("returns NO_REACHABLE_EXIT with accessibleOnly-specific messaging", () => {
    const asset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        {
          id: "origin",
          type: "room",
          buildingId: "H",
          floor: 1,
          x: 0,
          y: 0,
          label: "H-101",
          accessible: true,
        },
        {
          id: "exit1",
          type: "building_entry_exit",
          buildingId: "H",
          floor: 1,
          x: 2,
          y: 0,
          label: "Exit",
          accessible: true,
        },
      ],
      edges: [{ source: "origin", target: "exit1", type: "walk", weight: 1, accessible: false }],
    };

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "H",
      { roomOrNodeId: "origin", x: 0, y: 0, floor: 1 },
      { accessibleOnly: true },
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("NO_REACHABLE_EXIT");
      expect(result.message).toBe("No accessible exit route found.");
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
        edges: [{ source: "A", target: "EXIT_1", type: "walk", weight: 1, accessible: true }],
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

  it("omits outdoorLatLng when the exit node has invalid outdoorLatLng", () => {
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
          outdoorLatLng: { latitude: "45", longitude: -73.0 },
        },
      ],
      edges: [{ source: "A", target: "EXIT_1", type: "walk", weight: 1, accessible: true }],
    } as any;

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "TEST",
      { roomOrNodeId: "A", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exit.outdoorLatLng).toBeUndefined();
    }
  });

  it("provides a safe null building outdoor fallback (placeholder)", () => {
    expect(getBuildingOutdoorFallback("H")).toBeNull();
  });

  it("handles missing and NaN outdoorLatLng safely", () => {
    const baseAsset = {
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
      ],
      edges: [{ source: "A", target: "EXIT", type: "walk", weight: 1, accessible: true }],
    };

    // Missing outdoorLatLng entirely
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      ...baseAsset,
      nodes: [
        ...baseAsset.nodes,
        {
          id: "EXIT",
          type: "building_entry_exit",
          buildingId: "TEST",
          floor: 1,
          x: 10,
          y: 0,
          accessible: true,
        },
      ],
    } as any);

    const missing = selectBestIndoorExit(
      "TEST",
      { roomOrNodeId: "A", x: 0, y: 0, floor: 1 },
      {},
    );
    expect(missing.success).toBe(true);
    if (missing.success) {
      expect(missing.exit.outdoorLatLng).toBeUndefined();
    }

    // NaN latitude
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      ...baseAsset,
      nodes: [
        ...baseAsset.nodes,
        {
          id: "EXIT",
          type: "building_entry_exit",
          buildingId: "TEST",
          floor: 1,
          x: 10,
          y: 0,
          accessible: true,
          outdoorLatLng: { latitude: Number.NaN, longitude: -73.0 },
        },
      ],
    } as any);

    const nan = selectBestIndoorExit(
      "TEST",
      { roomOrNodeId: "A", x: 0, y: 0, floor: 1 },
      {},
    );
    expect(nan.success).toBe(true);
    if (nan.success) {
      expect(nan.exit.outdoorLatLng).toBeUndefined();
    }
  });

  it("omits outdoorLatLng when longitude isn't a number", () => {
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
          outdoorLatLng: { latitude: 45.0, longitude: "-73" },
        },
      ],
      edges: [{ source: "A", target: "EXIT_1", type: "walk", weight: 1, accessible: true }],
    } as any;

    (getBuildingPlanAsset as jest.Mock).mockReturnValue(asset);

    const result = selectBestIndoorExit(
      "TEST",
      { roomOrNodeId: "A", x: 0, y: 0, floor: 1 },
      {},
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.exit.outdoorLatLng).toBeUndefined();
    }
  });
});
