import { fireEvent, render, screen } from "@testing-library/react-native";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import CampusMapScreen from "../app/CampusMapScreen";

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

    expect(screen.getByText("Center: SGW")).toBeTruthy();
    expect(getMapProps()).toEqual({
      coordinates: { latitude: 1, longitude: 2 },
      focusTarget: "sgw",
    });
  });

  it("uses Loyola when campus param is loyola", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "loyola" });

    render(<CampusMapScreen />);

    expect(screen.getByText("Center: Loyola")).toBeTruthy();
    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
    });
  });

  it("cycles focus from SGW to Loyola when pressed", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    render(<CampusMapScreen />);

    fireEvent.press(screen.getByText("Center: SGW"));

    expect(screen.getByText("Center: Loyola")).toBeTruthy();
    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "loyola",
    });
  });

  it("cycles focus from Loyola to My location when pressed twice", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    render(<CampusMapScreen />);

    fireEvent.press(screen.getByText("Center: SGW"));
    fireEvent.press(screen.getByText("Center: Loyola"));

    expect(screen.getByText("Center: My location")).toBeTruthy();
    expect(getMapProps()).toEqual({
      coordinates: { latitude: 3, longitude: 4 },
      focusTarget: "user",
    });
  });
});
