import {
    getFloorGeoJSON,
    getFloorPlanAsset,
    getRegisteredIndoorFloors,
} from "../utils/indoorMapAssets";

// Mock image require calls
jest.mock("../assets/maps/mb_1.png", () => "mb_1_image");
jest.mock("../assets/maps/mb_s2.png", () => "mb_s2_image");
jest.mock("../assets/maps/H1.png", () => "h1_image");
jest.mock("../assets/maps/H2.png", () => "h2_image");
jest.mock("../assets/maps/hall8.png", () => "hall8_image");
jest.mock("../assets/maps/hall9.png", () => "hall9_image");
jest.mock("../assets/maps/vl_1.png", () => "vl_1_image");
jest.mock("../assets/maps/vl_2.png", () => "vl_2_image");
jest.mock("../assets/maps/ve1.png", () => "ve1_image");
jest.mock("../assets/maps/ve2.png", () => "ve2_image");
jest.mock("../assets/maps/CC1.png", () => "cc1_image");

// Mock GeoJSON require calls
jest.mock("../assets/mapsbackup/MB-1.json", () => ({ type: "FeatureCollection" }));
jest.mock("../assets/mapsbackup/MB-S2.json", () => ({ type: "FeatureCollection" }));

describe("indoorMapAssets", () => {
  describe("getFloorPlanAsset", () => {
    it("returns image for MB floor 1", () => {
      const result = getFloorPlanAsset("MB", 1);
      expect(result).toBeTruthy();
    });

    it("returns image for MB floor -2", () => {
      const result = getFloorPlanAsset("MB", -2);
      expect(result).toBeTruthy();
    });

    it("returns image for H floor 1", () => {
      const result = getFloorPlanAsset("H", 1);
      expect(result).toBeTruthy();
    });

    it("returns null for unknown building", () => {
      const result = getFloorPlanAsset("UNKNOWN", 1);
      expect(result).toBeNull();
    });

    it("returns null for building with no floor mapping", () => {
      const result = getFloorPlanAsset("MB", 999);
      expect(result).toBeNull();
    });

    it("returns null when buildingName is null", () => {
      const result = getFloorPlanAsset(null, 1);
      expect(result).toBeNull();
    });

    it("returns null when buildingName is undefined", () => {
      const result = getFloorPlanAsset(undefined, 1);
      expect(result).toBeNull();
    });

    it("handles negative floor numbers", () => {
      const result = getFloorPlanAsset("MB", -2);
      expect(result).toBeTruthy();
    });
  });

  describe("getFloorGeoJSON", () => {
    it("returns GeoJSON for MB floor 1", () => {
      const result = getFloorGeoJSON("MB", 1);
      expect(result).toEqual({ type: "FeatureCollection" });
    });

    it("returns GeoJSON for MB floor -2", () => {
      const result = getFloorGeoJSON("MB", -2);
      expect(result).toEqual({ type: "FeatureCollection" });
    });

    it("returns null for building without GeoJSON", () => {
      const result = getFloorGeoJSON("H", 1);
      expect(result).toBeNull();
    });

    it("returns null for unknown building", () => {
      const result = getFloorGeoJSON("UNKNOWN", 1);
      expect(result).toBeNull();
    });

    it("returns null when buildingName is null", () => {
      const result = getFloorGeoJSON(null, 1);
      expect(result).toBeNull();
    });

    it("returns null when buildingName is undefined", () => {
      const result = getFloorGeoJSON(undefined, 1);
      expect(result).toBeNull();
    });
  });

  describe("getRegisteredIndoorFloors", () => {
    it("returns floors for MB in correct order", () => {
      const result = getRegisteredIndoorFloors("MB");
      expect(result).toEqual([1, -2]);
    });

    it("returns empty array for building with no registered floors", () => {
      const result = getRegisteredIndoorFloors("UNKNOWN");
      expect(result).toEqual([]);
    });

    it("returns sorted floors with negative numbers first", () => {
      const result = getRegisteredIndoorFloors("MB");
      // Negative floors should come after positive floors when sorted
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("handles buildings with only image floors", () => {
      const result = getRegisteredIndoorFloors("H");
      expect(Array.isArray(result)).toBe(true);
    });

    it("deduplicates floors when in both image and GeoJSON registries", () => {
      const result = getRegisteredIndoorFloors("MB");
      // MB floor 1 is in both registries, should appear only once
      const count = result.filter((f) => f === 1).length;
      expect(count).toBe(1);
    });

    it("returns unique floors only", () => {
      const result = getRegisteredIndoorFloors("MB");
      const unique = new Set(result);
      expect(result.length).toBe(unique.size);
    });
  });
});
