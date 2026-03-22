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
        { id: "A", type: "room", buildingId: "H", floor: 1, x: 0, y: 0, label: "H-101", accessible: true },
        { id: "B", type: "hallway", buildingId: "H", floor: 1, x: 1, y: 0, label: "Hall", accessible: true },
      ],
      edges: [{ source: "A", target: "B", type: "walk", weight: 1, accessible: false }],
    };

    expect(findShortestPath(blockedAsset, "A", "B", { accessibleOnly: true })).toBeNull();
  });

  it("resolves routing id by direct match, nearest-floor match, and null", () => {
    expect(resolveRoutingNodeId(multiPathAsset, "D", 99, 99, 1)).toBe("D");
    expect(resolveRoutingNodeId(multiPathAsset, "missing", 2.2, 0.1, 1)).toBe("C");
    expect(resolveRoutingNodeId(multiPathAsset, "missing", 10, 10, 9)).toBeNull();
  });
});