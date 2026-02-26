import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import {
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";
import React from "react";
import CampusMap from "../components/CampusMap";
import { BUILDINGS } from "../constants/buildings";
import { WALKING_STRATEGY } from "../constants/strategies";
import { colors } from "../constants/theme";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";


jest.mock("expo-location", () => ({
  Accuracy: { Balanced: "Balanced" },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../services/GoogleDirectionsService", () => ({
  getOutdoorRouteWithSteps: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const Polyline = (props: any) => (
    <View testID={props.testID ?? "polyline"}>
      <Text testID={`${props.testID ?? "polyline"}-props`}>
        {JSON.stringify({
          coordinates: props.coordinates,
          strokeWidth: props.strokeWidth,
          strokeColor: props.strokeColor,
          lineDashPattern: props.lineDashPattern,
        })}
      </Text>
    </View>
  );

  const animateToRegion = jest.fn();

  const MapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion }));
    React.useEffect(() => {
      props.onMapReady?.();
    }, []);
    return (
      <View
        testID="map-view"
        onPress={props.onPress}
        onRegionChangeComplete={props.onRegionChangeComplete}
      >
        {props.children}
      </View>
    );
  });

  const Marker = (props: any) => {
    return (
      <View testID={props.testID ?? `marker-${props.title ?? "marker"}`}>
        <Text testID="marker-props">
          {JSON.stringify({
            coordinate: props.coordinate,
            title: props.title,
            pinColor: props.pinColor,
          })}
        </Text>

        {/* IMPORTANT: render children so label pills exist in the tree */}
        {props.children}
      </View>
    );
  };

  const Polygon = (props: any) => {
    const handlePress = () => props.onPress?.({ stopPropagation: jest.fn() });
    return (
      <View testID="polygon" onPress={handlePress}>
        <Text testID="polygon-style">
          {JSON.stringify({
            fillColor: props.fillColor,
            strokeColor: props.strokeColor,
            strokeWidth: props.strokeWidth,
          })}
        </Text>
      </View>
    );
  };

  return {
    __esModule: true,
    default: MapView,
    Marker,
    Polygon,
    Polyline,
    __animateToRegion: animateToRegion,
  };
});

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    {
      name: "A",
      campusName: "sgw",
      displayName: "Building A",
      address: "Address A",
      coordinates: { latitude: 10, longitude: 20 },
      boundingBox: [
        { latitude: 10, longitude: 20 },
        { latitude: 10.001, longitude: 20.001 },
        { latitude: 10.002, longitude: 20.002 },
      ],
    },
    {
      name: "B",
      campusName: "sgw",
      displayName: "Building B",
      address: "Address B",
      coordinates: { latitude: 11, longitude: 21 },
      boundingBox: [
        { latitude: 11, longitude: 21 },
        { latitude: 11.001, longitude: 21.001 },
        { latitude: 11.002, longitude: 21.002 },
      ],
    },
    {
      name: "C",
      campusName: "sgw",
      displayName: "Building C",
      address: "Address C",
      coordinates: { latitude: 12, longitude: 22 },
      boundingBox: [
        { latitude: 12, longitude: 22 },
        { latitude: 12.001, longitude: 22.001 },
        { latitude: 12.002, longitude: 22.002 },
      ],
    },
    {
      name: "EMPTY",
      campusName: "sgw",
      displayName: "Empty Building",
      address: "Address Empty",
      coordinates: { latitude: 13, longitude: 23 },
      boundingBox: [],
    },
  ],
}));

jest.mock("../utils/pointInPolygon", () => ({
  getBuildingContainingPoint: jest.fn(),
}));

jest.mock("../components/BuildingInfoPopup", () => {
  const React = require("react");
  const { Text, View, Pressable } = require("react-native");
  return {
    BuildingInfoPopup: ({
      building,
      onClose,
      onSetAsStart,
      onSetAsDestination,
    }: any) => {
      if (!building) return null;
      return (
        <View testID="building-info-popup">
          <Text testID="building-info-building-name">
            {building.displayName ?? building.name}
          </Text>
          <Pressable testID="building-info-set-start" onPress={() => onSetAsStart?.(building)}>
            <Text>Set as start</Text>
          </Pressable>
          <Pressable testID="building-info-set-dest" onPress={() => onSetAsDestination?.(building)}>
            <Text>Set as destination</Text>
          </Pressable>
          <Text testID="building-info-close" onPress={onClose}>
            close
          </Text>
        </View>
      );
    },
  };
});

const getMapsMock = () => jest.requireMock("react-native-maps") as any;

describe("CampusMap", () => {
  const coordinates = { latitude: 1, longitude: 2 };
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
    logSpy = jest.spyOn(console, "log").mockImplementation(() => { });

    (hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });
    (getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 50.0, longitude: -70.0 },
    });

    (getBuildingContainingPoint as jest.Mock).mockReturnValue(null);

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [],
      steps: [],
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  // --- Rendering basics ---

  it("renders the map and polygons (and warns on empty boundingBox)", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(screen.getByTestId("map-view")).toBeTruthy();
    expect(screen.getAllByTestId("polygon")).toHaveLength(3);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Building EMPTY has no boundingBox coordinates.",
      );
    });
  });

  // --- Location effect (loadCurrentLocation) ---

  it("shows an error when location services are disabled", async () => {
    (hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(
      await screen.findByText("Location services are disabled."),
    ).toBeTruthy();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId("marker-You are here")).toBeNull();
  });

  it("requests permissions and shows an error when permission is denied", async () => {
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(
      await screen.findByText("Permission to access location was denied."),
    ).toBeTruthy();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("sets user coords and renders the current location marker on success", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();
  });

  it("shows an error when current location cannot be retrieved", async () => {
    (getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error("boom"));

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(
      await screen.findByText("Unable to get your current location."),
    ).toBeTruthy();
  });

  // --- Region effect (animateToRegion) ---

  it("animates to campus coordinates when focusTarget is not user", async () => {
    const mapsMock = getMapsMock();

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    const lastCall = mapsMock.__animateToRegion.mock.calls.at(-1);
    expect(lastCall[0]).toEqual({
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    expect(lastCall[1]).toBe(250);
  });

  it("animates to user coordinates when focusTarget is user", async () => {
    const mapsMock = getMapsMock();

    render(<CampusMap coordinates={coordinates} focusTarget="user" strategy={WALKING_STRATEGY} showShuttle={false} />);

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    const lastCall = mapsMock.__animateToRegion.mock.calls.at(-1);
    expect(lastCall[0]).toEqual({
      latitude: 50.0,
      longitude: -70.0,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    expect(lastCall[1]).toBe(250);
  });

  //animate to building 

  it("animates to building location when a building is selected", async () => {
    const mapsMock = getMapsMock();
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]); // Select Building A

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 10 - 0.0011,
        }),
        300
      );
    });
  });

  it("calls onSetAsDestination and clears selected building when Set as destination is pressed", async () => {
    const onSetAsDestination = jest.fn();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        onSetAsDestination={onSetAsDestination} showShuttle={false}      />
    );

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    expect(screen.getByTestId("building-info-popup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("building-info-set-dest"));

    expect(onSetAsDestination).toHaveBeenCalledWith(
      expect.objectContaining({ name: "A" })
    );

    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  // --- Map/building interaction ---

  it("selects a building on polygon press and clears it on map press", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[1]);

    expect(screen.getByTestId("building-info-popup")).toBeTruthy();
    expect(screen.getByText("Building B")).toBeTruthy();

    fireEvent.press(screen.getByTestId("map-view"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  it("clears selection when the popup close is pressed", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    expect(screen.getByText("Building A")).toBeTruthy();

    fireEvent.press(screen.getByTestId("building-info-close"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  // --- Polygon styling (covers getPolygonStyle branches indirectly) ---

  it("applies current, selected, and default polygon styles", async () => {
    (getBuildingContainingPoint as jest.Mock).mockReturnValue(BUILDINGS[0]);

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    const polygons = await screen.findAllByTestId("polygon");

    // Select building B so we get selected + current + default simultaneously
    fireEvent.press(polygons[1]);

    await waitFor(() => {
      const styles = screen
        .getAllByTestId("polygon-style")
        .map((el) => JSON.parse(el.props.children));

      // A is current
      expect(styles[0]).toEqual({
        fillColor: colors.secondaryTransparent,
        strokeColor: colors.secondary,
        strokeWidth: 3,
      });

      // B is selected
      expect(styles[1]).toEqual({
        fillColor: colors.primaryLight,
        strokeColor: colors.primaryDark,
        strokeWidth: 5,
      });

      // C is default
      expect(styles[2]).toEqual({
        fillColor: colors.primaryTransparent,
        strokeColor: colors.primary,
        strokeWidth: 2,
      });
    });
  });

  // --- Start point and destination point markers ---

  it("renders start point marker when startPoint is provided", async () => {
    const startBuilding = BUILDINGS[0];

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={startBuilding}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    const markers = await screen.findAllByTestId(/^marker-/);

    // Should have both user location marker and start point marker
    expect(markers.length).toBeGreaterThanOrEqual(2);

    // The start point marker doesn't have a title, so it will be "marker-marker"
    const startMarker = markers.find((m) => m.props.testID === "marker-marker");
    expect(startMarker).toBeTruthy();
  });

  it("renders destination point marker when destinationPoint is provided", async () => {
    const destinationBuilding = BUILDINGS[1];

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        destinationPoint={destinationBuilding}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(await screen.findByTestId("marker-destination")).toBeTruthy();

    // Use within() to scope the query to the marker element
    const { getByTestId: getWithin } = within(
      screen.getByTestId("marker-destination"),
    );
    const props = JSON.parse(getWithin("marker-props").props.children);

    expect(props.coordinate).toEqual(destinationBuilding.coordinates);
  });

  it("renders both start and destination markers together", async () => {
    const startBuilding = BUILDINGS[0];
    const destinationBuilding = BUILDINGS[2];

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={startBuilding}
        destinationPoint={destinationBuilding}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    // Should have user location, start point, and destination
    const markers = await screen.findAllByTestId(/^marker-/);
    expect(markers.length).toBeGreaterThanOrEqual(3);

    expect(screen.getByTestId("marker-You are here")).toBeTruthy();
    expect(screen.getByTestId("marker-destination")).toBeTruthy();
  });

  it("does not render start or destination markers when not provided", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={undefined}
        destinationPoint={undefined}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    // Wait for the user location marker to confirm the component has settled
    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();

    // Neither the titled destination marker nor any start marker should be present
    expect(screen.queryByTestId("marker-start")).toBeNull();
    expect(screen.queryByTestId("marker-destination")).toBeNull();
  });

  it("sets route coordinates and renders polyline when route fetch succeeds", async () => {
    const startBuilding = BUILDINGS[0];
    const destinationBuilding = BUILDINGS[1];

    const mockRoute = [
      { latitude: 10.1, longitude: 20.1 },
      { latitude: 10.2, longitude: 20.2 },
    ];

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: mockRoute,
      steps: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={startBuilding}
        destinationPoint={destinationBuilding}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(getOutdoorRouteWithSteps).toHaveBeenCalledWith(
        startBuilding.coordinates,
        destinationBuilding.coordinates,
        WALKING_STRATEGY,
      );
    });

    const polyline = await screen.findByTestId("polyline-main");
    expect(polyline).toBeTruthy();

    const props = JSON.parse(
      screen.getByTestId("polyline-main-props").props.children,
    );

    expect(props.coordinates).toEqual(mockRoute);
  });

  it("applies dash pattern for transit mode polyline", async () => {
    const transitStrategy = { mode: "transit", icon: "bus", label: "Transit" };
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: []
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={transitStrategy as any}
        showShuttle={false}
      />
    );
    const polyline = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(polyline.props.children);
    expect(props.lineDashPattern).toEqual([8, 6]);
  });

  it("clears route and logs when route fetch fails", async () => {
    const startBuilding = BUILDINGS[0];
    const destinationBuilding = BUILDINGS[1];

    (getOutdoorRouteWithSteps as jest.Mock).mockRejectedValue(
      new Error("route failed"),
    );

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={startBuilding}
        destinationPoint={destinationBuilding}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(getOutdoorRouteWithSteps).toHaveBeenCalled();
    });

    expect(screen.queryByTestId("polyline")).toBeNull();
  });

  it("toggles labelsVisible correctly based on zoom thresholds", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false}/>);

    await screen.findByTestId("marker-You are here");
    const map = screen.getByTestId("map-view");

    const pillA = screen.getByTestId("label-pill-A");

    // initially hidden
    expect(pillA.props.pointerEvents).toBe("none");

    // zoom in => show
    fireEvent(map, "regionChangeComplete", {
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });

    await waitFor(() => {
      expect(screen.getByTestId("label-pill-A").props.pointerEvents).toBe("auto");
    });

    // zoom out => hide
    fireEvent(map, "regionChangeComplete", {
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });

    await waitFor(() => {
      expect(screen.getByTestId("label-pill-A").props.pointerEvents).toBe("none");
    });

    // zoom in again => show again
    fireEvent(map, "regionChangeComplete", {
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0.009,
      longitudeDelta: 0.009,
    });

    await waitFor(() => {
      expect(screen.getByTestId("label-pill-A").props.pointerEvents).toBe("auto");
    });
  });

  // --- Double polyline border rendering ---

  it("renders both border and main polylines for a route", async () => {
    const mockRoute = [
      { latitude: 10.1, longitude: 20.1 },
      { latitude: 10.2, longitude: 20.2 },
    ];

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: mockRoute,
      steps: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    const borderPolyline = await screen.findByTestId("polyline-border");
    const mainPolyline = screen.getByTestId("polyline-main");
    expect(borderPolyline).toBeTruthy();
    expect(mainPolyline).toBeTruthy();

    const borderProps = JSON.parse(
      screen.getByTestId("polyline-border-props").props.children,
    );
    const mainProps = JSON.parse(
      screen.getByTestId("polyline-main-props").props.children,
    );

    expect(borderProps.strokeWidth).toBe(8);
    expect(borderProps.strokeColor).toBe("black");
    expect(mainProps.strokeWidth).toBe(6);
    expect(mainProps.strokeColor).toBe(colors.routeWalk);
  });

  // --- Bicycling dash pattern ---

  it("applies bicycling dash pattern [4,4]", async () => {
    const bikeStrategy = { mode: "bicycling", icon: "bike", label: "Bike" };
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={bikeStrategy as any}
        showShuttle={false}
      />,
    );

    const mainProps = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(mainProps.props.children);
    expect(props.lineDashPattern).toEqual([4, 4]);
  });

  // --- Walking has no dash pattern ---

  it("has no dash pattern for walking mode", async () => {
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    const mainProps = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(mainProps.props.children);
    expect(props.lineDashPattern).toBeUndefined();
  });

  // --- userFocusCounter triggers re-animation ---

  it("re-animates to user location when userFocusCounter changes", async () => {
    const mapsMock = getMapsMock();

    const { rerender } = render(
      <CampusMap coordinates={coordinates} focusTarget="user" strategy={WALKING_STRATEGY} userFocusCounter={0} showShuttle={false}/>,
    );

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    mapsMock.__animateToRegion.mockClear();

    rerender(
      <CampusMap coordinates={coordinates} focusTarget="user" strategy={WALKING_STRATEGY} userFocusCounter={1} showShuttle={false}/>,
    );

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 50.0, longitude: -70.0 }),
        250,
      );
    });
  });

  // --- routeFocusTrigger centers on start point ---

  it("animates to start point when routeFocusTrigger changes", async () => {
    const mapsMock = getMapsMock();

    const { rerender } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        startPoint={BUILDINGS[0]}
        routeFocusTrigger={0}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    mapsMock.__animateToRegion.mockClear();

    rerender(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        startPoint={BUILDINGS[0]}
        routeFocusTrigger={1}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: BUILDINGS[0].coordinates.latitude,
          longitude: BUILDINGS[0].coordinates.longitude,
        }),
        500,
      );
    });
  });

  // --- Custom start marker with startDot ---

  it("renders start marker with testID marker-start", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(await screen.findByTestId("marker-start")).toBeTruthy();
  });

  // --- Custom destination marker with MaterialIcons children ---

  it("renders destination marker with MaterialIcons children", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    const destMarker = await screen.findByTestId("marker-destination");
    expect(destMarker).toBeTruthy();
    // The marker should have children (the pin wrapper with MaterialIcons)
    expect(destMarker.children.length).toBeGreaterThan(0);
  });

  // --- onSetAsStart callback ---

  it("calls onSetAsStart and clears selected building when Set as start is pressed", async () => {
    const onSetAsStart = jest.fn();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        onSetAsStart={onSetAsStart}
        showShuttle={false}
      />,
    );

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    expect(screen.getByTestId("building-info-popup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("building-info-set-start"));

    expect(onSetAsStart).toHaveBeenCalledWith(
      expect.objectContaining({ name: "A" }),
    );
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  // --- demoCurrentBuilding as current building ---

  it("uses demoCurrentBuilding as the current building for polygon styling", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        demoCurrentBuilding={BUILDINGS[1]}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      const styles = screen
        .getAllByTestId("polygon-style")
        .map((el) => JSON.parse(el.props.children));

      // B is current (demoCurrentBuilding)
      expect(styles[1]).toEqual({
        fillColor: colors.secondaryTransparent,
        strokeColor: colors.secondary,
        strokeWidth: 3,
      });

      // A is default
      expect(styles[0]).toEqual({
        fillColor: colors.primaryTransparent,
        strokeColor: colors.primary,
        strokeWidth: 2,
      });
    });
  });

  // --- No polylines when no route ---

  it("does not render polylines when no start/destination provided", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");

    expect(screen.queryByTestId("polyline-border")).toBeNull();
    expect(screen.queryByTestId("polyline-main")).toBeNull();
  });

  // --- onRouteSteps callback ---

  it("calls onRouteSteps with fetched steps", async () => {
    const onRouteSteps = jest.fn();
    const mockSteps = [{ instruction: "Walk north" }];

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: mockSteps,
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        onRouteSteps={onRouteSteps}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(onRouteSteps).toHaveBeenCalledWith(mockSteps);
    });
  });

  // --- Permission already granted (no re-request) ---

  it("does not re-request permission when already granted", async () => {
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false}/>);

    await screen.findByTestId("marker-You are here");

    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });


});
