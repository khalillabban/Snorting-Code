import {
  getAvailableFloors,
  getBuildingPlanAsset,
  getFloorImageAsset,
  getLegacyFloorGeoJsonAsset,
  hasBuildingPlanAsset,
  hasFloorMap,
} from "../utils/mapAssets";

describe("utils/mapAssets", () => {
  it("returns the expected available floors for each registered building", () => {
    expect(getAvailableFloors("CC")).toEqual([1]);
    expect(getAvailableFloors("H")).toEqual([1, 2, 8, 9]);
    expect(getAvailableFloors("LB")).toEqual([]);
    expect(getAvailableFloors("MB")).toEqual([1, -2]);
    expect(getAvailableFloors("VE")).toEqual([1, 2]);
    expect(getAvailableFloors("VL")).toEqual([1, 2]);
  });

  it("returns an empty list for unknown buildings", () => {
    expect(getAvailableFloors("UNKNOWN")).toEqual([]);
  });

  it("reports whether a registered floor image exists", () => {
    expect(hasFloorMap("CC", 1)).toBe(true);
    expect(hasFloorMap("H", 8)).toBe(true);
    expect(hasFloorMap("MB", -2)).toBe(true);
    expect(hasFloorMap("VE", 2)).toBe(true);
    expect(hasFloorMap("VL", 1)).toBe(true);

    expect(hasFloorMap("CC", 2)).toBe(false);
    expect(hasFloorMap("LB", 4)).toBe(false);
    expect(hasFloorMap("H", 7)).toBe(false);
    expect(hasFloorMap("UNKNOWN", 1)).toBe(false);
  });

  it("returns floor image assets for registered floors", () => {
    expect(getFloorImageAsset("CC", 1)).toBeDefined();
    expect(getFloorImageAsset("H", 1)).toBeDefined();
    expect(getFloorImageAsset("H", 2)).toBeDefined();
    expect(getFloorImageAsset("H", 8)).toBeDefined();
    expect(getFloorImageAsset("H", 9)).toBeDefined();
    expect(getFloorImageAsset("MB", 1)).toBeDefined();
    expect(getFloorImageAsset("MB", -2)).toBeDefined();
    expect(getFloorImageAsset("VE", 1)).toBeDefined();
    expect(getFloorImageAsset("VE", 2)).toBeDefined();
    expect(getFloorImageAsset("VL", 1)).toBeDefined();
    expect(getFloorImageAsset("VL", 2)).toBeDefined();

    expect(getFloorImageAsset("LB", 2)).toBeUndefined();
    expect(getFloorImageAsset("UNKNOWN", 1)).toBeUndefined();
  });

  it("reports which buildings have building-plan assets", () => {
    expect(hasBuildingPlanAsset("CC")).toBe(true);
    expect(hasBuildingPlanAsset("H")).toBe(true);
    expect(hasBuildingPlanAsset("MB")).toBe(true);
    expect(hasBuildingPlanAsset("VE")).toBe(true);
    expect(hasBuildingPlanAsset("VL")).toBe(true);

    expect(hasBuildingPlanAsset("LB")).toBe(false);
    expect(hasBuildingPlanAsset("UNKNOWN")).toBe(false);
  });

  it("returns the building-plan asset when present", () => {
    expect(getBuildingPlanAsset("CC")).toBeDefined();
    expect(getBuildingPlanAsset("H")).toBeDefined();
    expect(getBuildingPlanAsset("MB")).toBeDefined();
    expect(getBuildingPlanAsset("VE")).toBeDefined();
    expect(getBuildingPlanAsset("VL")).toBeDefined();

    expect(getBuildingPlanAsset("LB")).toBeUndefined();
    expect(getBuildingPlanAsset("UNKNOWN")).toBeUndefined();
  });

  it("returns MB legacy GeoJSON assets and omits them for other buildings", () => {
    expect(getLegacyFloorGeoJsonAsset("MB", 1)).toBeDefined();
    expect(getLegacyFloorGeoJsonAsset("MB", -2)).toBeDefined();

    expect(getLegacyFloorGeoJsonAsset("MB", 2)).toBeUndefined();
    expect(getLegacyFloorGeoJsonAsset("H", 1)).toBeUndefined();
    expect(getLegacyFloorGeoJsonAsset("UNKNOWN", 1)).toBeUndefined();
  });

  it("normalizes building codes when looking up assets", () => {
    expect(getAvailableFloors(" mb ")).toEqual([1, -2]);
    expect(hasBuildingPlanAsset(" ve ")).toBe(true);
    expect(getAvailableFloors("Hall")).toEqual([1, 2, 8, 9]);
    expect(getLegacyFloorGeoJsonAsset(" mb ", -2)).toBeDefined();
  });
});
