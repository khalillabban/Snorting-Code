import {
    isLikelyNearOriginBuilding,
    parseOutdoorStrategyParam,
} from "../utils/indoorMapScreenHelpers";

describe("parseOutdoorStrategyParam", () => {
  let warnSpy: jest.SpyInstance;

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
