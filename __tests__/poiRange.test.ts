import { DEFAULT_POI_RANGE, POI_RANGE_OPTIONS } from "../constants/poiRange";

describe("poiRange constants", () => {
  it("provides the expected selectable distance options", () => {
    expect(POI_RANGE_OPTIONS).toEqual([
      { id: "200", label: "200m", meters: 200 },
      { id: "500", label: "500m", meters: 500 },
      { id: "1000", label: "1 km", meters: 1000 },
      { id: "2000", label: "2 km", meters: 2000 },
    ]);
  });

  it("uses 500m as the default selected range", () => {
    expect(DEFAULT_POI_RANGE).toEqual({ id: "500", label: "500m", meters: 500 });
    expect(DEFAULT_POI_RANGE).toBe(POI_RANGE_OPTIONS[1]);
  });
});
