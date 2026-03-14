import { buildIndoorPathData, findShortestIndoorPath, getPathDistance } from "../utils/indoorNavigation";

type MockNode = {
  getName: () => string;
  getType: () => string;
  getCoordinates: () => number[][];
  getCentroid: () => number[];
};

function createMockNode(
  name: string,
  type: string,
  coordinates: number[][],
  centroid: number[]
): MockNode {
  return {
    getName: () => name,
    getType: () => type,
    getCoordinates: () => coordinates,
    getCentroid: () => centroid,
  };
}

function createMockFloor(children: MockNode[]) {
  return {
    getChildren: () => children,
  } as any;
}

describe("indoorNavigation", () => {
  it("avoids blocked connector and picks another hallway node", () => {
    const room = createMockNode(
      "1.210",
      "room",
      [
        [1090, 990],
        [1130, 990],
        [1130, 1030],
        [1090, 1030],
      ],
      [1110, 1010]
    );

    const blockingWall = createMockNode(
      "between-room-and-west-mid",
      "block",
      [
        [1030, 920],
        [1088, 920],
        [1088, 1020],
        [1030, 1020],
      ],
      [1060, 970]
    );

    const floor = createMockFloor([room, blockingWall]);
    const pathData = buildIndoorPathData(floor, "MB", 1);

    const roomNode = pathData.graph.nodes["room-1.210"];
    expect(roomNode).toBeDefined();
    const roomNeighbors = roomNode!.neighbors.map((neighbor) => neighbor.id);
    expect(roomNeighbors).not.toContain("hall-west-mid");
  });

  it("does not expose a room as selectable when only blocked connectors exist", () => {
    const isolatedRoom = createMockNode(
      "1.999",
      "room",
      [
        [1360, 1360],
        [1400, 1360],
        [1400, 1400],
        [1360, 1400],
      ],
      [1380, 1380]
    );

    const surroundingBlock = createMockNode(
      "sealed-wall",
      "block",
      [
        [1300, 1300],
        [1500, 1300],
        [1500, 1500],
        [1300, 1500],
      ],
      [1400, 1400]
    );

    const floor = createMockFloor([isolatedRoom, surroundingBlock]);
    const pathData = buildIndoorPathData(floor, "MB", 1);

    expect(pathData.selectableByName["1.999"]).toBeUndefined();
    expect(pathData.graph.nodes["room-1.999"]).toBeUndefined();
  });

  it("finds path distance only over connected nodes", () => {
    const graph = {
      nodes: {
        a: { id: "a", x: 0, y: 0, neighbors: [{ id: "b", weight: 10 }] },
        b: { id: "b", x: 10, y: 0, neighbors: [{ id: "a", weight: 10 }, { id: "c", weight: 10 }] },
        c: { id: "c", x: 20, y: 0, neighbors: [{ id: "b", weight: 10 }] },
      },
    };

    const path = findShortestIndoorPath(graph, "a", "c");

    expect(path).toEqual(["a", "b", "c"]);
    expect(getPathDistance(graph, path)).toBe(20);
  });
});
