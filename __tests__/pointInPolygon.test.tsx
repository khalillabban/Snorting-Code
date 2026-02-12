import { getBuildingContainingPoint } from "../utils/pointInPolygon";

describe("pointInPolygon", () => {
  const buildings = [
    {
      name: "A",
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
        { latitude: 1, longitude: 0 },
      ],
    },
  ];

  it("returns building when point is inside", () => {
    expect(
      getBuildingContainingPoint(
        { latitude: 0.5, longitude: 0.5 },
        buildings as any
      )
    ).toEqual(buildings[0]);
  });

  it("returns null when point is outside", () => {
    expect(
      getBuildingContainingPoint(
        { latitude: 2, longitude: 2 },
        buildings as any
      )
    ).toBeNull();
  });
});