import { findBuildingByCode } from "../utils/findBuildingByCode";

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    {
      name: "H",
      campusName: "SGW",
      displayName: "Henry F. Hall Building (H)",
      address: "1455 Blvd. De Maisonneuve Ouest",
      coordinates: { latitude: 45.497256, longitude: -73.578915 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
    {
      name: "MB",
      campusName: "SGW",
      displayName: "John Molson Building (MB)",
      address: "1450 Guy St",
      coordinates: { latitude: 45.495304, longitude: -73.579044 },
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
      coordinates: { latitude: 45.4576633, longitude: -73.6413024 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
  ],
}));

describe("findBuildingByCode", () => {
  it("returns the building matching the code (case-insensitive)", () => {
    const result = findBuildingByCode("h");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("H");
    expect(result!.displayName).toBe("Henry F. Hall Building (H)");
  });

  it("returns the building for uppercase code", () => {
    const result = findBuildingByCode("MB");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("MB");
  });

  it("returns null for an unknown code", () => {
    expect(findBuildingByCode("XYZ")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(findBuildingByCode("")).toBeNull();
  });

  it("trims whitespace", () => {
    const result = findBuildingByCode("  SP  ");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("SP");
  });
});
