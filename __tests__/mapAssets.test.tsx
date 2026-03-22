import { getAvailableFloors, hasFloorMap } from "../utils/mapAssets";

jest.mock("../hooks/useFloorData", () => ({
  getRegisteredFloors: jest.fn((buildingName) => {
    const floors: Record<string, number[]> = {
      MB: [1, -2],
      H: [1, 2, 8, 9],
      CC: [1],
      VL: [1, 2],
    };
    return floors[buildingName] ?? null;
  }),
}));

describe("mapAssets", () => {
  describe("hasFloorMap", () => {
    it("returns true for MB floor 1", () => {
      expect(hasFloorMap("MB", 1)).toBe(true);
    });

    it("returns true for MB floor -2", () => {
      expect(hasFloorMap("MB", -2)).toBe(true);
    });

    it("returns true for H floor 8", () => {
      expect(hasFloorMap("H", 8)).toBe(true);
    });

    it("returns false for MB floor 99", () => {
      expect(hasFloorMap("MB", 99)).toBe(false);
    });

    it("returns false for unknown building", () => {
      expect(hasFloorMap("UNKNOWN", 1)).toBe(false);
    });

    it("returns false for H floor 3 (not available)", () => {
      expect(hasFloorMap("H", 3)).toBe(false);
    });

    it("handles negative floor numbers correctly", () => {
      expect(hasFloorMap("MB", -2)).toBe(true);
      expect(hasFloorMap("MB", -1)).toBe(false);
    });

    it("returns true for VL floors", () => {
      expect(hasFloorMap("VL", 1)).toBe(true);
      expect(hasFloorMap("VL", 2)).toBe(true);
    });

    it("returns true for CC floor 1", () => {
      expect(hasFloorMap("CC", 1)).toBe(true);
    });
  });

  describe("getAvailableFloors", () => {
    it("returns floors for MB", () => {
      expect(getAvailableFloors("MB")).toEqual([1, -2]);
    });

    it("returns floors for H", () => {
      expect(getAvailableFloors("H")).toEqual([1, 2, 8, 9]);
    });

    it("returns single floor for CC", () => {
      expect(getAvailableFloors("CC")).toEqual([1]);
    });

    it("returns floors for VL", () => {
      expect(getAvailableFloors("VL")).toEqual([1, 2]);
    });

    it("returns empty array for unknown building", () => {
      expect(getAvailableFloors("UNKNOWN")).toEqual([]);
    });

    it("preserves floor order including negative numbers", () => {
      const mbFloors = getAvailableFloors("MB");
      expect(mbFloors).toContain(1);
      expect(mbFloors).toContain(-2);
    });
  });
});
