/**
 * Tests for utils/buildingSearch.ts — the shared search index
 * extracted from NavigationBar and reused in NextClassDirectionsPanel.
 */
import {
    campusBuildingResults,
    getSearchIndex,
    queryIndex,
    resultLabel,
    resultSubtitle,
    SearchResult,
} from "../utils/buildingSearch";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    {
      name: "H",
      campusName: "sgw",
      displayName: "Henry F. Hall Building (H)",
      address: "1455 Blvd. De Maisonneuve Ouest",
      coordinates: { latitude: 45.4972, longitude: -73.5789 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
    {
      name: "MB",
      campusName: "sgw",
      displayName: "John Molson Building (MB)",
      address: "1450 Guy St",
      coordinates: { latitude: 45.4953, longitude: -73.5790 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
    {
      name: "SP",
      campusName: "loyola",
      displayName: "Richard J Renaud Science Complex (SP)",
      address: "7141 Sherbrooke St W",
      coordinates: { latitude: 45.4576, longitude: -73.6413 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
    {
      name: "NB",
      campusName: "sgw",
      displayName: "No Bounding Building (NB)",
      address: "N/A",
      coordinates: { latitude: 0, longitude: 0 },
      // no boundingBox → should be excluded from campusBuildingResults
    },
  ],
}));

jest.mock("../utils/mapAssets", () => ({
  normalizeIndoorBuildingCode: (code: string) => code.toUpperCase(),
  getAvailableFloors: (code: string) => (code === "H" ? [1, 8, 9] : []),
  hasBuildingPlanAsset: (code: string) => code === "H",
}));

jest.mock("../utils/indoorBuildingPlan", () => ({
  compactIndoorSearchKey: (value: string) =>
    value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""),
  getNormalizedBuildingPlan: (code: string) => {
    if (code !== "H") return null;
    return {
      buildingCode: "H",
      floors: [1, 8, 9],
      rooms: [
        {
          id: "H-920",
          buildingCode: "H",
          floor: 9,
          label: "H-920",
          roomNumber: "920",
          roomName: "Lecture Hall",
          aliases: [],
          x: 100,
          y: 200,
          accessible: true,
          searchTerms: ["H-920", "920", "Lecture Hall"],
          searchKeys: ["H920", "920", "LECTUREHALL"],
        },
        {
          id: "H-861",
          buildingCode: "H",
          floor: 8,
          label: "H-861",
          roomNumber: "861",
          roomName: "",
          aliases: [],
          x: 50,
          y: 50,
          accessible: true,
          searchTerms: ["H-861", "861"],
          searchKeys: ["H861", "861"],
        },
      ],
      roomsByFloor: {},
    };
  },
}));

// ---------------------------------------------------------------------------
// resultLabel
// ---------------------------------------------------------------------------

describe("resultLabel", () => {
  it("returns displayName for building results", () => {
    const result: SearchResult = {
      kind: "building",
      building: {
        name: "H",
        displayName: "Henry F. Hall Building (H)",
        campusName: "sgw",
        address: "",
        coordinates: { latitude: 0, longitude: 0 },
        boundingBox: [],
      },
    };
    expect(resultLabel(result)).toBe("Henry F. Hall Building (H)");
  });

  it("returns label with room name for room results that have roomName", () => {
    const result: SearchResult = {
      kind: "room",
      building: {
        name: "H",
        displayName: "Hall",
        campusName: "sgw",
        address: "",
        coordinates: { latitude: 0, longitude: 0 },
        boundingBox: [],
      },
      room: {
        id: "H-920",
        buildingCode: "H",
        floor: 9,
        label: "H-920",
        roomNumber: "920",
        roomName: "Lecture Hall",
        aliases: [],
        x: 100,
        y: 200,
        accessible: true,
        searchTerms: [],
        searchKeys: [],
      },
    };
    expect(resultLabel(result)).toBe("H-920 — Lecture Hall");
  });

  it("returns just label for room results without roomName", () => {
    const result: SearchResult = {
      kind: "room",
      building: {
        name: "H",
        displayName: "Hall",
        campusName: "sgw",
        address: "",
        coordinates: { latitude: 0, longitude: 0 },
        boundingBox: [],
      },
      room: {
        id: "H-861",
        buildingCode: "H",
        floor: 8,
        label: "H-861",
        roomNumber: "861",
        roomName: "",
        aliases: [],
        x: 50,
        y: 50,
        accessible: true,
        searchTerms: [],
        searchKeys: [],
      },
    };
    expect(resultLabel(result)).toBe("H-861");
  });
});

// ---------------------------------------------------------------------------
// resultSubtitle
// ---------------------------------------------------------------------------

describe("resultSubtitle", () => {
  it("returns campusName for building results", () => {
    const result: SearchResult = {
      kind: "building",
      building: {
        name: "H",
        displayName: "Hall",
        campusName: "sgw",
        address: "",
        coordinates: { latitude: 0, longitude: 0 },
        boundingBox: [],
      },
    };
    expect(resultSubtitle(result)).toBe("sgw");
  });

  it("returns building name and floor for room results", () => {
    const result: SearchResult = {
      kind: "room",
      building: {
        name: "H",
        displayName: "Hall",
        campusName: "sgw",
        address: "",
        coordinates: { latitude: 0, longitude: 0 },
        boundingBox: [],
      },
      room: {
        id: "H-920",
        buildingCode: "H",
        floor: 9,
        label: "H-920",
        roomNumber: "920",
        roomName: "",
        aliases: [],
        x: 0,
        y: 0,
        accessible: true,
        searchTerms: [],
        searchKeys: [],
      },
    };
    expect(resultSubtitle(result)).toBe("Hall · Floor 9");
  });
});

// ---------------------------------------------------------------------------
// getSearchIndex
// ---------------------------------------------------------------------------

describe("getSearchIndex", () => {
  it("returns building and room entries", () => {
    const index = getSearchIndex();
    const buildings = index.filter((r) => r.kind === "building");
    const rooms = index.filter((r) => r.kind === "room");

    // Should include all 4 mock buildings
    expect(buildings.length).toBe(4);
    // Only H has rooms (2 mocked rooms)
    expect(rooms.length).toBe(2);
  });

  it("caches the index across calls", () => {
    const first = getSearchIndex();
    const second = getSearchIndex();
    expect(first).toBe(second); // Same reference
  });
});

// ---------------------------------------------------------------------------
// queryIndex
// ---------------------------------------------------------------------------

describe("queryIndex", () => {
  it("returns empty array for empty query", () => {
    expect(queryIndex("")).toEqual([]);
    expect(queryIndex("   ")).toEqual([]);
  });

  it("finds buildings by display name", () => {
    const results = queryIndex("Hall");
    const buildingResults = results.filter((r) => r.kind === "building");
    expect(buildingResults.length).toBeGreaterThanOrEqual(1);
    expect(buildingResults[0].building.name).toBe("H");
  });

  it("finds buildings by building code", () => {
    const results = queryIndex("MB");
    expect(results.some((r) => r.building.name === "MB")).toBe(true);
  });

  it("finds rooms by room number", () => {
    const results = queryIndex("920");
    const rooms = results.filter((r) => r.kind === "room");
    expect(rooms.length).toBeGreaterThanOrEqual(1);
  });

  it("finds rooms by label", () => {
    const results = queryIndex("H-861");
    const rooms = results.filter((r) => r.kind === "room");
    expect(rooms.length).toBeGreaterThanOrEqual(1);
  });

  it("is case-insensitive", () => {
    const upper = queryIndex("HALL");
    const lower = queryIndex("hall");
    expect(upper.length).toBe(lower.length);
    expect(upper.length).toBeGreaterThan(0);
  });

  it("returns at most MAX_SUGGESTIONS (20) results", () => {
    // "H" matches building H and all rooms with H in their label
    const results = queryIndex("H");
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("returns no results for unrecognized query", () => {
    const results = queryIndex("ZZZZZZ");
    expect(results).toEqual([]);
  });

  it("finds rooms by compact query without punctuation (e.g., H920 matches H-920)", () => {
    const results = queryIndex("H920");
    const rooms = results.filter((r) => r.kind === "room");
    expect(rooms.length).toBeGreaterThanOrEqual(1);
    expect(rooms.some((r) => r.room.label === "H-920")).toBe(true);
  });

  it("finds rooms by compact query with mixed case (e.g., h861 matches H-861)", () => {
    const results = queryIndex("h861");
    const rooms = results.filter((r) => r.kind === "room");
    expect(rooms.length).toBeGreaterThanOrEqual(1);
    expect(rooms.some((r) => r.room.label === "H-861")).toBe(true);
  });

  it("finds rooms using searchKeys for partial compact matches", () => {
    const results = queryIndex("92");
    const rooms = results.filter((r) => r.kind === "room");
    expect(rooms.some((r) => r.room.label === "H-920")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// campusBuildingResults
// ---------------------------------------------------------------------------

describe("campusBuildingResults", () => {
  it("returns only buildings for the given campus that have a bounding box", () => {
    const sgw = campusBuildingResults("sgw");
    // H and MB are sgw with bounding boxes; NB is sgw without bounding box
    expect(sgw.length).toBe(2);
    expect(sgw.every((r) => r.kind === "building")).toBe(true);
    expect(sgw.map((r) => r.building.name).sort()).toEqual(["H", "MB"]);
  });

  it("returns loyola buildings", () => {
    const loy = campusBuildingResults("loyola");
    expect(loy.length).toBe(1);
    expect(loy[0].building.name).toBe("SP");
  });

  it("returns empty for unknown campus", () => {
    expect(campusBuildingResults("mars")).toEqual([]);
  });

  it("excludes buildings without sufficient bounding box points", () => {
    // NB has no boundingBox at all
    const sgw = campusBuildingResults("sgw");
    expect(sgw.some((r) => r.building.name === "NB")).toBe(false);
  });

  it("ignores buildings whose campusName is missing", () => {
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock("../constants/buildings", () => ({
        BUILDINGS: [
          {
            name: "X",
            displayName: "Unknown Campus Building",
            campusName: undefined,
            address: "",
            coordinates: { latitude: 0, longitude: 0 },
            boundingBox: [
              { latitude: 0, longitude: 0 },
              { latitude: 0, longitude: 1 },
              { latitude: 1, longitude: 1 },
            ],
          },
        ],
      }));

      const mod = require("../utils/buildingSearch");
      expect(mod.campusBuildingResults("sgw")).toEqual([]);
    });
  });
});

describe("buildSearchIndex defensive branches", () => {
  it("keeps only building entries when searchable rooms exist but normalized plan is null", () => {
    jest.resetModules();
    jest.isolateModules(() => {
      jest.doMock("../constants/buildings", () => ({
        BUILDINGS: [
          {
            name: "H",
            campusName: "sgw",
            displayName: "Henry F. Hall Building (H)",
            address: "",
            coordinates: { latitude: 0, longitude: 0 },
            boundingBox: [
              { latitude: 0, longitude: 0 },
              { latitude: 0, longitude: 1 },
              { latitude: 1, longitude: 1 },
            ],
          },
        ],
      }));
      jest.doMock("../utils/indoorAccess", () => ({
        getIndoorAccessState: () => ({ hasSearchableRooms: true }),
      }));
      jest.doMock("../utils/indoorBuildingPlan", () => ({
        getNormalizedBuildingPlan: () => null,
      }));

      const mod = require("../utils/buildingSearch");
      const index = mod.getSearchIndex();
      expect(index).toHaveLength(1);
      expect(index[0].kind).toBe("building");
    });
  });
});
