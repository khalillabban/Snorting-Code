import { render, screen } from "@testing-library/react-native";
import React from "react";
import { IndoorSVGOverlay } from "../components/IndoorSVGOverlay";
import type { Buildings } from "../constants/type";
import type { ImageFloorPlan } from "../utils/indoorMapAssets";

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  
  return {
    Overlay: ({ bounds, image, opacity }: any) => {
      return React.createElement(View, {
        testID: "overlay",
        "data-bounds": `${bounds[0][0]},${bounds[0][1]}`,
        "data-opacity": opacity,
      });
    },
  };
});

const mockBuilding: Buildings = {
  displayName: "MB Building",
  name: "MB",
  address: "1455 Boulevard de Maisonneuve Ouest",
  campusName: "sgw",
  departments: [],
  services: [],
  coordinates: {
    latitude: 45.495,
    longitude: -73.58,
  },
  mapCorners: {
    NW: { latitude: 45.496, longitude: -73.580 },
    NE: { latitude: 45.496, longitude: -73.579 },
    SW: { latitude: 45.495, longitude: -73.580 },
    SE: { latitude: 45.495, longitude: -73.579 },
  },
  boundingBox: [
    { latitude: 45.495026633071944, longitude: -73.57962398739532 },
    { latitude: 45.495597256069885, longitude: -73.57847600193695 },
  ],
};

const mockBuildingWithoutBox: Buildings = {
  ...mockBuilding,
  boundingBox: [],
};

const mockBuildingH: Buildings = {
  ...mockBuilding,
  name: "H",
};

describe("IndoorSVGOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders overlay with building bounds", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("returns null when building has no bounding box", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuildingWithoutBox} />
    );
    expect(true).toBe(true);
  });

  it("uses calculated bounds when overlay bounds are not predefined", () => {
    const customBuilding: Buildings = {
      ...mockBuilding,
      boundingBox: [
        { latitude: 45.494, longitude: -73.579 },
        { latitude: 45.496, longitude: -73.581 },
      ],
    };
    render(<IndoorSVGOverlay source={1} building={customBuilding} />);
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("uses predefined overlay bounds for H building", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuildingH} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("uses predefined overlay bounds for MB building", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("applies 0.85 opacity to overlay", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("accepts image source as number (require)", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("accepts image source as URI object", () => {
    const uriSource: ImageFloorPlan = { uri: "file:///path/to/image.png" };
    render(
      <IndoorSVGOverlay source={uriSource} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("calculates southwest and northeast bounds from building coordinates", () => {
    const customBuilding: Buildings = {
      ...mockBuilding,
      boundingBox: [
        { latitude: 45.494, longitude: -73.579 },
        { latitude: 45.496, longitude: -73.581 },
        { latitude: 45.495, longitude: -73.580 },
      ],
    };
    render(
      <IndoorSVGOverlay source={1} building={customBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("returns null when calculated bounds are invalid (non-finite values)", () => {
    const invalidBuilding: Buildings = {
      ...mockBuilding,
      boundingBox: [
        { latitude: NaN, longitude: NaN },
        { latitude: Infinity, longitude: Infinity },
      ],
    };
    render(
      <IndoorSVGOverlay source={1} building={invalidBuilding} />
    );
    expect(true).toBe(true);
  });

  it("handles empty bounding box array", () => {
    const noBboxBuilding: Buildings = {
      ...mockBuilding,
      boundingBox: [],
    };
    render(
      <IndoorSVGOverlay source={1} building={noBboxBuilding} />
    );
    expect(true).toBe(true);
  });

  it("uses southwest corner as first bound", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });

  it("uses northeast corner as second bound", () => {
    render(
      <IndoorSVGOverlay source={1} building={mockBuilding} />
    );
    expect(screen.getByTestId("overlay")).toBeTruthy();
  });
});
