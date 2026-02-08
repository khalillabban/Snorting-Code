import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import CampusMap from "../components/CampusMap";
import { BUILDINGS } from "../constants/buildings";
import { colors } from "../constants/theme";
import { getBuildingContainingPoint } from "../utils/pointInPolygon";
import {
  getCurrentPositionAsync,
  getForegroundPermissionsAsync,
  hasServicesEnabledAsync,
  requestForegroundPermissionsAsync,
} from "expo-location";

jest.mock("expo-location", () => ({
  Accuracy: { Balanced: "Balanced" },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  const animateToRegion = jest.fn();

  const MapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ animateToRegion }));
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

    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

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
      const styles = screen.getAllByTestId("polygon-style").map((el) =>
        JSON.parse(el.props.children),
      );

      // A is current
      expect(styles[0]).toEqual({
        fillColor: colors.secondaryTransparent,
        strokeColor: colors.secondary,
        strokeWidth: 3,
      });

      // B is selected
      expect(styles[1]).toEqual({
        fillColor: colors.primaryTransparent,
        strokeColor: colors.primary,
        strokeWidth: 3,
      });

      // C is default
      expect(styles[2]).toEqual({
        fillColor: colors.primaryTransparent,
        strokeColor: colors.primary,
        strokeWidth: 2,
      });
    });
  });
});

