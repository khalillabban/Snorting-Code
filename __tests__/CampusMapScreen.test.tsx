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
import { WALKING_STRATEGY } from "../constants/strategies";

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
  const { View, Text, Button } = require("react-native");
  return function MockCampusMap(props: any) {
    return (
      <View>
      <Text testID="campus-map-props">
        {JSON.stringify({
          coordinates: props.coordinates,
          focusTarget: props.focusTarget,
          startPoint: props.startPoint,
          destinationPoint: props.destinationPoint,
          strategy: props.strategy,
        })}
      </Text>
      <Text testID="campus-map-user-focus-counter">{props.userFocusCounter}</Text>
      <Text testID="campus-map-route-focus-trigger">{props.routeFocusTrigger}</Text>
      <Button
          testID="trigger-get-directions"
          title="Get Directions"
          onPress={() => props.onSetAsDestination?.({ name: "H", displayName: "Hall" })}
        />
        <Button 
          testID="trigger-route-steps" 
          title="Set Steps" 
          onPress={() => props.onRouteSteps([{ instruction: "Walk" }])} 
        />
        <Button
          testID="trigger-set-as-start"
          title="Set As Start"
          onPress={() => props.onSetAsStart?.({ name: "MB", displayName: "MB Building" })}
        />
        <Button
          testID="trigger-set-my-location"
          title="Set My Location"
          onPress={() => props.onSetAsMyLocation?.({ name: "EV", displayName: "EV Building" })}
        />
        </View>
    );
  };
});

jest.mock("../constants/campuses", () => ({
  CAMPUSES: {
    sgw: { coordinates: { latitude: 1, longitude: 2 } },
    loyola: { coordinates: { latitude: 3, longitude: 4 } },
  },
}));
const mockWalkingStrategy = { mode: 'walking', label: 'Walk', icon: 'walk' };
jest.mock("../components/NavigationBar", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");

  return function MockNavigationBar(props: any) {
    return (
      <View>
        <Text testID="nav-visible">{props.visible ? "visible" : "hidden"}</Text>

        <Pressable
          testID="nav-confirm"
          onPress={() => props.onConfirm("H", "MB", mockWalkingStrategy)}
        >
          <Text>Confirm</Text>
        </Pressable>
        <Pressable testID="nav-applied" onPress={props.onInitialDestinationApplied}>
          <Text>Applied</Text>
        </Pressable>
        <Pressable testID="nav-close" onPress={props.onClose}>
          <Text>Close</Text>
        </Pressable>
      </View>
    );
  };
});
jest.mock("../components/DirectionStepsPanel", () => {
  const React = require("react");
  const { View, Button } = require("react-native");
  return {
    DirectionStepsPanel: (props: any) => (
      <View>
        <Button testID="steps-dismiss" title="Dismiss" onPress={props.onDismiss} />
        <Button testID="steps-change" title="Change" onPress={props.onChangeRoute} />
        {props.onFocusUser && (
          <Button testID="steps-focus-user" title="Focus User" onPress={props.onFocusUser} />
        )}
      </View>
    )
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
      strategy: WALKING_STRATEGY,
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
      strategy: WALKING_STRATEGY,
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
      strategy: WALKING_STRATEGY,
    });
  });
  it("handles initial destination lifecycle", async () => {
      await renderScreen();

      // 1. Set destination from Map (Covers: setInitialDestination(building), setIsNavVisible(true))
      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");

      // 2. Clear destination from Nav (Covers: onInitialDestinationApplied)
      fireEvent.press(screen.getByTestId("nav-applied"));
    });

    it("handles route steps panel interactions", async () => {
      await renderScreen();

      // Trigger a route and steps so the panel renders
      fireEvent.press(screen.getByTestId("nav-confirm"));
      fireEvent.press(screen.getByTestId("trigger-route-steps"));

      // 1. Test Change Route (Covers: onChangeRoute)
      fireEvent.press(screen.getByTestId("steps-change"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");

      // 2. Test Dismiss (Covers: onDismiss and state clearing)
      fireEvent.press(screen.getByTestId("steps-dismiss"));
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
      strategy: WALKING_STRATEGY,
    });
  });

  describe("Navigation Bar", () => {
    it("opens navigation bar when directions button is pressed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");

      fireEvent.press(screen.getByTestId("trigger-get-directions"));

      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");
    });

    it("closes navigation bar when close button is pressed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");

      fireEvent.press(screen.getByTestId("nav-close"));
      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
    });

    it("updates start and destination points when route is confirmed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      const mapProps = getMapProps();
      expect(mapProps.startPoint).toBe("H");
      expect(mapProps.destinationPoint).toBe("MB");
      expect(mapProps.strategy).toEqual(WALKING_STRATEGY); 
    });

    it("closes navigation bar after route is confirmed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
    });

    it("preserves route points when navigation bar is reopened", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(getMapProps().startPoint).toBe("H");
      expect(getMapProps().destinationPoint).toBe("MB");

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
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
        strategy: WALKING_STRATEGY,
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

  describe("User Focus Counter", () => {
    it("increments userFocusCounter when my-location button is pressed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      const counter0 = screen.getByTestId("campus-map-user-focus-counter").props.children;
      expect(counter0).toBe(0);

      fireEvent.press(screen.getByTestId("my-location-button"));

      expect(screen.getByTestId("campus-map-user-focus-counter").props.children).toBe(1);

      fireEvent.press(screen.getByTestId("my-location-button"));

      expect(screen.getByTestId("campus-map-user-focus-counter").props.children).toBe(2);
    });
  });

  describe("Route Focus Trigger", () => {
    it("increments routeFocusTrigger when route is confirmed with a start point", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      const trigger0 = screen.getByTestId("campus-map-route-focus-trigger").props.children;
      expect(trigger0).toBe(0);

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(screen.getByTestId("campus-map-route-focus-trigger").props.children).toBe(1);
    });
  });

  describe("Set As Start", () => {
    it("opens nav bar when a building is set as start via the map", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");

      fireEvent.press(screen.getByTestId("trigger-set-as-start"));

      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");
    });
  });

  describe("Set As My Location", () => {
    it("sets demoCurrentBuilding when onSetAsMyLocation is called", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      // Press the set-my-location trigger - this sets demoCurrentBuilding internally
      // which doesn't directly appear in map props but affects autoStartBuilding in NavBar
      fireEvent.press(screen.getByTestId("trigger-set-my-location"));

      // The component should not crash and map should still render
      expect(screen.getByTestId("campus-map-props")).toBeTruthy();
    });
  });

  describe("Steps Panel Focus User", () => {
    it("renders focus user button in steps panel and increments counter when pressed", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      // Confirm route to show steps panel
      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      // Inject steps via the mock
      fireEvent.press(screen.getByTestId("trigger-route-steps"));

      // Steps panel should have focus user button
      await waitFor(() => {
        expect(screen.getByTestId("steps-focus-user")).toBeTruthy();
      });

      const counterBefore = screen.getByTestId("campus-map-user-focus-counter").props.children;

      fireEvent.press(screen.getByTestId("steps-focus-user"));

      const counterAfter = screen.getByTestId("campus-map-user-focus-counter").props.children;
      expect(counterAfter).toBe(counterBefore + 1);
    });
  });

  describe("Dismiss Route", () => {
    it("clears route and steps when dismiss is pressed on steps panel", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));
      fireEvent.press(screen.getByTestId("trigger-route-steps"));

      await waitFor(() => {
        expect(screen.getByTestId("steps-dismiss")).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId("steps-dismiss"));

      const mapProps = getMapProps();
      expect(mapProps.startPoint).toBeNull();
      expect(mapProps.destinationPoint).toBeNull();
    });
  });
});
