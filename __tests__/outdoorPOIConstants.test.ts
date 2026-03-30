import {
    OUTDOOR_POI_CATEGORIES,
    OUTDOOR_POI_CATEGORY_MAP,
} from "../constants/outdoorPOI";

describe("outdoorPOI constants", () => {
  it("defines a stable set of supported categories", () => {
    expect(OUTDOOR_POI_CATEGORIES.map((c) => c.id)).toEqual([
      "restaurant",
      "coffee",
      "study",
      "grocery",
      "pharmacy",
      "atm",
    ]);
  });

  it("maps every category id to the same category definition", () => {
    for (const category of OUTDOOR_POI_CATEGORIES) {
      expect(OUTDOOR_POI_CATEGORY_MAP[category.id]).toEqual(category);
    }
  });

  it("exposes the expected Google Places type for each category", () => {
    expect(OUTDOOR_POI_CATEGORY_MAP.restaurant.googlePlacesType).toBe("restaurant");
    expect(OUTDOOR_POI_CATEGORY_MAP.coffee.googlePlacesType).toBe("cafe");
    expect(OUTDOOR_POI_CATEGORY_MAP.study.googlePlacesType).toBe("library");
    expect(OUTDOOR_POI_CATEGORY_MAP.grocery.googlePlacesType).toBe("supermarket");
    expect(OUTDOOR_POI_CATEGORY_MAP.pharmacy.googlePlacesType).toBe("pharmacy");
    expect(OUTDOOR_POI_CATEGORY_MAP.atm.googlePlacesType).toBe("atm");
  });
});
