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
    });
  });

  it("uses Loyola when campus param is loyola", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "loyola" });

    render(<CampusMapScreen />);

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
    });
  });

  it("switches campus to Loyola when the Loyola toggle is pressed", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("campus-toggle-loyola"));

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
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
    });
  });
});
