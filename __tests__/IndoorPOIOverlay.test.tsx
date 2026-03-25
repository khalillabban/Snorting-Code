import { render, screen } from "@testing-library/react-native";
import React from "react";
import { IndoorPOIOverlay } from "../components/IndoorPOIOverlay";
import type { POICategoryId } from "../constants/indoorPOI";
import type { IndoorPOI } from "../utils/indoorPOI";

const mockPOIs: IndoorPOI[] = [
  { id: "stair1", category: "stairs", buildingCode: "H", floor: 1, x: 100, y: 200 },
  { id: "stair2", category: "stairs", buildingCode: "H", floor: 2, x: 150, y: 250 },
  { id: "elev1", category: "elevator", buildingCode: "H", floor: 1, x: 300, y: 400 },
  { id: "wc1", category: "washroom", buildingCode: "H", floor: 1, x: 500, y: 600 },
  { id: "wf1", category: "water_fountain", buildingCode: "H", floor: 1, x: 550, y: 610 },
  { id: "ent1", category: "entrance", buildingCode: "H", floor: 1, x: 700, y: 800 },
];

const mockStageLayout = {
  frameLeft: 10,
  frameTop: 20,
  scale: 0.5,
};

const mockFloorBounds = {
  minX: 0,
  minY: 0,
};

const hidden = { includeHiddenElements: true };

describe("IndoorPOIOverlay", () => {
  it("renders nothing when no categories are active", () => {
    render(
      <IndoorPOIOverlay
        pois={mockPOIs}
        floor={1}
        coordinateScale={1}
        stageLayout={mockStageLayout}
        floorBounds={mockFloorBounds}
        activeCategories={new Set()}
      />,
    );

    expect(screen.queryByTestId("poi-overlay", hidden)).toBeNull();
  });

  it("renders only POIs that match active categories on the current floor", () => {
    const active = new Set<POICategoryId>(["stairs"]);
    render(
      <IndoorPOIOverlay
        pois={mockPOIs}
        floor={1}
        coordinateScale={1}
        stageLayout={mockStageLayout}
        floorBounds={mockFloorBounds}
        activeCategories={active}
      />,
    );

    expect(screen.getByTestId("poi-overlay", hidden)).toBeTruthy();
    // Only stair1 is on floor 1 with category stairs
    expect(screen.getByTestId("poi-marker-stair1", hidden)).toBeTruthy();
    // stair2 is on floor 2, should not appear
    expect(screen.queryByTestId("poi-marker-stair2", hidden)).toBeNull();
    // elevator and washroom not active
    expect(screen.queryByTestId("poi-marker-elev1", hidden)).toBeNull();
    expect(screen.queryByTestId("poi-marker-wc1", hidden)).toBeNull();
  });

  it("renders multiple categories when selected", () => {
    const active = new Set<POICategoryId>(["stairs", "elevator", "washroom"]);
    render(
      <IndoorPOIOverlay
        pois={mockPOIs}
        floor={1}
        coordinateScale={1}
        stageLayout={mockStageLayout}
        floorBounds={mockFloorBounds}
        activeCategories={active}
      />,
    );

    expect(screen.getByTestId("poi-marker-stair1", hidden)).toBeTruthy();
    expect(screen.getByTestId("poi-marker-elev1", hidden)).toBeTruthy();
    expect(screen.getByTestId("poi-marker-wc1", hidden)).toBeTruthy();
    // water_fountain not active
    expect(screen.queryByTestId("poi-marker-wf1", hidden)).toBeNull();
  });

  it("applies coordinate scale to positions", () => {
    const active = new Set<POICategoryId>(["stairs"]);
    render(
      <IndoorPOIOverlay
        pois={mockPOIs}
        floor={1}
        coordinateScale={0.5}
        stageLayout={{ frameLeft: 0, frameTop: 0, scale: 1 }}
        floorBounds={{ minX: 0, minY: 0 }}
        activeCategories={active}
      />,
    );

    const marker = screen.getByTestId("poi-marker-stair1", hidden);
    // x=100, coordinateScale=0.5 → scaledX=50, frameLeft=0, minX=0, scale=1 → left = 50 - 13 = 37
    // y=200, coordinateScale=0.5 → scaledY=100, frameTop=0, minY=0, scale=1 → top = 100 - 13 = 87
    expect(marker.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ left: 37, top: 87 }),
      ]),
    );
  });

  it("skips rendering POI markers with an unknown category", () => {
    // A POI whose category has no entry in POI_CATEGORY_MAP should be silently
    // skipped (the `if (!catDef) return null` branch) and must not throw.
    const poisWithBadCat: IndoorPOI[] = [
      { id: "bad1", category: "stairs" as any, buildingCode: "H", floor: 1, x: 100, y: 200 },
      // Force an unknown category via type cast
      { id: "bad2", category: "unknown_category" as any, buildingCode: "H", floor: 1, x: 200, y: 300 },
    ];
    const active = new Set<POICategoryId>(["stairs", "unknown_category" as any]);
    render(
      <IndoorPOIOverlay
        pois={poisWithBadCat}
        floor={1}
        coordinateScale={1}
        stageLayout={mockStageLayout}
        floorBounds={mockFloorBounds}
        activeCategories={active}
      />,
    );
    // The valid stairs POI renders; the bad-category POI does not crash and is skipped
    expect(screen.getByTestId("poi-marker-bad1", hidden)).toBeTruthy();
    expect(screen.queryByTestId("poi-marker-bad2", hidden)).toBeNull();
  });

  it("shows POIs on the correct floor only", () => {
    const active = new Set<POICategoryId>(["stairs"]);
    render(
      <IndoorPOIOverlay
        pois={mockPOIs}
        floor={2}
        coordinateScale={1}
        stageLayout={mockStageLayout}
        floorBounds={mockFloorBounds}
        activeCategories={active}
      />,
    );

    // stair2 is on floor 2
    expect(screen.getByTestId("poi-marker-stair2", hidden)).toBeTruthy();
    // stair1 is on floor 1
    expect(screen.queryByTestId("poi-marker-stair1", hidden)).toBeNull();
  });
});
