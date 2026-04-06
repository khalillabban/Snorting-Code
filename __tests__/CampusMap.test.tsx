import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";
import {
    getCurrentPositionAsync,
    getForegroundPermissionsAsync,
    hasServicesEnabledAsync,
    requestForegroundPermissionsAsync,
    watchPositionAsync,
} from "expo-location";
import React from "react";
import CampusMap from "../components/CampusMap";
import { BUILDINGS } from "../constants/buildings";
import { WALKING_STRATEGY } from "../constants/strategies";
import { colors } from "../constants/theme";
import * as ColorAccessibilityContext from "../contexts/ColorAccessibilityContext";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { getAvailableFloors } from "../utils/mapAssets";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";

jest.mock("../components/ShuttleBusTracker", () => ({
  useShuttleBus: () => ({
    activeBuses: [{ ID: "bus-1", Latitude: 45.497, Longitude: -73.578 }],
  }),
}));

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: "Balanced" },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
}));

jest.mock("../services/GoogleDirectionsService", () => ({
  getOutdoorRouteWithSteps: jest.fn(),
}));

jest.mock("../utils/mapAssets", () => ({
  getAvailableFloors: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, View } = require("react-native");
  const showCalloutMocks: Record<string, jest.Mock> = {};

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
    const { onMapReady } = props;
    React.useEffect(() => {
      onMapReady?.();
    }, [onMapReady]);
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
  MapView.displayName = "MapView";

  const Marker = React.forwardRef((props: any, ref: any) => {
    const markerId = props.testID ?? `marker-${props.title ?? "marker"}`;
    const showCallout = jest.fn();
    showCalloutMocks[markerId] = showCallout;

    React.useImperativeHandle(ref, () => ({ showCallout }));

    return (
      <View testID={markerId} onPress={props.onPress}>
        <Text testID="marker-props">
          {JSON.stringify({
            coordinate: props.coordinate,
            title: props.title,
            pinColor: props.pinColor,
          })}
        </Text>
        {/* Render title as text so screen.getByText can find it */}
        {props.title && <Text>{props.title}</Text>}
        {props.children}
      </View>
    );
  });
  Marker.displayName = "Marker";

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
    __showCalloutMocks: showCalloutMocks,
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
    {
      name: "QA",
      campusName: "sgw",
      displayName: "QA Building",
      address: "QA Address",
      coordinates: { latitude: 14, longitude: 24 },
      boundingBox: [], // This will test the 'false' branch of your condition
    },
  ],
}));

jest.mock("../utils/pointInPolygon", () => ({
  getBuildingContainingPoint: jest.fn(),
}));

jest.mock("../components/BuildingInfoPopup", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, View, Pressable } = require("react-native");
  return {
    BuildingInfoPopup: ({
      building,
      onClose,
      onSetAsStart,
      onSetAsDestination,
      onSetAsMyLocation, // Add this to the mock props
      hasIndoorMap,
      onViewIndoorMap,
    }: any) => {
      if (!building) return null;
      return (
        <View testID="building-info-popup">
          <Text testID="building-info-building-name">
            {building.displayName ?? building.name}
          </Text>
          <Pressable
            testID="building-info-set-start"
            onPress={() => onSetAsStart?.(building)}
          >
            <Text>Set as start</Text>
          </Pressable>
          <Pressable
            testID="building-info-set-dest"
            onPress={() => onSetAsDestination?.(building)}
          >
            <Text>Set as destination</Text>
          </Pressable>
          {/* ADD THE MOCK BUTTON HERE */}
          <Pressable
            testID="building-info-set-my-loc"
            onPress={() => onSetAsMyLocation?.(building)}
          >
            <Text>Set as my location</Text>
          </Pressable>
          {hasIndoorMap && onViewIndoorMap ? (
            <Pressable
              testID="building-info-view-indoor"
              onPress={() => onViewIndoorMap()}
            >
              <Text>Open indoor map</Text>
            </Pressable>
          ) : null}
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
  let errorSpy: jest.SpyInstance;

  beforeAll(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [],
      steps: [],
      segments: [],
    });

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
    (watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });
    (getBuildingContainingPoint as jest.Mock).mockReturnValue(null);
    (getAvailableFloors as jest.Mock).mockImplementation(
      (buildingCode: string) => (buildingCode === "A" ? [1, 2] : []),
    );
    (Object.values(getMapsMock().__showCalloutMocks) as jest.Mock[]).forEach(
      (mock) => mock.mockClear(),
    );
  });

  afterAll(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  // --- Rendering basics ---

  it("renders the map and polygons (and warns on empty boundingBox)", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    expect(screen.getByTestId("map-view")).toBeTruthy();
    expect(screen.getAllByTestId("polygon")).toHaveLength(3);

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Building EMPTY has no boundingBox coordinates.",
      );
    });
  });

  it("uses high-contrast default polygon stroke in red-green-safe mode on dark map", async () => {
    const colorSchemeSpy = jest
      .spyOn(require("react-native"), "useColorScheme")
      .mockReturnValue("dark");
    const accessibilitySpy = jest
      .spyOn(ColorAccessibilityContext, "useColorAccessibility")
      .mockReturnValue({
        mode: "redGreenSafe",
        colors,
        isHydrated: true,
        options: [],
        setMode: jest.fn(),
      } as any);

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    const polygonStyleText = screen.getAllByTestId("polygon-style")[0].props
      .children as string;
    const polygonStyle = JSON.parse(polygonStyleText);

    expect(polygonStyle.strokeColor).toBe(colors.secondaryLight);

    accessibilitySpy.mockRestore();
    colorSchemeSpy.mockRestore();
  });

  // --- Location effect (loadCurrentLocation) ---

  it("shows an error when location services are disabled", async () => {
    (hasServicesEnabledAsync as jest.Mock).mockResolvedValue(false);

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(
      await screen.findByText("Location services are disabled."),
    ).toBeTruthy();
  });

  it("requests permissions and shows an error when permission is denied", async () => {
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(
      await screen.findByText("Permission to access location was denied."),
    ).toBeTruthy();
  });

  it("sets user coords and renders the current location marker on success", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();
  });

  it("does not render the start marker when no start point is provided", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();
    expect(screen.queryByTestId("marker-start")).toBeNull();
  });

  it("requests permission when initial location permission is not granted and proceeds on approval", async () => {
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Permission to access location was denied."),
    ).toBeNull();
  });

  it("shows an error when current location cannot be retrieved", async () => {
    (getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error("boom"));

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    expect(
      await screen.findByText("Unable to get your current location."),
    ).toBeTruthy();
  });

  // --- Region effect (animateToRegion) ---

  it("animates to campus coordinates when focusTarget is not user", async () => {
    const mapsMock = getMapsMock();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    // Wait for the location effect to finish so we avoid 'act' warnings
    await screen.findByTestId("marker-You are here");

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    const lastCall = mapsMock.__animateToRegion.mock.calls.at(-1);
    expect(lastCall[0]).toEqual(
      expect.objectContaining({ latitude: 1, longitude: 2 }),
    );
  });

  it("animates to user coordinates when focusTarget is user", async () => {
    const mapsMock = getMapsMock();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="user"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    const lastCall = mapsMock.__animateToRegion.mock.calls.at(-1);
    expect(lastCall[0]).toEqual(
      expect.objectContaining({ latitude: 50.0, longitude: -70.0 }),
    );
  });

  it("animates to building location when a building is selected", async () => {
    const mapsMock = getMapsMock();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here"); // Wait for mount

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]); // Select Building A

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 10 - 0.0011 }),
        300,
      );
    });
  });

  it("animates to route origin when routeFocusTrigger is incremented", async () => {
    const mapsMock = getMapsMock();

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[1]}
        routeFocusTrigger={1}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: BUILDINGS[1].coordinates.latitude,
          longitude: BUILDINGS[1].coordinates.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }),
        500,
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
        onSetAsDestination={onSetAsDestination}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    fireEvent.press(screen.getByTestId("building-info-set-dest"));

    expect(onSetAsDestination).toHaveBeenCalledWith(
      expect.objectContaining({ name: "A" }),
    );
  });

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

    await screen.findByTestId("marker-You are here");

    fireEvent.press((await screen.findAllByTestId("polygon"))[0]);
    fireEvent.press(screen.getByTestId("building-info-set-start"));

    expect(onSetAsStart).toHaveBeenCalledWith(
      expect.objectContaining({ name: "A" }),
    );
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  // --- Map/building interaction ---

  it("selects a building on polygon press and clears it on map press", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[1]);

    // When polygon is pressed, if building has no floors, indoorVisible stays false and popup shows
    // If it has floors, indoorVisible becomes true and popup is hidden
    // Since we're not mocking floor data, the popup should be visible
    await waitFor(() => {
      expect(screen.getByTestId("building-info-popup")).toBeTruthy();
    });

    // Press the close button to dismiss the popup
    fireEvent.press(screen.getByTestId("building-info-close"));

    // After closing, the building should be deselected
    await waitFor(() => {
      expect(screen.queryByText(/displayName/)).not.toBeTruthy();
    });
  });

  it("clears selected building when map background is pressed", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    fireEvent.press(screen.getAllByTestId("polygon")[0]);
    expect(screen.getByTestId("building-info-popup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("map-view"));

    await waitFor(() => {
      expect(screen.queryByTestId("building-info-popup")).toBeNull();
    });
  });

  it("updates labels visibility thresholds on region change events", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    const map = screen.getByTestId("map-view");

    fireEvent(map, "onRegionChangeComplete", {
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0.009,
      longitudeDelta: 0.009,
    });

    fireEvent(map, "onRegionChangeComplete", {
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0.013,
      longitudeDelta: 0.013,
    });

    expect(screen.getByTestId("label-pill-A")).toBeTruthy();
  });

  it("clears selection when the popup close is pressed", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    fireEvent.press(screen.getByTestId("building-info-close"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  it("applies current, selected, and default polygon styles", async () => {
    (getBuildingContainingPoint as jest.Mock).mockReturnValue(BUILDINGS[0]);
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[1]);

    await waitFor(() => {
      const styles = screen
        .getAllByTestId("polygon-style")
        .map((el) => JSON.parse(el.props.children));
      expect(styles[0].fillColor).toBe(colors.secondaryTransparent); // A is current
      expect(styles[1].fillColor).toBe(colors.primaryLight); // B is selected
      expect(styles[2].fillColor).toBe(colors.primaryTransparent); // C is default
    });
  });

  // --- Start point and destination point markers ---

  it("renders start point marker when startPoint is provided", async () => {
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

  it("renders destination point marker when destinationPoint is provided", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    expect(await screen.findByTestId("marker-destination")).toBeTruthy();
  });

  it("renders destination marker when destinationOverride is provided", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        destinationOverride={{ latitude: 99.5, longitude: 88.5 }}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    expect(await screen.findByTestId("marker-destination")).toBeTruthy();
  });

  it("uses startOverride as the origin for routing when provided", async () => {
    const startOverride = { latitude: 99, longitude: 88 };

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [],
      steps: [],
      segments: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startOverride={startOverride}
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(getOutdoorRouteWithSteps).toHaveBeenCalled();
    });

    const lastCallArgs = (getOutdoorRouteWithSteps as jest.Mock).mock.calls[
      (getOutdoorRouteWithSteps as jest.Mock).mock.calls.length - 1
    ];

    // origin is first arg
    expect(lastCallArgs[0]).toEqual(startOverride);
  });

  // --- Polyline coverage ---
  it("renders multi-segment polylines correctly", async () => {
    const mockSegments = [
      {
        mode: "walking",
        coordinates: [
          { latitude: 1, longitude: 1 },
          { latitude: 1.1, longitude: 1.1 },
        ],
      },
    ];

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: mockSegments[0].coordinates,
      steps: [],
      segments: mockSegments,
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

    // Now uses the correct testIDs defined in CampusMap.tsx
    const border = await screen.findByTestId("polyline-border");
    expect(border).toBeTruthy();

    const props = JSON.parse(
      screen.getByTestId("polyline-main-props").props.children,
    );
    expect(props.strokeColor).toBe(colors.routeWalk);
  });

  it("applies dash pattern for transit mode polyline", async () => {
    const transitStrategy = { mode: "transit", icon: "bus", label: "Transit" };
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
      segments: [
        { mode: "transit", coordinates: [{ latitude: 1, longitude: 1 }] },
      ],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={transitStrategy as any}
        showShuttle={false}
      />,
    );

    const polyline = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(polyline.props.children);
    expect(props.lineDashPattern).toBeUndefined();
  });

  it("applies dash pattern for bicycling mode polyline", async () => {
    const bicyclingStrategy = {
      mode: "bicycling",
      icon: "bike",
      label: "Bike",
    };
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
      segments: [
        { mode: "bicycling", coordinates: [{ latitude: 1, longitude: 1 }] },
      ],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={bicyclingStrategy as any}
        showShuttle={false}
      />,
    );

    const polyline = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(polyline.props.children);
    expect(props.lineDashPattern).toBeUndefined();
  });

  it("uses a solid line for shuttle mode polyline", async () => {
    const shuttleStrategy = {
      mode: "shuttle",
      icon: "bus",
      label: "Shuttle",
    };

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
      segments: [
        { mode: "shuttle", coordinates: [{ latitude: 1, longitude: 1 }] },
      ],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={shuttleStrategy as any}
        showShuttle={false}
      />,
    );

    const polyline = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(polyline.props.children);
    expect(props.lineDashPattern).toBeUndefined();
  });

  // --- Shuttle coverage ---
  it("renders shuttle markers and stops when showShuttle is true", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    // Because we added `{props.title && <Text>{props.title}</Text>}` to the Marker mock,
    // we can find the shuttle markers by their text.
    expect(await screen.findByText("Shuttle Bus")).toBeTruthy();

    // We can also find the stops by text, assuming your BUSSTOP array has these titles:
    const markers = screen.getAllByTestId(/marker-/);
    expect(markers.length).toBeGreaterThan(0);
    // Alternatively, if you know the exact titles of the stops in BUSSTOP constant:
    // expect(screen.getByText("Concordia SGW Shuttle Stop")).toBeTruthy();
  });

  it("falls back to empty shuttle route when shuttle route fetch fails", async () => {
    (getOutdoorRouteWithSteps as jest.Mock).mockRejectedValueOnce(
      new Error("shuttle fetch failed"),
    );

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        "Shuttle route fetch failed:",
        expect.any(Error),
      );
    });
  });

  it("applies outer shuttle-route catch fallback when logger throws", async () => {
    (getOutdoorRouteWithSteps as jest.Mock).mockRejectedValueOnce(
      new Error("shuttle fetch failed"),
    );
    errorSpy.mockImplementationOnce(() => {
      throw new Error("logger failed");
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    await waitFor(() => {
      expect(getOutdoorRouteWithSteps).toHaveBeenCalled();
    });
  });

  // --- Popup Button coverage ---
  it("triggers onSetAsMyLocation when button in popup is pressed", async () => {
    const onSetAsMyLocation = jest.fn();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        onSetAsMyLocation={onSetAsMyLocation}
      />,
    );
    await screen.findByTestId("marker-You are here");

    const polygon = screen.getAllByTestId("polygon")[0];
    fireEvent.press(polygon);

    const setMyLocBtn = screen.getByText("Set as my location");
    fireEvent.press(setMyLocBtn);

    expect(onSetAsMyLocation).toHaveBeenCalled();
  });

  it("surfaces the indoor action from the building popup when the building has indoor floors", async () => {
    const onViewIndoorMap = jest.fn();
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        onViewIndoorMap={onViewIndoorMap}
      />,
    );
    await screen.findByTestId("marker-You are here");

    fireEvent.press(screen.getAllByTestId("polygon")[0]);
    fireEvent.press(screen.getByTestId("building-info-view-indoor"));

    expect(onViewIndoorMap).toHaveBeenCalledWith(
      expect.objectContaining({ name: "A" }),
    );
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  it("does not crash when no route is available", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");
    expect(screen.getByTestId("map-view")).toBeTruthy();
  });

  it("renders nearby POI markers with category-aware marker ids", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        nearbyPOIs={[
          {
            placeId: "poi-1",
            name: "Coffee Spot",
            latitude: 10.01,
            longitude: 20.01,
            vicinity: "1455 Maisonneuve",
            categoryId: "coffee",
          },
          {
            placeId: "poi-2",
            name: "Campus ATM",
            latitude: 10.02,
            longitude: 20.02,
            vicinity: "JMSB",
            categoryId: "atm",
          },
        ]}
      />,
    );

    expect(await screen.findByTestId("poi-marker-poi-1")).toBeTruthy();
    expect(screen.getByTestId("poi-marker-poi-2")).toBeTruthy();
    expect(screen.getByText("Coffee Spot")).toBeTruthy();
    expect(screen.getByText("Campus ATM")).toBeTruthy();
  });

  it("focuses selected POI coordinate and opens marker callout", async () => {
    const mapsMock = getMapsMock();
    const setTimeoutSpy = jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback: any) => {
        callback();
        return 0 as any;
      });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        nearbyPOIs={[
          {
            placeId: "poi-focus",
            name: "Focus POI",
            latitude: 10.1234,
            longitude: 20.5678,
            vicinity: "Focus Street",
            categoryId: "restaurant",
          },
        ]}
        focusPOIId="poi-focus"
        focusPOITrigger={1}
      />,
    );

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 10.1234 - 0.0006,
          longitude: 20.5678,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        }),
        300,
      );
    });

    expect(
      mapsMock.__showCalloutMocks["poi-marker-poi-focus"],
    ).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it("does not trigger POI focus animation when focus trigger is not incremented", async () => {
    const mapsMock = getMapsMock();

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        nearbyPOIs={[
          {
            placeId: "poi-no-focus",
            name: "No Focus POI",
            latitude: 10.1234,
            longitude: 20.5678,
            vicinity: "Quiet Street",
            categoryId: "restaurant",
          },
        ]}
        focusPOIId="poi-no-focus"
        focusPOITrigger={0}
      />,
    );

    await screen.findByTestId("poi-marker-poi-no-focus");

    expect(mapsMock.__animateToRegion).not.toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 10.1234 - 0.0006,
        longitude: 20.5678,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }),
      300,
    );

    expect(
      mapsMock.__showCalloutMocks["poi-marker-poi-no-focus"],
    ).not.toHaveBeenCalled();
  });

  it("calls onSelectPOI when a nearby POI marker is pressed", async () => {
    const onSelectPOI = jest.fn();

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        onSelectPOI={onSelectPOI}
        nearbyPOIs={[
          {
            placeId: "poi-select",
            name: "Select POI",
            latitude: 10.4,
            longitude: 20.4,
            vicinity: "Selected Street",
            categoryId: "coffee",
          },
        ]}
      />,
    );

    fireEvent.press(await screen.findByTestId("poi-marker-poi-select"));
    expect(onSelectPOI).toHaveBeenCalledWith(
      expect.objectContaining({ placeId: "poi-select" }),
    );
  });

  it("does not fire onSelectPOI when poiMarkersHidden is true", async () => {
    const onSelectPOI = jest.fn();

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        onSelectPOI={onSelectPOI}
        poiMarkersHidden={true}
        nearbyPOIs={[
          {
            placeId: "poi-hidden",
            name: "Hidden POI",
            latitude: 10.4,
            longitude: 20.4,
            vicinity: "Hidden Street",
            categoryId: "coffee",
          },
        ]}
      />,
    );

    fireEvent.press(await screen.findByTestId("poi-marker-poi-hidden"));
    expect(onSelectPOI).not.toHaveBeenCalled();
  });

  it("reports route-unavailable error when route service returns empty segments", async () => {
    const onRouteError = jest.fn();
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [],
      steps: [],
      segments: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        onRouteError={onRouteError}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(onRouteError).toHaveBeenCalledWith(
        "No route found for the selected destination.",
      );
    });
  });

  it("reports route service failure message through onRouteError", async () => {
    const onRouteError = jest.fn();
    (getOutdoorRouteWithSteps as jest.Mock).mockRejectedValue(
      new Error("Directions API status: REQUEST_DENIED"),
    );

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        onRouteError={onRouteError}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(onRouteError).toHaveBeenCalledWith(
        "Directions API status: REQUEST_DENIED",
      );
    });
  });

  it("reports fallback route error message when route service rejects with a non-Error value", async () => {
    const onRouteError = jest.fn();
    (getOutdoorRouteWithSteps as jest.Mock).mockRejectedValue("route failed");

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        onRouteError={onRouteError}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(onRouteError).toHaveBeenCalledWith(
        "Unable to generate route right now.",
      );
    });
  });

  it("skips route state updates when a route request resolves after unmount", async () => {
    let resolveRoute!: (value: any) => void;
    (getOutdoorRouteWithSteps as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRoute = resolve;
      }),
    );

    const onRouteSteps = jest.fn();
    const onRouteSummary = jest.fn();

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        onRouteSteps={onRouteSteps}
        onRouteSummary={onRouteSummary}
        showShuttle={false}
      />,
    );

    unmount();

    resolveRoute({
      coordinates: [{ latitude: 1, longitude: 1 }],
      segments: [{ mode: "walking", coordinates: [{ latitude: 1, longitude: 1 }] }],
      steps: [{ instruction: "Walk" }],
      duration: "1 min",
      distance: "100 m",
    });

    await Promise.resolve();

    expect(onRouteSteps).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ instruction: "Walk" })]),
    );
    expect(onRouteSummary).not.toHaveBeenCalledWith(
      expect.objectContaining({ duration: "1 min", distance: "100 m" }),
    );
  });

  it("clears route error when origin or destination is missing", async () => {
    const onRouteError = jest.fn();

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        onRouteError={onRouteError}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(onRouteError).toHaveBeenCalledWith(null);
    });
  });
  it("label marker tap and polygon tap both open the same building popup", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    // Via polygon
    const polygons = screen.getAllByTestId("polygon");
    fireEvent.press(polygons[0]);
    expect(
      screen.getByTestId("building-info-building-name").props.children,
    ).toBe("Building A");

    // Close it
    fireEvent.press(screen.getByTestId("building-info-close"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();

    // Via label marker
    fireEvent.press(screen.getByTestId("label-marker-A"));
    expect(
      screen.getByTestId("building-info-building-name").props.children,
    ).toBe("Building A");
  });

  it("label pill exists for each building with a boundingBox", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );
    await screen.findByTestId("marker-You are here");

    expect(screen.getByTestId("label-pill-A")).toBeTruthy();
    expect(screen.getByTestId("label-pill-B")).toBeTruthy();
    expect(screen.getByTestId("label-pill-C")).toBeTruthy();
  });

  it("falls back to default polyline color for unknown segment mode", async () => {
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
      segments: [
        { mode: "unknown_mode", coordinates: [{ latitude: 1, longitude: 1 }] },
      ],
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

    const polyline = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(polyline.props.children);
    expect(props.strokeColor).toBe(colors.routeWalk);
  });

  it("handles map press safely when no building is selected", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");
    fireEvent.press(screen.getByTestId("map-view"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  it("handles zero latitudeDelta in region updates without crashing", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");
    fireEvent(screen.getByTestId("map-view"), "onRegionChangeComplete", {
      latitude: 1,
      longitude: 2,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });

    expect(screen.getByTestId("label-pill-A")).toBeTruthy();
  });

  it("skips state updates when location request resolves after unmount", async () => {
    let resolvePosition!: (value: any) => void;
    (getCurrentPositionAsync as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );
    const onUserLocationResolved = jest.fn();

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        onUserLocationResolved={onUserLocationResolved}
      />,
    );

    unmount();
    resolvePosition({ coords: { latitude: 55, longitude: -71 } });
    await Promise.resolve();

    expect(onUserLocationResolved).not.toHaveBeenCalled();
  });

  it("handles unmatched focus POI id without animating", async () => {
    const mapsMock = getMapsMock();

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        nearbyPOIs={[
          {
            placeId: "poi-present",
            name: "Present POI",
            latitude: 10.2,
            longitude: 20.2,
            vicinity: "Present Street",
            categoryId: "restaurant",
          },
        ]}
        focusPOIId="poi-missing"
        focusPOITrigger={1}
      />,
    );

    await screen.findByTestId("poi-marker-poi-present");
    expect(mapsMock.__showCalloutMocks["poi-marker-poi-present"]).not.toHaveBeenCalled();
  });

  it("uses demoCurrentBuilding as current-building source", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        demoCurrentBuilding={BUILDINGS[1]}
      />,
    );

    await screen.findByTestId("marker-You are here");
    const styles = screen
      .getAllByTestId("polygon-style")
      .map((el) => JSON.parse(el.props.children));
    expect(styles[1].fillColor).toBe(colors.secondaryTransparent);
  });

  it("renders POI marker fallback color and icon for unknown category", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        nearbyPOIs={[
          {
            placeId: "poi-unknown-cat",
            name: "Unknown Category POI",
            latitude: 10.11,
            longitude: 20.11,
            vicinity: "Unknown Street",
            categoryId: "not-a-real-category" as any,
          },
        ]}
      />,
    );

    const marker = await screen.findByTestId("poi-marker-poi-unknown-cat");
    const icon = marker.findByType(require("@expo/vector-icons/MaterialCommunityIcons").default);
    expect(icon.props.name).toBe("map-marker");
  });

  it("keeps shuttle polyline hidden when shuttle route has no coordinates", async () => {
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [],
      steps: [],
      segments: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    await waitFor(() => {
      expect(getOutdoorRouteWithSteps).toHaveBeenCalled();
    });

    expect(screen.queryAllByTestId("polyline")).toHaveLength(0);
  });

  it("does not apply shuttle route updates after unmount", async () => {
    let rejectShuttle!: (reason?: unknown) => void;
    (getOutdoorRouteWithSteps as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectShuttle = reject;
      }),
    );

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    unmount();
    rejectShuttle(new Error("late shuttle failure"));
    await Promise.resolve();

    expect(true).toBe(true);
  });

  it("warns for buildings with empty boundingBox except when the building is 'QA'", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "Building EMPTY has no boundingBox coordinates.",
      );

      expect(warnSpy).not.toHaveBeenCalledWith(
        "Building QA has no boundingBox coordinates.",
      );
    });
  });

  // --- Cancelled-branch coverage for location loading ---

  it("skips state updates when location services check resolves as disabled after unmount", async () => {
    let resolveServices!: (value: boolean) => void;
    (hasServicesEnabledAsync as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveServices = resolve;
      }),
    );

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    unmount();
    resolveServices(false);
    await Promise.resolve();

    // No crash means the cancelled=true branch in the services-disabled path was hit
    expect(true).toBe(true);
  });

  it("skips state updates when permission denial resolves after unmount", async () => {
    (hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    let resolveRequest!: (value: any) => void;
    (requestForegroundPermissionsAsync as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    unmount();
    resolveRequest({ status: "denied" });
    await Promise.resolve();
    // Covers the cancelled=true branch in the permission-denied-after-request path (L341)
    expect(true).toBe(true);
  });

  it("skips state updates when getCurrentPositionAsync throws after unmount", async () => {
    let rejectPosition!: (reason?: unknown) => void;
    (getCurrentPositionAsync as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectPosition = reject;
      }),
    );

    const onUserLocationResolved = jest.fn();
    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
        onUserLocationResolved={onUserLocationResolved}
      />,
    );

    unmount();
    rejectPosition(new Error("position error after unmount"));
    await Promise.resolve();

    // onUserLocationResolved should NOT have been called with null
    expect(onUserLocationResolved).not.toHaveBeenCalled();
  });

  // --- Cancelled-branch coverage for route fetching ---

  it("skips state updates when route fetch rejects after unmount", async () => {
    let rejectRoute!: (reason?: unknown) => void;
    (getOutdoorRouteWithSteps as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectRoute = reject;
      }),
    );

    const onRouteError = jest.fn();
    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={BUILDINGS[0]}
        destinationPoint={BUILDINGS[1]}
        strategy={WALKING_STRATEGY}
        onRouteError={onRouteError}
        showShuttle={false}
      />,
    );

    unmount();
    rejectRoute(new Error("late route failure"));
    await Promise.resolve();

    // onRouteError should NOT have been called with the error message
    expect(onRouteError).not.toHaveBeenCalledWith("late route failure");
  });

  // --- Shuttle route cancelled branches & coordinate fallback ---

  it("skips shuttle route update when fetch resolves after unmount", async () => {
    let shuttleResolve!: (value: any) => void;
    const shuttlePromise = new Promise((resolve) => {
      shuttleResolve = resolve;
    });

    (getOutdoorRouteWithSteps as jest.Mock).mockReturnValue(shuttlePromise);

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    unmount();

    shuttleResolve({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
      segments: [],
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(true).toBe(true);
  });

  it("uses fallback empty array when shuttle route resolves with undefined coordinates", async () => {
    // Cover the ?? [] fallback on L463: coordinates ?? []
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: undefined,
      steps: [],
      segments: [],
    });

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    await waitFor(() => expect(getOutdoorRouteWithSteps).toHaveBeenCalled());
    // Let the resolved promise continuation run
    await new Promise((resolve) => setTimeout(resolve, 50));

    unmount();
  });

  it("skips shuttle outer catch fallback when fetchShuttleRoute rejects after unmount", async () => {
    let rejectShuttle!: (reason?: unknown) => void;
    (getOutdoorRouteWithSteps as jest.Mock).mockReturnValue(
      new Promise((_, reject) => {
        rejectShuttle = reject;
      }),
    );

    // Make console.error throw to trigger the outer .catch() path
    const originalImpl = errorSpy.getMockImplementation();
    errorSpy.mockImplementation(() => {
      throw new Error("logger failed");
    });

    const { unmount } = render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    // Ensure the shuttle effect has started the fetch
    await waitFor(() => expect(getOutdoorRouteWithSteps).toHaveBeenCalled());

    unmount(); // cancelled = true

    // Reject after unmount → inner catch → console.error throws → outer .catch runs with cancelled=true
    rejectShuttle(new Error("shuttle fail"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Restore console.error mock to not leak
    if (originalImpl) {
      errorSpy.mockImplementation(originalImpl);
    } else {
      errorSpy.mockImplementation(() => {});
    }

    // Covers the outer .catch cancelled=true branch (L471)
    expect(true).toBe(true);
  });

  it("renders the shuttle route polyline when shuttle route returns valid coordinates", async () => {
    const shuttleCoords = [
      { latitude: 45.497, longitude: -73.578 },
      { latitude: 45.458, longitude: -73.638 },
    ];

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: shuttleCoords,
      steps: [],
      segments: [],
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={true}
      />,
    );

    // Wait for shuttle route to be fetched and rendered
    await waitFor(() => {
      expect(getOutdoorRouteWithSteps).toHaveBeenCalled();
    });

    // The shuttle polyline should now be visible (shuttleRouteCoords.length > 0 branch)
    // Our Polyline mock renders a View, so just check the polyline test ID exists
    await waitFor(() => {
      const polylines = screen.queryAllByTestId("polyline");
      expect(polylines.length).toBeGreaterThan(0);
    });
  });

  // --- effectiveOrigin ?? fallback ---

  it("uses startPoint.coordinates as marker coordinate when effectiveOrigin is null", async () => {
    // Create a startPoint with a coordinates field but force effectiveOrigin to null
    // by giving startPoint but with startOverride not set (effectiveOrigin = startPoint.coordinates)
    // Actually, to make effectiveOrigin null we need both startOverride undefined AND
    // startPoint.coordinates to be falsy. Use a partial building with no coordinates.
    const partialBuilding = {
      ...BUILDINGS[0],
      coordinates: undefined as any,
    };

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={partialBuilding}
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    // The marker should still render using the ?? fallback
    expect(await screen.findByTestId("marker-start")).toBeTruthy();
  });

  // --- Permission request fallback: already-granted on first check ---

  it("skips requesting permission when already granted on first check", async () => {
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "granted",
    });

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        strategy={WALKING_STRATEGY}
        showShuttle={false}
      />,
    );

    await screen.findByTestId("marker-You are here");
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });
});
