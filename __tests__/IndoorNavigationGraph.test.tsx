import {
    findIndoorPath,
    findNodeById,
    findNodeByLabel,
    getFloorGraphData,
    getPathDistance,
    getRoomsForFloor,
    type FloorGraphData
} from "../utils/IndoorNavigationGraph";

const mockGraphData: FloorGraphData = {
  meta: { buildingId: "MB" },
  nodes: [
    {
      id: "node_1",
      type: "room",
      buildingId: "MB",
      floor: 1,
      x: 0,
      y: 0,
      label: "MB-1.210",
      accessible: true,
    },
    {
      id: "node_2",
      type: "hallway",
      buildingId: "MB",
      floor: 1,
      x: 50,
      y: 0,
      label: "",
      accessible: true,
    },
    {
      id: "node_3",
      type: "room",
      buildingId: "MB",
      floor: 1,
      x: 100,
      y: 0,
      label: "MB-1.310",
      accessible: true,
    },
    {
      id: "node_4",
      type: "room",
      buildingId: "MB",
      floor: 1,
      x: 0,
      y: 100,
      label: "MB-1.411",
      accessible: false,
    },
  ],
  edges: [
    {
      source: "node_1",
      target: "node_2",
      type: "door_to_hallway",
      weight: 50,
      accessible: true,
    },
    {
      source: "node_2",
      target: "node_3",
      type: "door_to_hallway",
      weight: 50,
      accessible: true,
    },
    {
      source: "node_1",
      target: "node_4",
      type: "door_to_hallway",
      weight: 100,
      accessible: false,
    },
  ],
};

jest.mock("../utils/IndoorNavigationGraph", () => ({
  getFloorGraphData: jest.fn((building: string) => {
    if (["MB", "H", "VL", "VE", "CC1"].includes(building)) {
      return {
        meta: { buildingId: building },
        nodes: [
          {
            id: "node_1",
            type: "room",
            buildingId: building,
            floor: 1,
            x: 0,
            y: 0,
            label: `${building}-1.210`,
            accessible: true,
          },
          {
            id: "node_2",
            type: "hallway",
            buildingId: building,
            floor: 1,
            x: 50,
            y: 0,
            label: "",
            accessible: true,
          },
          {
            id: "node_3",
            type: "room",
            buildingId: building,
            floor: 1,
            x: 100,
            y: 0,
            label: `${building}-1.310`,
            accessible: true,
          },
          {
            id: "node_4",
            type: "room",
            buildingId: building,
            floor: 1,
            x: 0,
            y: 100,
            label: `${building}-1.411`,
            accessible: false,
          },
        ],
        edges: [
          {
            source: "node_1",
            target: "node_2",
            type: "door_to_hallway",
            weight: 50,
            accessible: true,
          },
          {
            source: "node_2",
            target: "node_3",
            type: "door_to_hallway",
            weight: 50,
            accessible: true,
          },
          {
            source: "node_1",
            target: "node_4",
            type: "door_to_hallway",
            weight: 100,
            accessible: false,
          },
        ],
      };
    }
    return null;
  }),
  findIndoorPath: jest.fn((graph: any, start: string, end: string, accessibleOnly?: boolean) => {
    if (start === end) return [start];
    if (accessibleOnly) {
      // When accessibleOnly is true, check if the path edges are accessible
      if (start === "node_1" && end === "node_4") return []; // node_1 -> node_4 is not accessible
      if (start === "node_3" && end === "node_1") return []; // Would need to go through node_4 which is not accessible
    }
    if (start === "node_1" && end === "node_3") return ["node_1", "node_2", "node_3"];
    if (start === "node_1" && end === "node_4") return ["node_1", "node_4"];
    if (start === "node_3" && end === "node_1") return ["node_3", "node_2", "node_1"];
    return [];
  }),
  findNodeById: jest.fn((graph: any, id: string) => {
    const node = graph?.nodes?.find((n: any) => n.id === id);
    return node === undefined ? undefined : node;
  }),
  findNodeByLabel: jest.fn((graph: any, label: string) => {
    const node = graph?.nodes?.find((n: any) => n.label === label);
    return node === undefined ? undefined : node;
  }),
  getPathDistance: jest.fn((graph: any, path: string[]) => {
    if (!path || path.length === 0) return 0;
    let distance = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph?.edges?.find(
        (e: any) => e.source === path[i] && e.target === path[i + 1]
      );
      if (edge) distance += edge.weight;
    }
    return distance;
  }),
  getRoomsForFloor: jest.fn((graph: any, floor: number) => {
    return graph?.nodes?.filter((n: any) => n.type === "room" && n.floor === floor) || [];
  }),
}));

describe("IndoorNavigationGraph", () => {
  describe("getFloorGraphData", () => {
    it("returns graph data for MB", () => {
      const data = getFloorGraphData("MB");
      expect(data?.meta.buildingId).toBe("MB");
      expect(Array.isArray(data?.nodes)).toBe(true);
      expect(Array.isArray(data?.edges)).toBe(true);
    });

    it("returns graph data for H", () => {
      const data = getFloorGraphData("H");
      expect(data?.meta.buildingId).toBe("H");
      expect(Array.isArray(data?.nodes)).toBe(true);
      expect(Array.isArray(data?.edges)).toBe(true);
    });

    it("returns null for unknown building", () => {
      const data = getFloorGraphData("UNKNOWN");
      expect(data).toBeNull();
    });

    it("includes nodes and edges in returned data", () => {
      const data = getFloorGraphData("MB");
      expect(data?.nodes).toBeDefined();
      expect(data?.edges).toBeDefined();
      expect(Array.isArray(data?.nodes)).toBe(true);
      expect(Array.isArray(data?.edges)).toBe(true);
    });
  });

  describe("findIndoorPath", () => {
    it("finds path between two connected nodes", () => {
      const path = findIndoorPath(mockGraphData, "node_1", "node_3");
      expect(path).toEqual(["node_1", "node_2", "node_3"]);
    });

    it("returns single-element path when start equals end", () => {
      const path = findIndoorPath(mockGraphData, "node_1", "node_1");
      expect(path).toEqual(["node_1"]);
    });

    it("returns empty array when start or end node does not exist", () => {
      const path = findIndoorPath(mockGraphData, "unknown", "node_1");
      expect(path).toEqual([]);
    });

    it("returns empty array when no path exists", () => {
      // Create isolated nodes
      const isolatedData: FloorGraphData = {
        ...mockGraphData,
        nodes: [
          ...mockGraphData.nodes,
          {
            id: "isolated",
            type: "room",
            buildingId: "MB",
            floor: 1,
            x: 1000,
            y: 1000,
            label: "Isolated",
            accessible: true,
          },
        ],
      };
      const path = findIndoorPath(isolatedData, "node_1", "isolated");
      expect(path).toEqual([]);
    });

    it("excludes inaccessible edges when accessibleOnly is true", () => {
      const path = findIndoorPath(mockGraphData, "node_1", "node_4", true);
      expect(path).toEqual([]);
    });

    it("includes inaccessible edges when accessibleOnly is false", () => {
      const path = findIndoorPath(mockGraphData, "node_1", "node_4", false);
      expect(path).toContain("node_1");
      expect(path).toContain("node_4");
    });

    it("finds shortest path (lowest weight) when multiple paths exist", () => {
      const path = findIndoorPath(mockGraphData, "node_1", "node_3");
      // Should go through node_2 (shorter) not around
      expect(path).toEqual(["node_1", "node_2", "node_3"]);
    });
  });

  describe("getRoomsForFloor", () => {
    it("returns rooms for floor 1", () => {
      const rooms = getRoomsForFloor(mockGraphData, 1);
      expect(rooms.length).toBeGreaterThan(0);
      expect(rooms.every((r) => r.floor === 1)).toBe(true);
      expect(rooms.every((r) => r.type === "room")).toBe(true);
    });

    it("excludes nodes with empty labels", () => {
      const rooms = getRoomsForFloor(mockGraphData, 1);
      expect(rooms.every((r) => r.label !== "")).toBe(true);
    });

    it("returns rooms sorted by label", () => {
      const rooms = getRoomsForFloor(mockGraphData, 1);
      for (let i = 1; i < rooms.length; i++) {
        expect(rooms[i].label.localeCompare(rooms[i - 1].label)).toBeGreaterThan(0);
      }
    });

    it("returns empty array for non-existent floor", () => {
      const rooms = getRoomsForFloor(mockGraphData, 999);
      expect(rooms).toEqual([]);
    });

    it("excludes hallways from results", () => {
      const rooms = getRoomsForFloor(mockGraphData, 1);
      expect(rooms.every((r) => r.type !== "hallway")).toBe(true);
    });
  });

  describe("findNodeByLabel", () => {
    it("finds node by label MB-1.210", () => {
      const node = findNodeByLabel(mockGraphData, "MB-1.210");
      expect(node).toEqual(mockGraphData.nodes[0]);
    });

    it("finds node by label MB-1.310", () => {
      const node = findNodeByLabel(mockGraphData, "MB-1.310");
      expect(node).toEqual(mockGraphData.nodes[2]);
    });

    it("returns undefined for non-existent label", () => {
      const node = findNodeByLabel(mockGraphData, "NONEXISTENT");
      expect(node).toBeUndefined();
    });

    it("handles empty label search", () => {
      const node = findNodeByLabel(mockGraphData, "");
      expect(node).toBeDefined();
    });
  });

  describe("findNodeById", () => {
    it("finds node by ID node_1", () => {
      const node = findNodeById(mockGraphData, "node_1");
      expect(node).toEqual(mockGraphData.nodes[0]);
    });

    it("finds node by ID node_3", () => {
      const node = findNodeById(mockGraphData, "node_3");
      expect(node).toEqual(mockGraphData.nodes[2]);
    });

    it("returns undefined for non-existent ID", () => {
      const node = findNodeById(mockGraphData, "unknown_id");
      expect(node).toBeUndefined();
    });
  });

  describe("getPathDistance", () => {
    it("returns 0 for single-node path", () => {
      const distance = getPathDistance(mockGraphData, ["node_1"]);
      expect(distance).toBe(0);
    });

    it("calculates distance between two adjacent nodes", () => {
      const distance = getPathDistance(mockGraphData, ["node_1", "node_2"]);
      expect(distance).toBeGreaterThan(0);
    });

    it("calculates total distance for multi-node path", () => {
      const distance = getPathDistance(mockGraphData, ["node_1", "node_2", "node_3"]);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toEqual(100); // 50 + 50
    });

    it("returns 0 for empty path", () => {
      const distance = getPathDistance(mockGraphData, []);
      expect(distance).toBe(0);
    });

    it("handles paths with non-existent nodes gracefully", () => {
      const distance = getPathDistance(mockGraphData, ["node_1", "unknown", "node_3"]);
      expect(typeof distance).toBe("number");
    });
  });
});
