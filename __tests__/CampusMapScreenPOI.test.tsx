import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import CampusMapScreen from "../app/CampusMapScreen";
import { useNearbyPOIs } from "../hooks/useNearbyPOIs";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const MockIcon = (props: any) => <Text>{props?.name ?? "icon"}</Text>;
  return {
    __esModule: true,
    MaterialIcons: MockIcon,
    MaterialCommunityIcons: MockIcon,
  };
});

jest.mock("expo-router", () => ({
  __esModule: true,
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../hooks/useShuttleAvailability", () => ({
  useShuttleAvailability: () => ({ available: true }),
}));

jest.mock("../hooks/useNearbyPOIs", () => ({
  useNearbyPOIs: jest.fn(),
}));

jest.mock("../constants/campuses", () => ({
  CAMPUSES: {
    sgw: { coordinates: { latitude: 45.497, longitude: -73.579 } },
    loyola: { coordinates: { latitude: 45.458, longitude: -73.64 } },
  },
}));

jest.mock("../components/CampusMap", () => {
  const React = require("react");
  const { Text, View } = require("react-native");
  const Mock = (props: any) => {
    const focusPoi = (props.nearbyPOIs ?? []).find((p: any) => p.placeId === props.focusPOIId);
    const coord = focusPoi ? { latitude: focusPoi.latitude, longitude: focusPoi.longitude } : null;
    return (
      <View testID="campus-map-mock">
        <Text testID="campus-map-focus-coordinate">
          {coord ? JSON.stringify(coord) : "null"}
        </Text>
        <Text testID="campus-map-focus-trigger">{String(props.focusPOITrigger)}</Text>
        <Text testID="campus-map-nearby-count">{String((props.nearbyPOIs ?? []).length)}</Text>
      </View>
    );
  };
  return { __esModule: true, default: Mock };
});

jest.mock("../components/DirectionStepsPanel", () => ({
  DirectionStepsPanel: () => null,
}));

jest.mock("../components/NavigationBar", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});

jest.mock("../components/NextClassDirectionsPanel", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});

jest.mock("../components/ShuttleSchedulePanel", () => ({
  ShuttleSchedulePanel: () => null,
}));

jest.mock("../components/OutdoorPOIFilter", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const Mock = (props: any) => (
    <View testID="outdoor-poi-filter-mock">
      <Text testID="outdoor-poi-active-count">{String(props.activeCategories?.size ?? 0)}</Text>
      <Pressable testID="toggle-coffee" onPress={() => props.onToggle("coffee")}>
        <Text>Toggle Coffee</Text>
      </Pressable>
    </View>
  );
  return { __esModule: true, OutdoorPOIFilter: Mock, default: Mock };
});

jest.mock("../components/POIRangeSelector", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const Mock = (props: any) => (
    <View testID="poi-range-selector-mock">
      <Text testID="poi-range-selected">{props.selected?.id}</Text>
      <Pressable
        testID="set-range-1000"
        onPress={() => props.onSelect({ id: "1000", label: "1 km", meters: 1000 })}
      >
        <Text>Set Range 1000</Text>
      </Pressable>
    </View>
  );
  return { __esModule: true, POIRangeSelector: Mock, default: Mock };
});

jest.mock("../components/POIListPanel", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");
  const Mock = (props: any) => (
    <View testID="poi-list-panel-mock">
      <Text testID="poi-list-origin">{JSON.stringify(props.origin)}</Text>
      <Text testID="poi-list-length">{String((props.pois ?? []).length)}</Text>
      <Pressable testID="retry-poi-search" onPress={() => props.onRetry?.()}>
        <Text>Retry Search</Text>
      </Pressable>
      <Pressable testID="close-poi-list" onPress={() => props.onClose?.()}>
        <Text>Close List</Text>
      </Pressable>
      <Pressable
        testID="select-first-poi"
        onPress={() =>
          props.onSelect?.({
            placeId: "p1",
            name: "Coffee Spot",
            latitude: 45.501,
            longitude: -73.581,
            vicinity: "1455 Maisonneuve",
            categoryId: "coffee",
          })
        }
      >
        <Text>Select First</Text>
      </Pressable>
    </View>
  );
  return { __esModule: true, POIListPanel: Mock, default: Mock };
});

describe("CampusMapScreen POI flow", () => {
  const searchPOIs = jest.fn();
  const clearPOIs = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 45.5, longitude: -73.5 },
    });
    (useNearbyPOIs as jest.Mock).mockReturnValue({
      pois: [
        {
          placeId: "p1",
          name: "Coffee Spot",
          latitude: 45.501,
          longitude: -73.581,
          vicinity: "1455 Maisonneuve",
          categoryId: "coffee",
        },
      ],
      loading: false,
      error: null,
      search: searchPOIs,
      clear: clearPOIs,
    });
  });

  it("shows and hides the POI filter panel with the POI button", async () => {
    render(<CampusMapScreen />);

    expect(screen.queryByTestId("outdoor-poi-filter-mock")).toBeNull();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    expect(await screen.findByTestId("outdoor-poi-filter-mock")).toBeTruthy();
    expect(screen.getByTestId("poi-range-selector-mock")).toBeTruthy();

    fireEvent.press(screen.getByTestId("poi-filter-button"));

    await waitFor(() => {
      expect(clearPOIs).toHaveBeenCalled();
      expect(screen.queryByTestId("outdoor-poi-filter-mock")).toBeNull();
    });
  });

  it("auto-searches and opens POI list when a category is toggled", async () => {
    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(await screen.findByTestId("toggle-coffee"));

    await waitFor(() => {
      expect(searchPOIs).toHaveBeenCalledWith(
        { latitude: 45.497, longitude: -73.579 },
        500,
        ["coffee"],
      );
    });

    expect(screen.getByTestId("poi-list-panel-mock")).toBeTruthy();
    expect(screen.getByTestId("poi-list-length").props.children).toBe("1");
  });

  it("updates CampusMap focus coordinate when a POI is selected from list", async () => {
    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(await screen.findByTestId("toggle-coffee"));
    fireEvent.press(await screen.findByTestId("select-first-poi"));

    await waitFor(() => {
      expect(screen.getByTestId("campus-map-focus-coordinate").props.children).toBe(
        JSON.stringify({ latitude: 45.501, longitude: -73.581 }),
      );
      expect(screen.getByTestId("campus-map-focus-trigger").props.children).toBe("1");
    });
  });

  it("re-searches using updated radius when range selector changes", async () => {
    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(await screen.findByTestId("toggle-coffee"));

    await waitFor(() => {
      expect(searchPOIs).toHaveBeenCalledWith(
        { latitude: 45.497, longitude: -73.579 },
        500,
        ["coffee"],
      );
    });

    fireEvent.press(screen.getByTestId("set-range-1000"));

    await waitFor(() => {
      expect(searchPOIs).toHaveBeenCalledWith(
        { latitude: 45.497, longitude: -73.579 },
        1000,
        ["coffee"],
      );
    });
  });

  it("invokes retry search from the POI list when categories are active", async () => {
    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(await screen.findByTestId("toggle-coffee"));

    await waitFor(() => {
      expect(searchPOIs).toHaveBeenCalledWith(
        { latitude: 45.497, longitude: -73.579 },
        500,
        ["coffee"],
      );
    });

    const callsBeforeRetry = searchPOIs.mock.calls.length;
    fireEvent.press(screen.getByTestId("retry-poi-search"));

    await waitFor(() => {
      expect(searchPOIs.mock.calls.length).toBeGreaterThan(callsBeforeRetry);
    });
  });

  it("does not run retry search when categories are empty", async () => {
    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(await screen.findByTestId("toggle-coffee"));

    await waitFor(() => {
      expect(searchPOIs).toHaveBeenCalledWith(
        { latitude: 45.497, longitude: -73.579 },
        500,
        ["coffee"],
      );
    });

    fireEvent.press(screen.getByTestId("toggle-coffee"));
    const callsBeforeRetry = searchPOIs.mock.calls.length;
    fireEvent.press(screen.getByTestId("retry-poi-search"));

    await waitFor(() => {
      expect(searchPOIs.mock.calls.length).toBe(callsBeforeRetry);
    });
  });

  it("closes the POI list when onClose is triggered", async () => {
    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(await screen.findByTestId("toggle-coffee"));

    expect(await screen.findByTestId("poi-list-panel-mock")).toBeTruthy();
    fireEvent.press(screen.getByTestId("close-poi-list"));

    await waitFor(() => {
      expect(screen.queryByTestId("poi-list-panel-mock")).toBeNull();
    });
  });
});
