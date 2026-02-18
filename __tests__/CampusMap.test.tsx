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
import { colors } from "../constants/theme";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";
import { getOutdoorRoute } from "../services/GoogleDirectionsService";


jest.mock("expo-location", () => ({
  Accuracy: { Balanced: "Balanced" },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../services/GoogleDirectionsService", () => ({
  getOutdoorRoute: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const Polyline = (props: any) => (
    <View testID="polyline">
      <Text testID="polyline-props">
        {JSON.stringify({
          coordinates: props.coordinates,
          strokeWidth: props.strokeWidth,
          strokeColor: props.strokeColor,
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
      <View testID="map-view" onPress={props.onPress}>
        {props.children}
      </View>
    );
  });

  const Marker = (props: any) => {
    return (
      <View testID={`marker-${props.title ?? "marker"}`}>
        <Text testID="marker-props">
          {JSON.stringify({
            coordinate: props.coordinate,
            title: props.title,
            pinColor: props.pinColor,
          })}
        </Text>
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
  const { Text, View } = require("react-native");
  return {
    BuildingInfoPopup: ({ building, onClose }: any) => {
      if (!building) return null;
      return (
        <View testID="building-info-popup">
          <Text testID="building-info-building-name">
            {building.displayName ?? building.name}
          </Text>
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

    // ⭐ CRITICAL LINE (missing)
    (getOutdoorRoute as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });

  // --- Rendering basics ---

  it("renders the map and polygons (and warns on empty boundingBox)", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

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

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

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

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

    expect(
      await screen.findByText("Permission to access location was denied."),
    ).toBeTruthy();
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it("sets user coords and renders the current location marker on success", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();
  });

  it("shows an error when current location cannot be retrieved", async () => {
    (getCurrentPositionAsync as jest.Mock).mockRejectedValue(new Error("boom"));

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

    expect(
      await screen.findByText("Unable to get your current location."),
    ).toBeTruthy();
  });

  // --- Region effect (animateToRegion) ---

  it("animates to campus coordinates when focusTarget is not user", async () => {
    const mapsMock = getMapsMock();

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

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

    render(<CampusMap coordinates={coordinates} focusTarget="user" />);

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

  // --- Map/building interaction ---

  it("selects a building on polygon press and clears it on map press", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[1]);

    expect(screen.getByTestId("building-info-popup")).toBeTruthy();
    expect(screen.getByText("Building B")).toBeTruthy();

    fireEvent.press(screen.getByTestId("map-view"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  it("clears selection when the popup close is pressed", async () => {
    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

    const polygons = await screen.findAllByTestId("polygon");
    fireEvent.press(polygons[0]);

    expect(screen.getByText("Building A")).toBeTruthy();

    fireEvent.press(screen.getByTestId("building-info-close"));
    expect(screen.queryByTestId("building-info-popup")).toBeNull();
  });

  // --- Polygon styling (covers getPolygonStyle branches indirectly) ---

  it("applies current, selected, and default polygon styles", async () => {
    (getBuildingContainingPoint as jest.Mock).mockReturnValue(BUILDINGS[0]);

    render(<CampusMap coordinates={coordinates} focusTarget="sgw" />);

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
      />,
    );

    expect(await screen.findByTestId("marker-Destination")).toBeTruthy();

    // Use within() to scope the query to the marker element
    const { getByTestId: getWithin } = within(
      screen.getByTestId("marker-Destination"),
    );
    const props = JSON.parse(getWithin("marker-props").props.children);

    expect(props.coordinate).toEqual(destinationBuilding.coordinates);
    expect(props.title).toBe("Destination");
    expect(props.pinColor).toBe("red");
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
      />,
    );

    // Should have user location, start point, and destination
    const markers = await screen.findAllByTestId(/^marker-/);
    expect(markers.length).toBeGreaterThanOrEqual(3);

    expect(screen.getByTestId("marker-You are here")).toBeTruthy();
    expect(screen.getByTestId("marker-Destination")).toBeTruthy();
  });

  it("does not render start or destination markers when not provided", async () => {
    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={undefined}
        destinationPoint={undefined}
      />,
    );

    // Wait for the user location marker to confirm the component has settled
    expect(await screen.findByTestId("marker-You are here")).toBeTruthy();

    // Neither the titled destination marker nor any start marker should be present
    expect(screen.queryByTestId("marker-Destination")).toBeNull();
    expect(screen.queryByTestId("marker-marker")).toBeNull();
  });

  it("sets route coordinates and renders polyline when route fetch succeeds", async () => {
    const startBuilding = BUILDINGS[0];
    const destinationBuilding = BUILDINGS[1];

    const mockRoute = [
      { latitude: 10.1, longitude: 20.1 },
      { latitude: 10.2, longitude: 20.2 },
    ];

    (getOutdoorRoute as jest.Mock).mockResolvedValue(mockRoute);

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={startBuilding}
        destinationPoint={destinationBuilding}
      />,
    );

    // Wait for async route fetch + state update
    await waitFor(() => {
      expect(getOutdoorRoute).toHaveBeenCalledWith(
        startBuilding.coordinates,
        destinationBuilding.coordinates,
      );
    });

    // Polyline only appears if setRouteCoords(route) executed
    const polyline = await screen.findByTestId("polyline");
    expect(polyline).toBeTruthy();

    const props = JSON.parse(
      screen.getByTestId("polyline-props").props.children,
    );

    expect(props.coordinates).toEqual(mockRoute);
  });

  it("clears route and logs when route fetch fails", async () => {
    const startBuilding = BUILDINGS[0];
    const destinationBuilding = BUILDINGS[1];

    (getOutdoorRoute as jest.Mock).mockRejectedValue(
      new Error("route failed")
    );

    render(
      <CampusMap
        coordinates={coordinates}
        focusTarget="sgw"
        startPoint={startBuilding}
        destinationPoint={destinationBuilding}
      />,
    );

    await waitFor(() => {
      expect(getOutdoorRoute).toHaveBeenCalled();
    });

    // Catch branch logs the error
    expect(logSpy).toHaveBeenCalledWith(
      "Route error:",
      expect.any(Error)
    );

    // Route should be cleared → no polyline rendered
    expect(screen.queryByTestId("polyline")).toBeNull();
  });


});
