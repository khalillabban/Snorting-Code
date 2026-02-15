import { fireEvent, render, screen } from "@testing-library/react-native";
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

describe("CampusMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults to SGW when no campus param is provided", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    render(<CampusMapScreen />);

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 1, longitude: 2 },
      focusTarget: "sgw",
      startPoint: null,
      destinationPoint: null,
    });
  });

  it("uses Loyola when campus param is loyola", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "loyola" });

    render(<CampusMapScreen />);

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
      startPoint: null,
      destinationPoint: null,
    });
  });

  it("switches campus to Loyola when the Loyola toggle is pressed", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("campus-toggle-loyola"));

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
      startPoint: null,
      destinationPoint: null,
    });
  });

  it("centers on user location without changing campus coordinates", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    render(<CampusMapScreen />);

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
    it("opens navigation bar when directions button is pressed", () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      render(<CampusMapScreen />);

      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");

      fireEvent.press(screen.getByText("directions"));

      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");
    });

    it("closes navigation bar when close button is pressed", () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      render(<CampusMapScreen />);

      fireEvent.press(screen.getByText("directions"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");

      fireEvent.press(screen.getByTestId("nav-close"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
    });

    it("updates start and destination points when route is confirmed", () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      render(<CampusMapScreen />);

      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      const mapProps = getMapProps();
      expect(mapProps.startPoint).toBe("H");
      expect(mapProps.destinationPoint).toBe("MB");
    });

    it("closes navigation bar after route is confirmed", () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      render(<CampusMapScreen />);

      fireEvent.press(screen.getByText("directions"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");

      fireEvent.press(screen.getByTestId("nav-confirm"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
    });

    it("preserves route points when navigation bar is reopened", () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      render(<CampusMapScreen />);

      // Set a route
      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(getMapProps().startPoint).toBe("H");
      expect(getMapProps().destinationPoint).toBe("MB");

      // Open and close navigation bar
      fireEvent.press(screen.getByText("directions"));
      fireEvent.press(screen.getByTestId("nav-close"));

      // Route should still be set
      expect(getMapProps().startPoint).toBe("H");
      expect(getMapProps().destinationPoint).toBe("MB");
    });
  });
});
