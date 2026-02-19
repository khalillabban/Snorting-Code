import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import CampusMapScreen from "../app/CampusMapScreen";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    MaterialIcons: (props: any) => <Text>{props?.name ?? "icon"}</Text>,
  };
});

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../components/CampusMap", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return function MockCampusMap(props: any) {
    return (
      <Text testID="campus-map-props">
        {JSON.stringify({
          coordinates: props.coordinates,
          focusTarget: props.focusTarget,
          startPoint: props.startPoint,
          destinationPoint: props.destinationPoint,
        })}
      </Text>
    );
  };
});

jest.mock("../constants/campuses", () => ({
  CAMPUSES: {
    sgw: { coordinates: { latitude: 1, longitude: 2 } },
    loyola: { coordinates: { latitude: 3, longitude: 4 } },
  },
}));

jest.mock("../components/NavigationBar", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");

  return function MockNavigationBar(props: any) {
    return (
      <View>
        <Text testID="nav-visible">{props.visible ? "visible" : "hidden"}</Text>

        <Pressable
          testID="nav-confirm"
          onPress={() => props.onConfirm("H", "MB")}
        >
          <Text>Confirm</Text>
        </Pressable>

        <Pressable testID="nav-close" onPress={props.onClose}>
          <Text>Close</Text>
        </Pressable>
      </View>
    );
  };
});

const getMapProps = () =>
  JSON.parse(screen.getByTestId("campus-map-props").props.children);

const renderScreen = async () => {
  render(<CampusMapScreen />);
  await waitFor(() => { }); // flush async useEffect
};

describe("CampusMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (Location.requestForegroundPermissionsAsync as jest.Mock)
      .mockResolvedValue({ status: "granted" });

    (Location.getCurrentPositionAsync as jest.Mock)
      .mockResolvedValue({
        coords: {
          latitude: 45.497,
          longitude: -73.578,
        },
      });
  });

  it("defaults to SGW when no campus param is provided", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    await renderScreen();

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 1, longitude: 2 },
      focusTarget: "sgw",
      startPoint: null,
      destinationPoint: null,
    });
  });

  it("uses Loyola when campus param is loyola", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "loyola" });

    await renderScreen();

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
      startPoint: null,
      destinationPoint: null,
    });
  });

  it("switches campus to Loyola when the Loyola toggle is pressed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    await renderScreen();

    fireEvent.press(screen.getByTestId("campus-toggle-loyola"));

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
      startPoint: null,
      destinationPoint: null,
    });
  });

  it("centers on user location without changing campus coordinates", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    await renderScreen();

    fireEvent.press(screen.getByTestId("campus-toggle-loyola"));
    fireEvent.press(screen.getByTestId("my-location-button"));

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "user",
      startPoint: null,
      destinationPoint: null,
    });
  });

  describe("Navigation Bar", () => {
    it("opens navigation bar when directions button is pressed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");

      fireEvent.press(screen.getByText("directions"));

      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");
    });

    it("closes navigation bar when close button is pressed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByText("directions"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");

      fireEvent.press(screen.getByTestId("nav-close"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
    });

    it("updates start and destination points when route is confirmed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      const mapProps = getMapProps();
      expect(mapProps.startPoint).toBe("H");
      expect(mapProps.destinationPoint).toBe("MB");
    });

    it("closes navigation bar after route is confirmed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
    });

    it("preserves route points when navigation bar is reopened", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(getMapProps().startPoint).toBe("H");
      expect(getMapProps().destinationPoint).toBe("MB");

      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-close"));

      expect(getMapProps().startPoint).toBe("H");
      expect(getMapProps().destinationPoint).toBe("MB");
    });

    it("does nothing when location permission is denied", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      (Location.requestForegroundPermissionsAsync as jest.Mock)
        .mockResolvedValue({ status: "denied" });

      await renderScreen();

      // map still renders normally
      expect(getMapProps()).toEqual({
        coordinates: { latitude: 1, longitude: 2 },
        focusTarget: "sgw",
        startPoint: null,
        destinationPoint: null,
      });

      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it("requests location and computes nearest building on mount", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
      expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    });
  });
});
