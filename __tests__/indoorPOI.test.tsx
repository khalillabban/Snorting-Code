jest.mock("../utils/mapAssets", () => ({
  getBuildingPlanAsset: jest.fn(),
  normalizeIndoorBuildingCode: jest.fn((code: string) =>
    (code ?? "").trim().toUpperCase() === "HALL" ? "H" : (code ?? "").trim().toUpperCase(),
  ),
}));

import type { POICategoryId } from "../constants/indoorPOI";
import {
    filterPOIsByCategories,
    filterPOIsByFloor,
    getIndoorPOIs,
    type IndoorPOI,
} from "../utils/indoorPOI";
import { getBuildingPlanAsset } from "../utils/mapAssets";

const mockBuildingPlanAsset = {
  meta: { buildingId: "H" },
  nodes: [
    { id: "stair1", type: "stair_landing", buildingId: "H", floor: 1, x: 100, y: 200, label: "", accessible: false },
    { id: "stair2", type: "stair_landing", buildingId: "H", floor: 2, x: 150, y: 250, label: "", accessible: false },
    { id: "elev1", type: "elevator_door", buildingId: "H", floor: 1, x: 300, y: 400, label: "H-elevator1", accessible: true },
    { id: "entry1", type: "building_entry_exit", buildingId: "H", floor: 1, x: 500, y: 600, label: "", accessible: true },
    { id: "room1", type: "room", buildingId: "H", floor: 1, x: 700, y: 800, label: "H-110", accessible: true },
    { id: "hw1", type: "hallway_waypoint", buildingId: "H", floor: 1, x: 900, y: 100, label: "", accessible: true },
    { id: "door1", type: "doorway", buildingId: "H", floor: 1, x: 200, y: 300, label: "", accessible: true },
  ],
  edges: [],
};

describe("getIndoorPOIs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("extracts structural POIs from building plan nodes", () => {
    (getBuildingPlanAsset as jest.Mock).mockReturnValue(mockBuildingPlanAsset);

    const pois = getIndoorPOIs("H");

    // Should include stair_landing, elevator_door, building_entry_exit
    const structuralPois = pois.filter((p) => !p.id.includes("manual"));
    expect(structuralPois).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "stair1", category: "stairs", floor: 1 }),
        expect.objectContaining({ id: "stair2", category: "stairs", floor: 2 }),
        expect.objectContaining({ id: "elev1", category: "elevator", floor: 1, label: "H-elevator1" }),
        expect.objectContaining({ id: "entry1", category: "entrance", floor: 1 }),
      ]),
    );
    // Should NOT include room, hallway_waypoint, or doorway
    expect(structuralPois.find((p) => p.id === "room1")).toBeUndefined();
    expect(structuralPois.find((p) => p.id === "hw1")).toBeUndefined();
    expect(structuralPois.find((p) => p.id === "door1")).toBeUndefined();
  });

  it("includes manual POIs for known buildings", () => {
    (getBuildingPlanAsset as jest.Mock).mockReturnValue(mockBuildingPlanAsset);

    const pois = getIndoorPOIs("H");
    const manualPois = pois.filter((p) => p.id.includes("manual"));

    expect(manualPois.length).toBeGreaterThan(0);
    expect(manualPois.some((p) => p.category === "washroom")).toBe(true);
    expect(manualPois.some((p) => p.category === "water_fountain")).toBe(true);
  });

  it("returns only manual POIs when no building plan is found", () => {
    (getBuildingPlanAsset as jest.Mock).mockReturnValue(undefined);

    const pois = getIndoorPOIs("CC");
    // CC has manual entries but no structural nodes returned since mock returns undefined
    const manualPois = pois.filter((p) => p.id.includes("manual"));
    expect(manualPois.length).toBeGreaterThan(0);
  });

  it("returns empty array for unknown building", () => {
    (getBuildingPlanAsset as jest.Mock).mockReturnValue(undefined);

    const pois = getIndoorPOIs("UNKNOWN");
    expect(pois).toEqual([]);
  });

  it("normalises HALL to H", () => {
    (getBuildingPlanAsset as jest.Mock).mockReturnValue(mockBuildingPlanAsset);

    const pois = getIndoorPOIs("HALL");
    const structuralPois = pois.filter((p) => !p.id.includes("manual"));
    expect(structuralPois.length).toBeGreaterThan(0);
  });
});

describe("filterPOIsByFloor", () => {
  const pois: IndoorPOI[] = [
    { id: "a", category: "stairs", buildingCode: "H", floor: 1, x: 0, y: 0 },
    { id: "b", category: "elevator", buildingCode: "H", floor: 2, x: 0, y: 0 },
    { id: "c", category: "washroom", buildingCode: "H", floor: 1, x: 0, y: 0 },
  ];

  it("returns only POIs on the requested floor", () => {
    const result = filterPOIsByFloor(pois, 1);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.floor === 1)).toBe(true);
  });

  it("returns empty when no POIs match the floor", () => {
    expect(filterPOIsByFloor(pois, 99)).toHaveLength(0);
  });
});

describe("filterPOIsByCategories", () => {
  const pois: IndoorPOI[] = [
    { id: "a", category: "stairs", buildingCode: "H", floor: 1, x: 0, y: 0 },
    { id: "b", category: "elevator", buildingCode: "H", floor: 1, x: 0, y: 0 },
    { id: "c", category: "washroom", buildingCode: "H", floor: 1, x: 0, y: 0 },
    { id: "d", category: "water_fountain", buildingCode: "H", floor: 1, x: 0, y: 0 },
  ];

  it("returns only POIs whose category is in the active set", () => {
    const active = new Set<POICategoryId>(["stairs", "washroom"]);
    const result = filterPOIsByCategories(pois, active);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.category)).toEqual(["stairs", "washroom"]);
  });

  it("returns empty when active set is empty", () => {
    const result = filterPOIsByCategories(pois, new Set());
    expect(result).toHaveLength(0);
  });

  it("returns all when every category is active", () => {
    const active = new Set<POICategoryId>(["stairs", "elevator", "washroom", "water_fountain"]);
    const result = filterPOIsByCategories(pois, active);
    expect(result).toHaveLength(4);
  });
});
