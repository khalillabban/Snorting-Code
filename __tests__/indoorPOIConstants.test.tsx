import {
    NODE_TYPE_TO_POI,
    POI_CATEGORIES,
    POI_CATEGORY_MAP
} from "../constants/indoorPOI";

describe("indoorPOI constants", () => {
  it("defines all expected POI category ids", () => {
    const ids = POI_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("washroom");
    expect(ids).toContain("water_fountain");
    expect(ids).toContain("stairs");
    expect(ids).toContain("elevator");
    expect(ids).toContain("entrance");
  });

  it("each category has required properties", () => {
    for (const cat of POI_CATEGORIES) {
      expect(cat.label).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(cat.color).toMatch(/^#/);
    }
  });

  it("POI_CATEGORY_MAP keys match POI_CATEGORIES ids", () => {
    const ids = POI_CATEGORIES.map((c) => c.id);
    expect(Object.keys(POI_CATEGORY_MAP).sort()).toEqual([...ids].sort());
  });

  it("maps stair_landing node type to stairs", () => {
    expect(NODE_TYPE_TO_POI["stair_landing"]).toBe("stairs");
  });

  it("maps elevator_door node type to elevator", () => {
    expect(NODE_TYPE_TO_POI["elevator_door"]).toBe("elevator");
  });

  it("maps building_entry_exit node type to entrance", () => {
    expect(NODE_TYPE_TO_POI["building_entry_exit"]).toBe("entrance");
  });

  it("does not map room or hallway_waypoint types", () => {
    expect(NODE_TYPE_TO_POI["room"]).toBeUndefined();
    expect(NODE_TYPE_TO_POI["hallway_waypoint"]).toBeUndefined();
  });
});
