import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import {
  IndoorDirectionsPanel,
  IndoorRouteOverlay,
} from "../components/IndoorRouteOverlay";
import type { NavigationRoute } from "../utils/indoorNavigation";
import { getRouteWaypointsForFloor } from "../utils/indoorNavigation";

jest.mock("../utils/indoorNavigation", () => ({
  getRouteWaypointsForFloor: jest.fn(),
}));

jest.mock("react-native-svg", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      React.createElement(View, { testID: "svg-root", ...props }, children),
    Polyline: (props: any) =>
      React.createElement(View, { testID: "svg-polyline", ...props }),
    Circle: (props: any) =>
      React.createElement(View, { testID: "svg-circle", ...props }),
    G: ({ children }: any) =>
      React.createElement(View, { testID: "svg-group" }, children),
  };
});

const mockedWaypoints = getRouteWaypointsForFloor as jest.Mock;

function makeRoute(overrides: Partial<NavigationRoute> = {}): NavigationRoute {
  return {
    origin: { id: "origin", floor: 1, label: "H-110", x: 10, y: 20 } as any,
    destination: { id: "dest", floor: 1, label: "H-220", x: 30, y: 40 } as any,
    path: { steps: [] } as any,
    segments: [],
    floors: [1],
    totalDistance: 100,
    fullyAccessible: true,
    estimatedSeconds: 125,
    ...overrides,
  };
}

function expandDirectionsPanel() {
  fireEvent.press(screen.getByLabelText("Expand directions steps"));
}

describe("IndoorRouteOverlay", () => {
  const stageLayout = {
    frameLeft: 100,
    frameTop: 200,
    frameWidth: 300,
    frameHeight: 400,
    scale: 2,
  };

  const floorBounds = {
    minX: 5,
    minY: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no points are available", () => {
    mockedWaypoints.mockReturnValue([]);

    const { queryByTestId } = render(
      <IndoorRouteOverlay
        route={makeRoute()}
        floor={1}
        coordinateScale={1}
        stageLayout={stageLayout}
        floorBounds={floorBounds}
      />,
    );

    expect(queryByTestId("svg-root")).toBeNull();
  });

  it("renders route polylines and endpoint markers", () => {
    mockedWaypoints.mockReturnValue([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);

    render(
      <IndoorRouteOverlay
        route={makeRoute()}
        floor={1}
        coordinateScale={1}
        stageLayout={stageLayout}
        floorBounds={floorBounds}
      />,
    );

    expect(screen.getByTestId("svg-root")).toBeTruthy();
    expect(screen.getAllByTestId("svg-polyline")).toHaveLength(2);
    expect(screen.getAllByTestId("svg-circle")).toHaveLength(4);

    const firstPolyline = screen.getAllByTestId("svg-polyline")[0];
    expect(firstPolyline.props.points).toBe("110,220 150,260");
  });

  it("does not render destination marker when route has one point", () => {
    mockedWaypoints.mockReturnValue([{ x: 10, y: 20 }]);

    render(
      <IndoorRouteOverlay
        route={makeRoute()}
        floor={1}
        coordinateScale={1}
        stageLayout={stageLayout}
        floorBounds={floorBounds}
      />,
    );

    expect(screen.getAllByTestId("svg-circle")).toHaveLength(2);
  });

  it("passes floor and coordinateScale to waypoint utility", () => {
    mockedWaypoints.mockReturnValue([{ x: 1, y: 1 }]);
    const route = makeRoute();

    render(
      <IndoorRouteOverlay
        route={route}
        floor={8}
        coordinateScale={0.5}
        stageLayout={stageLayout}
        floorBounds={floorBounds}
      />,
    );

    expect(mockedWaypoints).toHaveBeenCalledWith(route, 8, 0.5);
  });

  it("uses accessible route color branch when accessibleOnly is true", () => {
    mockedWaypoints.mockReturnValue([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);

    render(
      <IndoorRouteOverlay
        route={makeRoute()}
        floor={1}
        coordinateScale={1}
        stageLayout={stageLayout}
        floorBounds={floorBounds}
        accessibleOnly
      />,
    );

    const polylines = screen.getAllByTestId("svg-polyline");
    expect(polylines[1].props.stroke).toBe("#2e7d32");
  });
});

describe("IndoorDirectionsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title, formatted duration, and accessibility status", () => {
    const route = makeRoute({
      estimatedSeconds: 45,
      fullyAccessible: false,
      segments: [],
      origin: { label: "MB-1.210" } as any,
      destination: { label: "MB-2.330" } as any,
    });

    render(<IndoorDirectionsPanel route={route} />);

    expect(screen.getByText("MB-1.210 → MB-2.330")).toBeTruthy();
    expect(screen.getByText("45s walk · some inaccessible sections")).toBeTruthy();
    expect(screen.getByText("0 steps available")).toBeTruthy();
  });

  it("invokes onClose when close button is pressed", () => {
    const onClose = jest.fn();
    const route = makeRoute({
      segments: [],
      origin: { label: "H-100" } as any,
      destination: { label: "H-200" } as any,
    });

    render(<IndoorDirectionsPanel route={route} onClose={onClose} />);

    fireEvent.press(screen.getByLabelText("Close directions"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("starts collapsed and expands to show segment rows", () => {
    const route = makeRoute({
      estimatedSeconds: 125,
      fullyAccessible: true,
      segments: [
        {
          kind: "walk",
          description: "Walk along corridor",
          nodeIds: ["a", "b"],
          floor: 3,
          distance: 120,
        },
        {
          kind: "stairs",
          description: "Take stairs up",
          nodeIds: ["b", "c"],
          floor: 3,
          distance: 0,
        },
      ],
      origin: { label: "H-100" } as any,
      destination: { label: "H-200" } as any,
    });

    render(<IndoorDirectionsPanel route={route} />);

    expect(screen.getByText("2m 5s walk · fully accessible")).toBeTruthy();
    expect(screen.getByText("2 steps available")).toBeTruthy();
    expect(screen.queryByText("Step 1")).toBeNull();

    expandDirectionsPanel();

    expect(screen.getByLabelText("Collapse directions steps")).toBeTruthy();
    expect(screen.getByText("Step 1")).toBeTruthy();
    expect(screen.getByText("Walk along corridor")).toBeTruthy();
    expect(screen.getByText("Floor 3 · ~12m")).toBeTruthy();
    expect(screen.getByText("🪜")).toBeTruthy();
    expect(screen.getByText("Take stairs up")).toBeTruthy();
  });

  it("formats exact-minute durations and hides close button when no onClose is provided", () => {
    const route = makeRoute({
      estimatedSeconds: 120,
      fullyAccessible: true,
      segments: [],
      origin: { label: "H-100" } as any,
      destination: { label: "H-200" } as any,
    });

    render(<IndoorDirectionsPanel route={route} />);

    expect(screen.getByText("2m walk · fully accessible")).toBeTruthy();
    expect(screen.queryByLabelText("Close directions")).toBeNull();
  });

  it("uses fallback icon and omits walk meta when distance is zero", () => {
    const route = makeRoute({
      estimatedSeconds: 61,
      fullyAccessible: true,
      segments: [
        {
          kind: "walk",
          description: "Short walk",
          nodeIds: ["a"],
          floor: 1,
          distance: 0,
        },
        {
          kind: "mystery" as any,
          description: "Unknown segment",
          nodeIds: ["x"],
          floor: 1,
          distance: 0,
        },
      ],
      origin: { label: "H-100" } as any,
      destination: { label: "H-200" } as any,
    });

    render(<IndoorDirectionsPanel route={route} />);

    expandDirectionsPanel();

    expect(screen.queryByText("Floor 1 · ~0m")).toBeNull();
    expect(screen.getByText("•")).toBeTruthy();
    expect(screen.getByText("Unknown segment")).toBeTruthy();
  });
});
