import { render, screen } from "@testing-library/react-native";
import React from "react";
import { IndoorSVGOverlay } from "../components/IndoorSVGOverlay";
import type { Buildings } from "../constants/type";

jest.mock("react-native-maps", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");
  const overlaySpy = jest.fn();

  return {
    Overlay: (props: any) => {
      overlaySpy(props);
      return React.createElement(View, { testID: "overlay" });
    },
    __overlaySpy: overlaySpy,
  };
});

const mapsMock = jest.requireMock("react-native-maps") as {
  __overlaySpy: jest.Mock;
};

const baseBuilding: Buildings = {
  name: "X",
  campusName: "sgw",
  displayName: "Test Building",
  address: "123 Test St",
  coordinates: { latitude: 45.0, longitude: -73.0 },
  boundingBox: [
    { latitude: 45.1, longitude: -73.2 },
    { latitude: 45.3, longitude: -73.0 },
    { latitude: 45.2, longitude: -73.1 },
  ],
};

describe("IndoorSVGOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when building has no bounding box", () => {
    const building: Buildings = { ...baseBuilding, boundingBox: [] };

    const { queryByTestId } = render(
      <IndoorSVGOverlay source={1} building={building} />,
    );

    expect(queryByTestId("overlay")).toBeNull();
    expect(mapsMock.__overlaySpy).not.toHaveBeenCalled();
  });

  it("uses calibrated bounds for H building", () => {
    const building: Buildings = {
      ...baseBuilding,
      name: "H",
      boundingBox: [{ latitude: 1, longitude: 1 }],
    };

    render(<IndoorSVGOverlay source={1} building={building} />);

    expect(screen.getByTestId("overlay")).toBeTruthy();
    expect(mapsMock.__overlaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bounds: [
          [45.49682818364492, -73.57954223351966],
          [45.497708183281496, -73.57833870872308],
        ],
        image: 1,
        opacity: 0.85,
      }),
    );
  });

  it("uses calibrated bounds for MB building", () => {
    const building: Buildings = {
      ...baseBuilding,
      name: "MB",
      boundingBox: [{ latitude: 1, longitude: 1 }],
    };

    render(<IndoorSVGOverlay source={42} building={building} />);

    expect(screen.getByTestId("overlay")).toBeTruthy();
    expect(mapsMock.__overlaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bounds: [
          [45.495026633071944, -73.57962398739532],
          [45.495597256069885, -73.57847600193695],
        ],
        image: 42,
      }),
    );
  });

  it("calculates bounds from bounding box for non-calibrated buildings", () => {
    const building: Buildings = {
      ...baseBuilding,
      name: "LIB",
      boundingBox: [
        { latitude: 45.4, longitude: -73.8 },
        { latitude: 45.8, longitude: -73.2 },
        { latitude: 45.6, longitude: -73.5 },
      ],
    };

    render(<IndoorSVGOverlay source={1} building={building} />);

    expect(screen.getByTestId("overlay")).toBeTruthy();
    expect(mapsMock.__overlaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        bounds: [
          [45.4, -73.8],
          [45.8, -73.2],
        ],
      }),
    );
  });

  it("returns null when calculated bounds are non-finite", () => {
    const building: Buildings = {
      ...baseBuilding,
      name: "BAD",
      boundingBox: [
        { latitude: Number.NaN, longitude: -73.2 },
        { latitude: Number.POSITIVE_INFINITY, longitude: -73.1 },
      ],
    };

    const { queryByTestId } = render(
      <IndoorSVGOverlay source={1} building={building} />,
    );

    expect(queryByTestId("overlay")).toBeNull();
    expect(mapsMock.__overlaySpy).not.toHaveBeenCalled();
  });

  it("converts string source into ImageURISource", () => {
    const building: Buildings = {
      ...baseBuilding,
      name: "LIB",
    };

    render(
      <IndoorSVGOverlay
        source={"file:///indoor/floor.png"}
        building={building}
      />,
    );

    expect(screen.getByTestId("overlay")).toBeTruthy();
    expect(mapsMock.__overlaySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { uri: "file:///indoor/floor.png" },
      }),
    );
  });
});
