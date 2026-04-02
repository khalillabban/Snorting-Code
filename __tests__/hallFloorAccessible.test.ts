/**
 * Tests for hall.json floor 1 accessible navigation nodes and edges.
 *
 * Validates that the hall building plan has the required nodes and edges
 * on floor 1 so that accessible-only pathfinding works correctly.
 */
import { findShortestPath } from "../utils/indoorPathFinding";
import type { BuildingPlanAsset, BuildingPlanNode } from "../utils/mapAssets";

// Load the actual hall.json asset directly
const hallAsset: BuildingPlanAsset = require("../assets/maps/buildingsPlan/hall.json");

// ---------------------------------------------------------------------------
// Floor 1 node structure
// ---------------------------------------------------------------------------

describe("Hall floor 1 nodes", () => {
  const floor1Nodes = hallAsset.nodes.filter((n) => n.floor === 1);

  it("has nodes on floor 1", () => {
    expect(floor1Nodes.length).toBeGreaterThan(0);
  });

  it("has room nodes on floor 1", () => {
    const rooms = floor1Nodes.filter((n) => n.type === "room");
    expect(rooms.length).toBeGreaterThan(0);
  });

  it("has hallway waypoint nodes on floor 1", () => {
    const waypoints = floor1Nodes.filter((n) => n.type === "hallway_waypoint");
    expect(waypoints.length).toBeGreaterThan(0);
  });

  it("has doorway nodes on floor 1", () => {
    const doorways = floor1Nodes.filter((n) => n.type === "doorway");
    expect(doorways.length).toBeGreaterThan(0);
  });

  it("has building entry/exit nodes on floor 1", () => {
    const entries = floor1Nodes.filter((n) => n.type === "building_entry_exit");
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it("has elevator door nodes on floor 1", () => {
    const elevators = floor1Nodes.filter((n) => n.type === "elevator_door");
    expect(elevators.length).toBeGreaterThanOrEqual(2);
  });

  it("has stair landing nodes on floor 1", () => {
    const stairs = floor1Nodes.filter((n) => n.type === "stair_landing");
    expect(stairs.length).toBeGreaterThanOrEqual(1);
  });

  it("marks elevator doors as accessible", () => {
    const elevators = floor1Nodes.filter((n) => n.type === "elevator_door");
    elevators.forEach((e) => {
      expect(e.accessible).toBe(true);
    });
  });

  it("marks stair landings as not accessible", () => {
    const stairs = floor1Nodes.filter((n) => n.type === "stair_landing");
    stairs.forEach((s) => {
      expect(s.accessible).toBe(false);
    });
  });

  it("marks building entry/exit nodes as accessible", () => {
    const entries = floor1Nodes.filter((n) => n.type === "building_entry_exit");
    entries.forEach((entry) => {
      expect(entry.accessible).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Floor 1 edge structure
// ---------------------------------------------------------------------------

describe("Hall floor 1 edges", () => {
  const floor1NodeIds = new Set(
    hallAsset.nodes.filter((n) => n.floor === 1).map((n) => n.id),
  );

  // Edges where both source and target are on floor 1
  const floor1Edges = hallAsset.edges!.filter(
    (e) => floor1NodeIds.has(e.source) && floor1NodeIds.has(e.target),
  );

  it("has edges connecting floor 1 nodes", () => {
    expect(floor1Edges.length).toBeGreaterThan(0);
  });

  it("has hallway edges on floor 1", () => {
    const hallwayEdges = floor1Edges.filter((e) => e.type === "hallway");
    expect(hallwayEdges.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-floor elevator accessibility
// ---------------------------------------------------------------------------

describe("Hall elevator inter-floor edges", () => {
  const elevatorNodes = hallAsset.nodes.filter(
    (n) => n.type === "elevator_door",
  );
  const elevatorIds = new Set(elevatorNodes.map((n) => n.id));

  // Elevator edges connect elevator doors on different floors
  const elevatorEdges = hallAsset.edges!.filter(
    (e) =>
      e.type === "elevator" &&
      elevatorIds.has(e.source) &&
      elevatorIds.has(e.target),
  );

  it("has elevator edges connecting floors", () => {
    expect(elevatorEdges.length).toBeGreaterThan(0);
  });

  it("marks all elevator edges as accessible", () => {
    elevatorEdges.forEach((e) => {
      expect(e.accessible).toBe(true);
    });
  });

  it("elevator edges connect nodes on different floors", () => {
    const nodeMap = new Map<string, BuildingPlanNode>();
    hallAsset.nodes.forEach((n) => nodeMap.set(n.id, n));

    elevatorEdges.forEach((e) => {
      const srcFloor = nodeMap.get(e.source)!.floor;
      const tgtFloor = nodeMap.get(e.target)!.floor;
      expect(srcFloor).not.toBe(tgtFloor);
    });
  });
});

// ---------------------------------------------------------------------------
// Accessible pathfinding from floor 1 to other floors
// ---------------------------------------------------------------------------

describe("Hall accessible pathfinding", () => {
  const floor1Rooms = hallAsset.nodes.filter(
    (n) => n.floor === 1 && n.type === "room" && n.label,
  );
  const floor8Rooms = hallAsset.nodes.filter(
    (n) => n.floor === 8 && n.type === "room" && n.label,
  );

  it("finds an accessible path from a floor 1 room to a floor 8 room", () => {
    // Pick the first labelled room from each floor
    const from = floor1Rooms[0];
    const to = floor8Rooms[0];
    expect(from).toBeDefined();
    expect(to).toBeDefined();

    const path = findShortestPath(hallAsset, from.id, to.id, {
      accessibleOnly: true,
    });

    expect(path).not.toBeNull();
    expect(path!.fullyAccessible).toBe(true);
    // Should use elevator, not stairs
    const nodeIds = path!.steps.map((s) => s.node.id);
    const usesElevator = nodeIds.some((id) =>
      hallAsset.nodes.find((n) => n.id === id && n.type === "elevator_door"),
    );
    expect(usesElevator).toBe(true);
    // Should not use stairs
    const usesStairs = nodeIds.some((id) =>
      hallAsset.nodes.find((n) => n.id === id && n.type === "stair_landing"),
    );
    expect(usesStairs).toBe(false);
  });

  it("finds a standard (non-accessible) path from floor 1 to floor 8", () => {
    const from = floor1Rooms[0];
    const to = floor8Rooms[0];

    const path = findShortestPath(hallAsset, from.id, to.id);
    expect(path).not.toBeNull();
    expect(path!.totalDistance).toBeGreaterThan(0);
  });

  it("accessible path spans the correct floors", () => {
    const from = floor1Rooms[0];
    const to = floor8Rooms[0];

    const path = findShortestPath(hallAsset, from.id, to.id, {
      accessibleOnly: true,
    });

    expect(path).not.toBeNull();
    expect(path!.floors).toContain(1);
    expect(path!.floors).toContain(8);
  });

  it("finds accessible path between two floor 1 rooms", () => {
    if (floor1Rooms.length < 2) return;

    const from = floor1Rooms[0];
    const to = floor1Rooms[floor1Rooms.length - 1];

    const path = findShortestPath(hallAsset, from.id, to.id, {
      accessibleOnly: true,
    });

    expect(path).not.toBeNull();
    expect(path!.fullyAccessible).toBe(true);
    expect(path!.floors).toEqual([1]);
  });
});
