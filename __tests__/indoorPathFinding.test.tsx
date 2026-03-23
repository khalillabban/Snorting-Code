import {
  findShortestPath,
  resolveRoutingNodeId,
} from "../utils/indoorPathFinding";
import type { BuildingPlanAsset } from "../utils/mapAssets";

const multiPathAsset: BuildingPlanAsset = {
  meta: { buildingId: "H" },
  nodes: [
    { id: "A", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
    { id: "B", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 0, label: "Hall 1", accessible: true },
    { id: "C", type: "hallway", buildingId: "H", floor: 1, x: 2, y: 0, label: "Hall 2", accessible: true },
    { id: "D", type: "room", buildingId: "H", floor: 1, x: 3, y: 0, label: "H-102", accessible: true },
  ],
  edges: [
    { source: "A", target: "B", type: "walk", weight: 1, accessible: true },
    { source: "B", target: "C", type: "walk", weight: 1, accessible: false },
    { source: "C", target: "D", type: "walk", weight: 1, accessible: true },
    { source: "B", target: "D", type: "walk", weight: 5, accessible: true },
  ],
};

const multiFloorAsset: BuildingPlanAsset = {
  meta: { buildingId: "H" },
  nodes: [
    { id: "room1",    type: "room",          buildingId: "H", floor: 1, x: 0,  y: 0, label: "H-101", accessible: true },
    { id: "hall1",    type: "hallway",        buildingId: "H", floor: 1, x: 5,  y: 0, label: "Hall F1", accessible: true },
    { id: "stair1",   type: "stair_landing",  buildingId: "H", floor: 1, x: 10, y: 0, label: "Stair F1", accessible: false },
    { id: "elev1",    type: "elevator_door",  buildingId: "H", floor: 1, x: 15, y: 0, label: "Elev F1", accessible: true },
    { id: "stair2",   type: "stair_landing",  buildingId: "H", floor: 2, x: 10, y: 0, label: "Stair F2", accessible: false },
    { id: "elev2",    type: "elevator_door",  buildingId: "H", floor: 2, x: 15, y: 0, label: "Elev F2", accessible: true },
    { id: "hall2",    type: "hallway",        buildingId: "H", floor: 2, x: 5,  y: 0, label: "Hall F2", accessible: true },
    { id: "room2",    type: "room",           buildingId: "H", floor: 2, x: 0,  y: 0, label: "H-201", accessible: true },
  ],
  edges: [
    // Floor 1 hallway connections
    { source: "room1",  target: "hall1",  type: "hallway",  weight: 5,  accessible: true },
    { source: "hall1",  target: "stair1", type: "hallway",  weight: 5,  accessible: true },
    { source: "hall1",  target: "elev1",  type: "hallway",  weight: 5,  accessible: true },
    // Floor 2 hallway connections
    { source: "stair2", target: "hall2",  type: "hallway",  weight: 5,  accessible: true },
    { source: "elev2",  target: "hall2",  type: "hallway",  weight: 5,  accessible: true },
    { source: "hall2",  target: "room2",  type: "hallway",  weight: 5,  accessible: true },
    // Vertical connections
    { source: "stair1", target: "stair2", type: "stairs",   weight: 0,  accessible: false },
    { source: "elev1",  target: "elev2",  type: "elevator", weight: 0,  accessible: true },
  ],
};

describe("utils/indoorPathFinding", () => {
  it("returns null when graph edges are missing", () => {
    const result = findShortestPath(
      { meta: { buildingId: "H" }, nodes: [], edges: [] },
      "A",
      "B",
    );
    expect(result).toBeNull();
  });

  it("returns null when origin or destination node is absent", () => {
    expect(findShortestPath(multiPathAsset, "Z", "D")).toBeNull();
    expect(findShortestPath(multiPathAsset, "A", "Z")).toBeNull();
  });

  it("finds shortest path and marks non-accessible edge usage", () => {
    const path = findShortestPath(multiPathAsset, "A", "D");
    expect(path).not.toBeNull();
    expect(path?.steps.map((step) => step.node.id)).toEqual(["A", "B", "C", "D"]);
    expect(path?.steps.map((step) => step.cumulativeDistance)).toEqual([0, 1, 2, 3]);
    expect(path?.totalDistance).toBe(3);
    expect(path?.fullyAccessible).toBe(false);
    expect(path?.floors).toEqual([1]);
  });

  it("takes the accessible detour when accessibleOnly=true and shortest path has inaccessible edge", () => {
    const path = findShortestPath(multiPathAsset, "A", "D", { accessibleOnly: true });
    expect(path).not.toBeNull();
    // B->C is hard-blocked (inaccessible edge), so must go A->B->D (weight 6)
    expect(path?.steps.map((s) => s.node.id)).toEqual(["A", "B", "D"]);
    expect(path?.totalDistance).toBe(6);
    expect(path?.fullyAccessible).toBe(true);
  });

  it("honors accessibleOnly and falls back to accessible detour", () => {
    const path = findShortestPath(multiPathAsset, "A", "D", { accessibleOnly: true });
    expect(path).not.toBeNull();
    expect(path?.steps.map((step) => step.node.id)).toEqual(["A", "B", "D"]);
    expect(path?.totalDistance).toBe(6);
    expect(path?.fullyAccessible).toBe(true);
  });

  it("returns null when no accessible path exists", () => {
    const blockedAsset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "A", type: "room",    buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "B", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 0, label: "Hall",  accessible: true },
      ],
      edges: [{ source: "A", target: "B", type: "walk", weight: 1, accessible: false }],
    };
    expect(findShortestPath(blockedAsset, "A", "B", { accessibleOnly: true })).toBeNull();
  });

  it("returns a path with correct floor set", () => {
    const path = findShortestPath(multiPathAsset, "A", "D");
    expect(path?.floors).toEqual([1]);
  });

  it("resolves routing id by direct match, nearest-floor match, and null", () => {
    expect(resolveRoutingNodeId(multiPathAsset, "D", 99, 99, 1)).toBe("D");
    expect(resolveRoutingNodeId(multiPathAsset, "missing", 2.2, 0.1, 1)).toBe("C");
    expect(resolveRoutingNodeId(multiPathAsset, "missing", 10, 10, 9)).toBeNull();
  });

it("uses stairs (not elevator) on standard route between floors", () => {
    const path = findShortestPath(multiFloorAsset, "room1", "room2");
    expect(path).not.toBeNull();
    // Standard route: elevator edges hard-blocked → must use stairs
    const ids = path!.steps.map((s) => s.node.id);
    expect(ids).toContain("stair1");
    expect(ids).toContain("stair2");
    expect(ids).not.toContain("elev1");
    expect(ids).not.toContain("elev2");
    expect(path?.floors).toEqual([1, 2]);
  });
 
  it("uses elevator (not stairs) on accessible route between floors", () => {
    const path = findShortestPath(multiFloorAsset, "room1", "room2", { accessibleOnly: true });
    expect(path).not.toBeNull();
    // Accessible route: stair edges hard-blocked → must use elevator
    const ids = path!.steps.map((s) => s.node.id);
    expect(ids).toContain("elev1");
    expect(ids).toContain("elev2");
    expect(ids).not.toContain("stair1");
    expect(ids).not.toContain("stair2");
    expect(path?.floors).toEqual([1, 2]);
    expect(path?.fullyAccessible).toBe(true);
  });
 
  it("returns null for accessible route when no elevator exists", () => {
    const stairsOnlyAsset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "room1",  type: "room",         buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "stair1", type: "stair_landing", buildingId: "H", floor: 1, x: 5, y: 0, label: "Stair F1", accessible: false },
        { id: "stair2", type: "stair_landing", buildingId: "H", floor: 2, x: 5, y: 0, label: "Stair F2", accessible: false },
        { id: "room2",  type: "room",          buildingId: "H", floor: 2, x: 0, y: 0, label: "H-201", accessible: true },
      ],
      edges: [
        { source: "room1",  target: "stair1", type: "hallway", weight: 5, accessible: true },
        { source: "stair1", target: "stair2", type: "stairs",  weight: 0, accessible: false },
        { source: "stair2", target: "room2",  type: "hallway", weight: 5, accessible: true },
      ],
    };
    expect(findShortestPath(stairsOnlyAsset, "room1", "room2", { accessibleOnly: true })).toBeNull();
  });
 
  it("does not detour through a third floor when direct elevator edge exists", () => {
    // Reproduces the F8->F9 bug: ensure direct edge is used, not F8->F2->F9
    const threeFloorAsset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "room8",  type: "room",         buildingId: "H", floor: 8, x: 0, y: 0, label: "H-801", accessible: true },
        { id: "hall8",  type: "hallway",       buildingId: "H", floor: 8, x: 5, y: 0, label: "Hall F8", accessible: true },
        { id: "elev8",  type: "elevator_door", buildingId: "H", floor: 8, x: 10, y: 0, label: "Elev F8", accessible: true },
        { id: "elev2",  type: "elevator_door", buildingId: "H", floor: 2, x: 10, y: 0, label: "Elev F2", accessible: true },
        { id: "hall2",  type: "hallway",       buildingId: "H", floor: 2, x: 5, y: 0, label: "Hall F2", accessible: true },
        { id: "elev9",  type: "elevator_door", buildingId: "H", floor: 9, x: 10, y: 0, label: "Elev F9", accessible: true },
        { id: "hall9",  type: "hallway",       buildingId: "H", floor: 9, x: 5, y: 0, label: "Hall F9", accessible: true },
        { id: "room9",  type: "room",          buildingId: "H", floor: 9, x: 0, y: 0, label: "H-901", accessible: true },
      ],
      edges: [
        { source: "room8", target: "hall8", type: "hallway",  weight: 5, accessible: true },
        { source: "hall8", target: "elev8", type: "hallway",  weight: 5, accessible: true },
        // elev8 <-> elev2 (indirect hub)
        { source: "elev8", target: "elev2", type: "elevator", weight: 0, accessible: true },
        { source: "elev2", target: "hall2", type: "hallway",  weight: 5, accessible: true },
        // elev2 <-> elev9
        { source: "elev2", target: "elev9", type: "elevator", weight: 0, accessible: true },
        // direct elev8 <-> elev9
        { source: "elev8", target: "elev9", type: "elevator", weight: 0, accessible: true },
        { source: "elev9", target: "hall9", type: "hallway",  weight: 5, accessible: true },
        { source: "hall9", target: "room9", type: "hallway",  weight: 5, accessible: true },
      ],
    };
 
    const path = findShortestPath(threeFloorAsset, "room8", "room9", { accessibleOnly: true });
    expect(path).not.toBeNull();
    const ids = path!.steps.map((s) => s.node.id);
    // Should go directly F8->F9, NOT through F2
    expect(ids).not.toContain("elev2");
    expect(ids).not.toContain("hall2");
    expect(ids).toContain("elev8");
    expect(ids).toContain("elev9");
    expect(path?.floors).toEqual([8, 9]);
  });
 
  // ── findShortestPath: path metadata ─────────────────────────────────────────
 
  it("marks fullyAccessible=true when all edges and nodes are accessible", () => {
    const allAccessibleAsset: BuildingPlanAsset = {
      meta: { buildingId: "H" },
      nodes: [
        { id: "A", type: "room",    buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "B", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 0, label: "Hall",  accessible: true },
      ],
      edges: [{ source: "A", target: "B", type: "walk", weight: 1, accessible: true }],
    };
    const path = findShortestPath(allAccessibleAsset, "A", "B");
    expect(path?.fullyAccessible).toBe(true);
  });
 
  it("marks fullyAccessible=false when a stair node is in the path", () => {
    const path = findShortestPath(multiFloorAsset, "room1", "room2");
    // Standard route uses stairs which are inaccessible nodes
    expect(path?.fullyAccessible).toBe(false);
  });
 
  // ── resolveRoutingNodeId ─────────────────────────────────────────────────────
 
  it("resolves by direct ID match on the correct floor", () => {
    expect(resolveRoutingNodeId(multiPathAsset, "D", 99, 99, 1)).toBe("D");
  });
 
  it("falls back to nearest node on the same floor when ID is not found", () => {
    // Point (2.2, 0.1) is closest to C (x=2, y=0)
    expect(resolveRoutingNodeId(multiPathAsset, "missing", 2.2, 0.1, 1)).toBe("C");
  });
 
  it("returns null when no nodes exist on the requested floor", () => {
    expect(resolveRoutingNodeId(multiPathAsset, "missing", 10, 10, 9)).toBeNull();
  });
 
  it("does not match a node whose ID matches but is on a different floor", () => {
    // "D" exists on floor 1, requesting floor 2 — should fall back to nearest on floor 2
    // multiPathAsset has no floor-2 nodes so returns null
    expect(resolveRoutingNodeId(multiPathAsset, "D", 3, 0, 2)).toBeNull();
  });
});