import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
    clamp,
    getFloorContentBounds,
    getFloorImageDimensions,
    getFloorStageLayout,
    isLikelyNearOriginBuilding,
    parseOutdoorStrategyParam,
    trimParam,
} from "../utils/indoorMapScreenHelpers";

function makeRoom(x: number, y: number) {
  return {
    id: `room-${x}-${y}`,
    buildingCode: "H",
    floor: 1,
    label: "H-100",
    roomNumber: "100",
    aliases: [],
    x,
    y,
    accessible: true,
    searchTerms: [],
    searchKeys: [],
  };
}

describe("layout math helpers", () => {
  it("clamp limits values to the provided range", () => {
    expect(clamp(10, 0, 5)).toBe(5);
    expect(clamp(-3, 0, 5)).toBe(0);
    expect(clamp(3, 0, 5)).toBe(3);
  });

  it("getFloorImageDimensions prefers metadata values", () => {
    const dimensions = getFloorImageDimensions(
      { width: 2048, height: 1536 },
      [makeRoom(100, 200)],
    );

    expect(dimensions).toEqual({ width: 2048, height: 1536 });
  });

  it("getFloorImageDimensions falls back to room extents and minimum defaults", () => {
    const dimensions = getFloorImageDimensions(undefined, [
      makeRoom(100, 200),
      makeRoom(1700, 950),
    ]);

    expect(dimensions.width).toBe(1780);
    expect(dimensions.height).toBe(1030);
  });

  it("getFloorContentBounds returns full image bounds when no rooms exist", () => {
    const bounds = getFloorContentBounds({ width: 1000, height: 800 }, []);

    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 800 });
  });

  it("getFloorContentBounds expands and clamps around rooms", () => {
    const bounds = getFloorContentBounds(
      { width: 1000, height: 800 },
      [makeRoom(5, 10), makeRoom(920, 760)],
    );

    expect(bounds.minX).toBeGreaterThanOrEqual(0);
    expect(bounds.minY).toBeGreaterThanOrEqual(0);
    expect(bounds.maxX).toBeLessThanOrEqual(1000);
    expect(bounds.maxY).toBeLessThanOrEqual(800);
    expect(bounds.maxX - bounds.minX).toBeGreaterThanOrEqual(260);
    expect(bounds.maxY - bounds.minY).toBeGreaterThanOrEqual(260);
  });

  it("getFloorStageLayout computes scaled frame and image offsets", () => {
    const layout = getFloorStageLayout(
      { width: 500, height: 400 },
      { width: 1000, height: 800 },
      { minX: 100, minY: 200, maxX: 500, maxY: 600 },
    );

    expect(layout.scale).toBeCloseTo(0.92, 2);
    expect(layout.frameWidth).toBeCloseTo(368, 1);
    expect(layout.frameHeight).toBeCloseTo(368, 1);
    expect(layout.imageLeft).toBeCloseTo(-92, 1);
    expect(layout.imageTop).toBeCloseTo(-184, 1);
  });

  it("trimParam normalizes string and non-string values", () => {
    expect(trimParam("  MB-1.210 ")).toBe("MB-1.210");
    expect(trimParam(17)).toBe("");
    expect(trimParam(undefined)).toBe("");
  });
});

describe("parseOutdoorStrategyParam", () => {
  let warnSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns undefined for empty or non-string params", () => {
    expect(parseOutdoorStrategyParam(undefined)).toBeUndefined();
    expect(parseOutdoorStrategyParam("")).toBeUndefined();
    expect(parseOutdoorStrategyParam("   ")).toBeUndefined();
  });

  it("returns parsed strategy for valid JSON", () => {
    const raw = JSON.stringify({ mode: "walking", label: "Walking", icon: "walk" });

    expect(parseOutdoorStrategyParam(raw)).toEqual({
      mode: "walking",
      label: "Walking",
      icon: "walk",
    });
  });

  it("returns undefined and warns for invalid JSON", () => {
    const result = parseOutdoorStrategyParam("{not-json}");

    expect(result).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "IndoorMapScreen: invalid outdoorStrategy param",
      expect.any(SyntaxError),
    );
  });
});

describe("isLikelyNearOriginBuilding", () => {
  it("returns true when origin is missing", () => {
    expect(
      isLikelyNearOriginBuilding(
        { latitude: 45.4971, longitude: -73.5791 },
        undefined,
      ),
    ).toBe(true);
  });

  it("returns true when candidate is close to origin", () => {
    expect(
      isLikelyNearOriginBuilding(
        { latitude: 45.4971, longitude: -73.5791 },
        { latitude: 45.4972, longitude: -73.5792 },
      ),
    ).toBe(true);
  });

  it("returns false when candidate is far from origin", () => {
    expect(
      isLikelyNearOriginBuilding(
        { latitude: 45.5, longitude: -73.58 },
        { latitude: 45.4971, longitude: -73.5791 },
      ),
    ).toBe(false);
  });
});
