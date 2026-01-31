import { fireEvent, render, screen } from "@testing-library/react-native";
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
        {JSON.stringify(props.coordinates)}
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

import { useLocalSearchParams } from "expo-router";

describe("CampusMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("defaults to SGW when no campus param is provided", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    render(<CampusMapScreen />);

    expect(screen.getByText("Switch to Loyola")).toBeTruthy();

    expect(
      screen.getByTestId("campus-map-props").props.children
    ).toContain('"latitude":1');
    expect(
      screen.getByTestId("campus-map-props").props.children
    ).toContain('"longitude":2');
  });

  it("uses Loyola when campus param is loyola", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "loyola" });

    render(<CampusMapScreen />);

    expect(screen.getByText("Switch to SGW")).toBeTruthy();

    expect(
      screen.getByTestId("campus-map-props").props.children
    ).toContain('"latitude":3');
    expect(
      screen.getByTestId("campus-map-props").props.children
    ).toContain('"longitude":4');
  });

  it("toggles campus when the switch button is pressed", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    render(<CampusMapScreen />);

    const btn = screen.getByText("Switch to Loyola");
    fireEvent.press(btn);

    expect(screen.getByText("Switch to SGW")).toBeTruthy();
    expect(
      screen.getByTestId("campus-map-props").props.children
    ).toContain('"latitude":3');
  });
});
