import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { POIListPanel } from "../components/POIListPanel";

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require("react-native");
  const MockIcon = (props: any) => <Text>{props?.name ?? "icon"}</Text>;
  return {
    __esModule: true,
    MaterialCommunityIcons: MockIcon,
    MaterialIcons: MockIcon,
  };
});

describe("POIListPanel", () => {
  const origin = { latitude: 45.5, longitude: -73.5 };

  it("renders loading state", () => {
    render(
      <POIListPanel
        pois={[]}
        origin={origin}
        onClose={jest.fn()}
        loading
      />,
    );

    expect(screen.getByTestId("poi-list-loading")).toBeTruthy();
    expect(screen.getByText("Searching nearby places…")).toBeTruthy();
  });

  it("renders error state and triggers retry", () => {
    const onRetry = jest.fn();
    render(
      <POIListPanel
        pois={[]}
        origin={origin}
        onClose={jest.fn()}
        error="Places API request failed"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId("poi-list-error")).toBeTruthy();
    expect(screen.getByText("Places API request failed")).toBeTruthy();

    fireEvent.press(screen.getByTestId("poi-list-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when no POIs are available", () => {
    render(
      <POIListPanel
        pois={[]}
        origin={origin}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId("poi-list-empty")).toBeTruthy();
    expect(screen.getByText("No places found nearby.")).toBeTruthy();
  });

  it("renders location-unavailable banner when fallback origin is used", () => {
    render(
      <POIListPanel
        pois={[]}
        origin={origin}
        onClose={jest.fn()}
        locationUnavailable
      />,
    );

    expect(screen.getByTestId("poi-list-location-banner")).toBeTruthy();
    expect(
      screen.getByText("Location unavailable — showing results near campus center"),
    ).toBeTruthy();
  });

  it("sorts places by computed distance, formats distances, and handles row selection", () => {
    const onSelect = jest.fn();
    render(
      <POIListPanel
        pois={[
          {
            placeId: "far",
            name: "Far Grocery",
            latitude: 45.52,
            longitude: -73.5,
            vicinity: "Far St",
            categoryId: "grocery",
          },
          {
            placeId: "near",
            name: "Near Coffee",
            latitude: 45.5009,
            longitude: -73.5,
            vicinity: "Near Ave",
            categoryId: "coffee",
          },
        ]}
        origin={origin}
        onClose={jest.fn()}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByTestId("poi-list-row-near")).toBeTruthy();
    expect(screen.getByTestId("poi-list-row-far")).toBeTruthy();

    expect(screen.getByText(/100 m|99 m|101 m/)).toBeTruthy();
    expect(screen.getByText("2.2 km")).toBeTruthy();

    fireEvent.press(screen.getByTestId("poi-list-row-near"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ placeId: "near", name: "Near Coffee" }),
    );
  });

  it("shows item count in header and closes panel", () => {
    const onClose = jest.fn();
    render(
      <POIListPanel
        pois={[
          {
            placeId: "p1",
            name: "Library",
            latitude: 45.5002,
            longitude: -73.5002,
            vicinity: "1455 Maisonneuve",
            categoryId: "study",
          },
        ]}
        origin={origin}
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Nearby Places")).toBeTruthy();
    expect(screen.getByText("(1)")).toBeTruthy();

    fireEvent.press(screen.getByTestId("poi-list-close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
