import { describe, expect, it } from "@jest/globals";
import {
    buildIndoorMapRouteParams,
    getIndoorAccessState,
    normalizeRoomQuery,
} from "../utils/indoorAccess";

describe("indoorAccess", () => {
  it("normalizes room query with building prefix", () => {
    expect(normalizeRoomQuery("h", " 920 ")).toBe("H-920");
    expect(normalizeRoomQuery("h", "h-920")).toBe("h-920");
    expect(normalizeRoomQuery("h", "   ")).toBe("");
  });

  it("returns no indoor access for unknown building code", () => {
    const access = getIndoorAccessState("UNKNOWN");

    expect(access.buildingCode).toBe("UNKNOWN");
    expect(access.floors).toEqual([]);
    expect(access.hasIndoorMap).toBe(false);
    expect(access.hasSearchableRooms).toBe(false);
  });

  it("returns indoor access with searchable rooms for supported building", () => {
    const access = getIndoorAccessState(" h ");

    expect(access.buildingCode).toBe("H");
    expect(access.floors.length).toBeGreaterThan(0);
    expect(access.hasIndoorMap).toBe(true);
    expect(access.hasSearchableRooms).toBe(true);
  });

  it("builds route params for supported building and trims room query", () => {
    const params = buildIndoorMapRouteParams("H", " 920 ");

    expect(params).toEqual(
      expect.objectContaining({
        buildingName: "H",
        roomQuery: "920",
      }),
    );
    expect(Array.isArray(JSON.parse(params!.floors))).toBe(true);
  });

  it("returns null route params when building has no indoor map", () => {
    expect(buildIndoorMapRouteParams("UNKNOWN", "920")).toBeNull();
  });

  it("omits roomQuery when empty even if building is supported", () => {
    const params = buildIndoorMapRouteParams("H", "   ");

    expect(params).toEqual(
      expect.objectContaining({
        buildingName: "H",
      }),
    );
    expect(params?.roomQuery).toBeUndefined();
  });
});
