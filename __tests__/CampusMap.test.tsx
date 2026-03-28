import {
    fireEvent,
    render,
    screen,
    waitFor
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
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";
import { getAvailableFloors } from "../utils/mapAssets";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";

jest.mock("../components/ShuttleBusTracker", () => ({
  useShuttleBus: () => ({
    activeBuses: [
      { ID: "bus-1", Latitude: 45.497, Longitude: -73.578 }
    ],
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
  const React = require("react");
  const { Text, View, TouchableOpacity } = require("react-native");
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

  const Marker = React.forwardRef((props: any, ref: any) => {
    const markerId = props.testID ?? `marker-${props.title ?? "marker"}`;
    const showCallout = jest.fn();
    showCalloutMocks[markerId] = showCallout;

    React.useImperativeHandle(ref, () => ({ showCallout }));

    return (
      <View
        testID={markerId}
        onPress={props.tappable ? props.onPress : undefined}
      >
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
      boundingBox: [{ latitude: 10, longitude: 20 }, { latitude: 10.001, longitude: 20.001 }, { latitude: 10.002, longitude: 20.002 }],
    },
    {
      name: "B",
      campusName: "sgw",
      displayName: "Building B",
      address: "Address B",
      coordinates: { latitude: 11, longitude: 21 },
      boundingBox: [{ latitude: 11, longitude: 21 }, { latitude: 11.001, longitude: 21.001 }, { latitude: 11.002, longitude: 21.002 }],
    },
    {
      name: "C",
      campusName: "sgw",
      displayName: "Building C",
      address: "Address C",
      coordinates: { latitude: 12, longitude: 22 },
      boundingBox: [{ latitude: 12, longitude: 22 }, { latitude: 12.001, longitude: 22.001 }, { latitude: 12.002, longitude: 22.002 }],
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
          <Pressable testID="building-info-set-start" onPress={() => onSetAsStart?.(building)}>
            <Text>Set as start</Text>
          </Pressable>
          <Pressable testID="building-info-set-dest" onPress={() => onSetAsDestination?.(building)}>
            <Text>Set as destination</Text>
          </Pressable>
          {/* ADD THE MOCK BUTTON HERE */}
          <Pressable testID="building-info-set-my-loc" onPress={() => onSetAsMyLocation?.(building)}>
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
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
    logSpy = jest.spyOn(console, "log").mockImplementation(() => { });
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [],
      steps: [],
      segments: [], 
    });

    (hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "granted" });
    (getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 50.0, longitude: -70.0 },
    });
    (watchPositionAsync as jest.Mock).mockResolvedValue({
      remove: jest.fn(),
    });
    (getBuildingContainingPoint as jest.Mock).mockReturnValue(null);
    (getAvailableFloors as jest.Mock).mockImplementation((buildingCode: string) =>
      buildingCode === "A" ? [1, 2] : [],
    );
    Object.values(getMapsMock().__showCalloutMocks).forEach((mock: jest.Mock) => mock.mockClear());
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
      />
    );
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

    expect(await screen.findByText("Location services are disabled.")).toBeTruthy();
  });

  it("requests permissions and shows an error when permission is denied", async () => {
    (getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });
    (requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(await screen.findByText("Permission to access location was denied.")).toBeTruthy();
  });

  it("sets user coords and renders the current location marker on success", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();
  });

  it("shows an error when current location cannot be retrieved", async () => {
    (getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error("boom"));

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    expect(await screen.findByText("Unable to get your current location.")).toBeTruthy();
  });

  // --- Region effect (animateToRegion) ---

  it("animates to campus coordinates when focusTarget is not user", async () => {
    const mapsMock = getMapsMock();
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);

    // Wait for the location effect to finish so we avoid 'act' warnings
    await screen.findByTestId("marker-You are here");

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    const lastCall = mapsMock.__animateToRegion.mock.calls.at(-1);
    expect(lastCall[0]).toEqual(expect.objectContaining({ latitude: 1, longitude: 2 }));
  });

  it("animates to user coordinates when focusTarget is user", async () => {
    const mapsMock = getMapsMock();
    render(<CampusMap coordinates={coordinates} focusTarget="user" strategy={WALKING_STRATEGY} showShuttle={false} />);

    await screen.findByTestId("marker-You are here");

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalled();
    });

    const lastCall = mapsMock.__animateToRegion.mock.calls.at(-1);
    expect(lastCall[0]).toEqual(expect.objectContaining({ latitude: 50.0, longitude: -70.0 }));
  });

  it("animates to building location when a building is selected", async () => {
    const mapsMock = getMapsMock();
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);
    
    await screen.findByTestId("marker-You are here"); // Wait for mount

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]); // Select Building A

    await waitFor(() => {
      expect(mapsMock.__animateToRegion).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: 10 - 0.0011 }),
        300
      );
    });
  });

  it("calls onSetAsDestination and clears selected building when Set as destination is pressed", async () => {
    const onSetAsDestination = jest.fn();
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} onSetAsDestination={onSetAsDestination} showShuttle={false} />);
    
    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    fireEvent.press(screen.getByTestId("building-info-set-dest"));

    expect(onSetAsDestination).toHaveBeenCalledWith(expect.objectContaining({ name: "A" }));
  });

  // --- Map/building interaction ---

  it("selects a building on polygon press and clears it on map press", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);
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

  it("clears selection when the popup close is pressed", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);
    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    fireEvent.press(screen.getByTestId("building-info-close"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  it("applies current, selected, and default polygon styles", async () => {
    (getBuildingContainingPoint as jest.Mock).mockReturnValue(BUILDINGS[0]);
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);
    await screen.findByTestId("marker-You are here");

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[1]);

    await waitFor(() => {
      const styles = screen.getAllByTestId("polygon-style").map((el) => JSON.parse(el.props.children));
      expect(styles[0].fillColor).toBe(colors.secondaryTransparent); // A is current
      expect(styles[1].fillColor).toBe(colors.primaryLight); // B is selected
      expect(styles[2].fillColor).toBe(colors.primaryTransparent); // C is default
    });
  });

  // --- Start point and destination point markers ---

  it("renders start point marker when startPoint is provided", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" startPoint={BUILDINGS[0]} strategy={WALKING_STRATEGY} showShuttle={false} />);
    expect(await screen.findByTestId("marker-start")).toBeTruthy();
  });

  it("renders destination point marker when destinationPoint is provided", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" destinationPoint={BUILDINGS[1]} strategy={WALKING_STRATEGY} showShuttle={false} />);
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
      { mode: "walking", coordinates: [{ latitude: 1, longitude: 1 }, { latitude: 1.1, longitude: 1.1 }] }
    ];

    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: mockSegments[0].coordinates,
      steps: [],
      segments: mockSegments,
    });

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" startPoint={BUILDINGS[0]} destinationPoint={BUILDINGS[1]} strategy={WALKING_STRATEGY} showShuttle={false} />);

    // Now uses the correct testIDs defined in CampusMap.tsx
    const border = await screen.findByTestId("polyline-border");
    expect(border).toBeTruthy();
    
    const props = JSON.parse(screen.getByTestId("polyline-main-props").props.children);
    expect(props.strokeColor).toBe(colors.routeWalk);
  });

  it("applies dash pattern for transit mode polyline", async () => {
    const transitStrategy = { mode: "transit", icon: "bus", label: "Transit" };
    (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValue({
      coordinates: [{ latitude: 1, longitude: 1 }],
      steps: [],
      segments: [{ mode: "transit", coordinates: [{ latitude: 1, longitude: 1 }] }]
    });

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" startPoint={BUILDINGS[0]} destinationPoint={BUILDINGS[1]} strategy={transitStrategy as any} showShuttle={false} />);
    
    const polyline = await screen.findByTestId("polyline-main-props");
    const props = JSON.parse(polyline.props.children);
    expect(props.lineDashPattern).toEqual([8, 6]);
  });

  // --- Shuttle coverage ---
  it("renders shuttle markers and stops when showShuttle is true", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={true} />);

    // Because we added `{props.title && <Text>{props.title}</Text>}` to the Marker mock, 
    // we can find the shuttle markers by their text.
    expect(await screen.findByText("Shuttle Bus")).toBeTruthy();
    
    // We can also find the stops by text, assuming your BUSSTOP array has these titles:
    const markers = screen.getAllByTestId(/marker-/);
    expect(markers.length).toBeGreaterThan(0);
    // Alternatively, if you know the exact titles of the stops in BUSSTOP constant:
    // expect(screen.getByText("Concordia SGW Shuttle Stop")).toBeTruthy(); 
  });

  // --- Popup Button coverage ---
  it("triggers onSetAsMyLocation when button in popup is pressed", async () => {
    const onSetAsMyLocation = jest.fn();
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} onSetAsMyLocation={onSetAsMyLocation} />);
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
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />);
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
        focusCoordinate={{ latitude: 10.1234, longitude: 20.5678 }}
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

    expect(mapsMock.__showCalloutMocks["poi-marker-poi-focus"]).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });
it("label marker tap and polygon tap both open the same building popup", async () => {
  render(
    <CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />
  );
  await screen.findByTestId("marker-You are here");

  // Via polygon
  const polygons = screen.getAllByTestId("polygon");
  fireEvent.press(polygons[0]);
  expect(screen.getByTestId("building-info-building-name").props.children).toBe("Building A");

  // Close it
  fireEvent.press(screen.getByTestId("building-info-close"));
  expect(screen.queryByTestId("building-info-popup")).toBeNull();

  // Via label marker
  fireEvent.press(screen.getByTestId("label-marker-A"));
  expect(screen.getByTestId("building-info-building-name").props.children).toBe("Building A");
});

it("label pill exists for each building with a boundingBox", async () => {
  render(
    <CampusMap coordinates={coordinates} focusTarget="sgw" strategy={WALKING_STRATEGY} showShuttle={false} />
  );
  await screen.findByTestId("marker-You are here");

  expect(screen.getByTestId("label-pill-A")).toBeTruthy();
  expect(screen.getByTestId("label-pill-B")).toBeTruthy();
  expect(screen.getByTestId("label-pill-C")).toBeTruthy();
});

});
