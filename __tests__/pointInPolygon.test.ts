/**
 * @jest-environment node
 */
import { Buildings, Location } from "../constants/type";
import {
  getBuildingContainingPoint,
  pointInPolygon,
} from "../utils/pointInPolygon";

describe("pointInPolygon", () => {
  const squarePoly: Location[] = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 1 },
    { latitude: 1, longitude: 1 },
    { latitude: 1, longitude: 0 },
  ];

  describe("basic functionality", () => {
    it("returns true for point inside polygon", () => {
      expect(
        pointInPolygon({ latitude: 0.5, longitude: 0.5 }, squarePoly),
      ).toBe(true);
    });

    it("returns false for point outside polygon", () => {
      expect(pointInPolygon({ latitude: 2, longitude: 2 }, squarePoly)).toBe(
        false,
      );
    });

    it("returns false for point clearly outside to the left", () => {
      expect(pointInPolygon({ latitude: 0.5, longitude: -1 }, squarePoly)).toBe(
        false,
      );
    });

    it("returns false for point clearly outside to the right", () => {
      expect(pointInPolygon({ latitude: 0.5, longitude: 2 }, squarePoly)).toBe(
        false,
      );
    });

    it("returns false for point above polygon", () => {
      expect(pointInPolygon({ latitude: -1, longitude: 0.5 }, squarePoly)).toBe(
        false,
      );
    });

    it("returns false for point below polygon", () => {
      expect(
        pointInPolygon({ latitude: 1.5, longitude: 0.5 }, squarePoly),
      ).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for polygon with fewer than 3 points", () => {
      const twoPoints: Location[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
      ];
      expect(pointInPolygon({ latitude: 0.5, longitude: 0.5 }, twoPoints)).toBe(
        false,
      );
    });

    it("returns false for empty polygon", () => {
      expect(pointInPolygon({ latitude: 0.5, longitude: 0.5 }, [])).toBe(false);
    });

    it("returns false for single point polygon", () => {
      const onePoint: Location[] = [{ latitude: 0, longitude: 0 }];
      expect(pointInPolygon({ latitude: 0, longitude: 0 }, onePoint)).toBe(
        false,
      );
    });

    it("handles triangle polygon", () => {
      const triangle: Location[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
        { latitude: 0.5, longitude: 1 },
      ];
      expect(pointInPolygon({ latitude: 0.5, longitude: 0.3 }, triangle)).toBe(
        true,
      );
      expect(pointInPolygon({ latitude: 0.5, longitude: 1.5 }, triangle)).toBe(
        false,
      );
      expect(pointInPolygon({ latitude: 1.5, longitude: 0.5 }, triangle)).toBe(
        false,
      );
    });

    it("handles point near boundary", () => {
      // Point just inside the polygon
      expect(
        pointInPolygon({ latitude: 0.1, longitude: 0.5 }, squarePoly),
      ).toBe(true);
      // Point just outside the polygon
      expect(
        pointInPolygon({ latitude: -0.1, longitude: 0.5 }, squarePoly),
      ).toBe(false);
    });
  });

  describe("complex polygons", () => {
    it("handles concave polygon", () => {
      const concave: Location[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 2 },
        { latitude: 1, longitude: 2 },
        { latitude: 1, longitude: 1 },
        { latitude: 2, longitude: 1 },
        { latitude: 2, longitude: 0 },
      ];
      expect(pointInPolygon({ latitude: 0.5, longitude: 1.5 }, concave)).toBe(
        true,
      );
      expect(pointInPolygon({ latitude: 1.5, longitude: 1.5 }, concave)).toBe(
        false,
      );
    });

    it("handles larger polygon", () => {
      const largePoly: Location[] = [
        { latitude: -10, longitude: -10 },
        { latitude: -10, longitude: 10 },
        { latitude: 10, longitude: 10 },
        { latitude: 10, longitude: -10 },
      ];
      expect(pointInPolygon({ latitude: 0, longitude: 0 }, largePoly)).toBe(
        true,
      );
      expect(pointInPolygon({ latitude: 11, longitude: 11 }, largePoly)).toBe(
        false,
      );
      expect(pointInPolygon({ latitude: -11, longitude: 0 }, largePoly)).toBe(
        false,
      );
    });

    it("handles pentagon", () => {
      const pentagon: Location[] = [
        { latitude: 0, longitude: 1 },
        { latitude: 0.95, longitude: 0.31 },
        { latitude: 0.59, longitude: -0.81 },
        { latitude: -0.59, longitude: -0.81 },
        { latitude: -0.95, longitude: 0.31 },
      ];
      expect(pointInPolygon({ latitude: 0, longitude: 0 }, pentagon)).toBe(
        true,
      );
      expect(pointInPolygon({ latitude: 2, longitude: 2 }, pentagon)).toBe(
        false,
      );
    });
  });

  describe("ray-casting edge cases", () => {
    it("handles horizontal ray that doesn't cross edges", () => {
      expect(
        pointInPolygon({ latitude: 0.5, longitude: -0.5 }, squarePoly),
      ).toBe(false);
    });

    it("handles points at various positions", () => {
      // Top-left quadrant inside
      expect(
        pointInPolygon({ latitude: 0.25, longitude: 0.25 }, squarePoly),
      ).toBe(true);
      // Top-right quadrant inside
      expect(
        pointInPolygon({ latitude: 0.25, longitude: 0.75 }, squarePoly),
      ).toBe(true);
      // Bottom-left quadrant inside
      expect(
        pointInPolygon({ latitude: 0.75, longitude: 0.25 }, squarePoly),
      ).toBe(true);
      // Bottom-right quadrant inside
      expect(
        pointInPolygon({ latitude: 0.75, longitude: 0.75 }, squarePoly),
      ).toBe(true);
    });
  });
});

describe("getBuildingContainingPoint", () => {
  const buildingA: Buildings = {
    name: "Engineering Building",
    campusName: "Main Campus",
    displayName: "Building A",
    address: "123 University Ave",
    coordinates: { latitude: 0.5, longitude: 0.5 },
    boundingBox: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
      { latitude: 1, longitude: 1 },
      { latitude: 1, longitude: 0 },
    ],
  };

  const buildingB: Buildings = {
    name: "Science Building",
    campusName: "Main Campus",
    displayName: "Building B",
    address: "456 College Rd",
    coordinates: { latitude: 2.5, longitude: 2.5 },
    boundingBox: [
      { latitude: 2, longitude: 2 },
      { latitude: 2, longitude: 3 },
      { latitude: 3, longitude: 3 },
      { latitude: 3, longitude: 2 },
    ],
    departments: ["Physics", "Chemistry"],
    services: ["Library", "Cafeteria"],
  };

  const buildingInvalid: Buildings = {
    name: "Invalid Building",
    campusName: "Main Campus",
    displayName: "Invalid",
    address: "789 Campus Dr",
    coordinates: { latitude: 5, longitude: 5 },
    boundingBox: [
      { latitude: 5, longitude: 5 },
      { latitude: 5, longitude: 6 },
    ], // Only 2 points - invalid
  };

  const buildingNoBoundingBox: Buildings = {
    name: "No BBox Building",
    campusName: "Main Campus",
    displayName: "No BBox",
    address: "999 University Blvd",
    coordinates: { latitude: 7, longitude: 7 },
    boundingBox: undefined as any,
  };

  describe("finding buildings", () => {
    it("returns building when point is inside", () => {
      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [buildingA, buildingB],
      );
      expect(result).toEqual(buildingA);
    });

    it("returns correct building when point is in second building", () => {
      const result = getBuildingContainingPoint(
        { latitude: 2.5, longitude: 2.5 },
        [buildingA, buildingB],
      );
      expect(result).toEqual(buildingB);
    });

    it("returns null when point is outside all buildings", () => {
      const result = getBuildingContainingPoint(
        { latitude: 10, longitude: 10 },
        [buildingA, buildingB],
      );
      expect(result).toBeNull();
    });

    it("returns first matching building when multiple overlap", () => {
      const overlappingBuilding: Buildings = {
        name: "Overlapping Building",
        campusName: "Main Campus",
        displayName: "Building C",
        address: "321 Campus Way",
        coordinates: { latitude: 1, longitude: 1 },
        boundingBox: [
          { latitude: 0, longitude: 0 },
          { latitude: 0, longitude: 2 },
          { latitude: 2, longitude: 2 },
          { latitude: 2, longitude: 0 },
        ],
      };

      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [buildingA, overlappingBuilding],
      );
      expect(result).toEqual(buildingA); // Returns first match
    });

    it("works with buildings that have departments and services", () => {
      const result = getBuildingContainingPoint(
        { latitude: 2.5, longitude: 2.5 },
        [buildingB],
      );
      expect(result).toEqual(buildingB);
      expect(result?.departments).toEqual(["Physics", "Chemistry"]);
      expect(result?.services).toEqual(["Library", "Cafeteria"]);
    });

    it("handles point near building boundary", () => {
      // Just inside building A
      const insideResult = getBuildingContainingPoint(
        { latitude: 0.1, longitude: 0.1 },
        [buildingA, buildingB],
      );
      expect(insideResult).toEqual(buildingA);

      // Just outside building A
      const outsideResult = getBuildingContainingPoint(
        { latitude: -0.1, longitude: 0.5 },
        [buildingA, buildingB],
      );
      expect(outsideResult).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null for empty buildings array", () => {
      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [],
      );
      expect(result).toBeNull();
    });

    it("skips buildings with invalid bounding box (< 3 points)", () => {
      const result = getBuildingContainingPoint(
        { latitude: 5.5, longitude: 5.5 },
        [buildingInvalid, buildingB],
      );
      expect(result).toBeNull();
    });

    it("skips buildings with no bounding box", () => {
      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [buildingNoBoundingBox, buildingA],
      );
      expect(result).toEqual(buildingA);
    });

    it("handles buildings with null boundingBox", () => {
      const buildingNullBBox: Buildings = {
        name: "Null BBox Building",
        campusName: "Main Campus",
        displayName: "Null BBox",
        address: "111 Campus Ln",
        coordinates: { latitude: 8, longitude: 8 },
        boundingBox: null as any,
      };

      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [buildingNullBBox, buildingA],
      );
      expect(result).toEqual(buildingA);
    });

    it("handles mix of valid and invalid buildings", () => {
      const result = getBuildingContainingPoint(
        { latitude: 2.5, longitude: 2.5 },
        [buildingNoBoundingBox, buildingInvalid, buildingB],
      );
      expect(result).toEqual(buildingB);
    });

    it("handles buildings with empty bounding box array", () => {
      const buildingEmptyBBox: Buildings = {
        name: "Empty BBox Building",
        campusName: "Main Campus",
        displayName: "Empty BBox",
        address: "222 Campus Pkwy",
        coordinates: { latitude: 9, longitude: 9 },
        boundingBox: [],
      };

      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [buildingEmptyBBox, buildingA],
      );
      expect(result).toEqual(buildingA);
    });

    it("returns null when all buildings are invalid", () => {
      const result = getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        [buildingInvalid, buildingNoBoundingBox],
      );
      expect(result).toBeNull();
    });
  });
});
