import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import CampusMapScreen from "../app/CampusMapScreen";
import { WALKING_STRATEGY } from "../constants/strategies";
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import { getAvailableFloors, hasBuildingPlanAsset } from "../utils/mapAssets";
import { getNextClassFromItems, loadCachedSchedule } from "../utils/parseCourseEvents";
import { parseTransitionPayload } from "../utils/routeTransition";

jest.mock("../utils/routeTransition", () => ({
  __esModule: true,
  parseTransitionPayload: jest.fn(),
  serializeTransitionPayload: jest.fn(),
}));


jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");

  const MockIcon = (props: any) => <Text>{props?.name ?? "icon"}</Text>;

  return {
    __esModule: true,
    MaterialIcons: MockIcon,
    MaterialCommunityIcons: MockIcon,
    Ionicons: MockIcon,
    FontAwesome: MockIcon,
    default: MockIcon,
  };
});

jest.mock("expo-router", () => {
  return {
    __esModule: true,
    router: {
      push: jest.fn(),
      back: jest.fn(),
    },
    useLocalSearchParams: jest.fn(),
    useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
    useNavigation: jest.fn(() => ({ setOptions: jest.fn() })),
    Stack: {
      Screen: () => null,
    },
  };
});

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock("../components/CampusMap", () => {
  const React = require("react");
  const { View, Text, Button } = require("react-native");

  const MockCampusMap = (props: any) => (
    <View>
      <Text testID="campus-map-props">
        {JSON.stringify({
          coordinates: props.coordinates,
          focusTarget: props.focusTarget,
          startOverride: props.startOverride,
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
      <Button
        testID="trigger-building-with-map"
        title="Select Building With Map"
        onPress={() =>
          props.onBuildingSelected?.(
            { name: "H", displayName: "Hall" },
            true,
          )
        }
      />

      <Button
        testID="trigger-building-without-map"
        title="Select Building Without Map"
        onPress={() =>
          props.onBuildingSelected?.(
            { name: "EV", displayName: "EV Building" },
            false,
          )
        }
      />

      <Button
        testID="trigger-indoor-floors"
        title="Set Indoor Floors"
        onPress={() => props.onIndoorFloorsAvailable?.([1, 2, 8])}
      />
      <Button
        testID="trigger-popup-open-indoor"
        title="Open Indoor From Popup"
        onPress={() =>
          props.onViewIndoorMap?.({ name: "H", displayName: "Hall" })
        }
      />
    </View>
  );

  return {
    __esModule: true,
    default: MockCampusMap,
    CampusMap: MockCampusMap,
  };
});

jest.mock("../constants/campuses", () => ({
  CAMPUSES: {
    sgw: { coordinates: { latitude: 1, longitude: 2 } },
    loyola: { coordinates: { latitude: 3, longitude: 4 } },
  },
}));

jest.mock("../utils/mapAssets", () => ({
  getAvailableFloors: jest.fn(),
  getBuildingPlanAsset: jest.fn(() => ({ nodes: [], edges: [] })),
  hasBuildingPlanAsset: jest.fn(),
  normalizeIndoorBuildingCode: jest.fn((buildingCode: string) =>
    (buildingCode ?? "").trim().toUpperCase(),
  ),
}));

jest.mock("../components/ShuttleBusTracker", () => ({
  useShuttleBus: () => ({
    activeBuses: [],
  }),
}));


jest.mock("../components/NavigationBar", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");

  const mockBuilding = {
    name: "H",
    campusName: "sgw",
    displayName: "Hall",
    address: "1455 De Maisonneuve",
    coordinates: { latitude: 45.497, longitude: -73.579 },
    boundingBox: [
      { latitude: 45.496, longitude: -73.58 },
      { latitude: 45.497, longitude: -73.579 },
      { latitude: 45.498, longitude: -73.578 },
    ],
  };

  const MockNavigationBar = (props: any) => {
    const [result, setResult] = React.useState(undefined);

    return (
      <View>
        <Text testID="nav-visible">{props.visible ? "visible" : "hidden"}</Text>
        <Pressable
          testID="accessible-mode-toggle"
          value={props.accessibleOnly}
          onPress={() => props.onAccessibleOnlyChange?.(!props.accessibleOnly)}
        >
          <Text>Toggle Accessibility</Text>
        </Pressable>
        <Text testID="nav-use-my-location-result">
          {result ? JSON.stringify(result) : "null"}
        </Text>
        <Text testID="nav-initial-start">
          {props.initialStart ? JSON.stringify(props.initialStart) : "null"}
        </Text>
        <Text testID="nav-initial-destination">
          {props.initialDestination ? JSON.stringify(props.initialDestination) : "null"}
        </Text>

        <Text testID="nav-auto-start">
          {props.autoStartBuilding ? JSON.stringify(props.autoStartBuilding) : "null"}
        </Text>

        <Pressable
          testID="nav-confirm"
          onPress={() =>
            props.onConfirm("H", "MB", {
              mode: "walking",
              label: "Walk",
              icon: "walk",
            }, null, null, false)
          }
        >
          <Text>Confirm</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-accessible"
          onPress={() =>
            props.onConfirm("H", "MB", {
              mode: "walking",
              label: "Walk",
              icon: "walk",
            }, null, null, true)
          }
        >
          <Text>Confirm Accessible</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-nullstart"
          onPress={() =>
            props.onConfirm(null, "MB", {
              mode: "walking",
              label: "Walk",
              icon: "walk",
            }, null, null, false)
          }
        >
          <Text>Confirm Null Start</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-same-building-rooms"
          onPress={() =>
            props.onConfirm(
              mockBuilding,
              mockBuilding,
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              { label: "H-110" },
              { label: "H-920" },
            )
          }
        >
          <Text>Confirm Same Building Rooms</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-same-building-dest-room"
          onPress={() =>
            props.onConfirm(
              mockBuilding,
              mockBuilding,
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              null,
              { label: "H-920" },
            )
          }
        >
          <Text>Confirm Same Building Dest Room</Text>
        </Pressable>

        <Pressable testID="nav-start-applied" onPress={props.onInitialStartApplied}>
          <Text>Start Applied</Text>
        </Pressable>

        <Pressable testID="nav-applied" onPress={props.onInitialDestinationApplied}>
          <Text>Applied</Text>
        </Pressable>

        <Pressable
          testID="nav-use-my-location"
          onPress={() => {
            const res = props.onUseMyLocation?.();
            setResult(res);
          }}
        >
          <Text>Use My Location</Text>
        </Pressable>

        <Pressable testID="nav-close" onPress={props.onClose}>
          <Text>Close</Text>
        </Pressable>
      </View>
    );
  };

  return {
    __esModule: true,
    default: MockNavigationBar,
    NavigationBar: MockNavigationBar,
  };
});

jest.mock("../components/DirectionStepsPanel", () => {
  const React = require("react");
  const { View, Button, Text } = require("react-native");

  const MockDirectionStepsPanel = (props: any) => (
    <View testID="steps-panel">
      <Button testID="steps-dismiss" title="Dismiss" onPress={props.onDismiss} />
      <Button testID="steps-change" title="Change" onPress={props.onChangeRoute} />
      <Text testID="steps-serialized">
        {(props.steps ?? []).map((s: any) => s?.instruction).join("\n")}
      </Text>
      {props.onFocusUser && (
        <Button testID="steps-focus-user" title="Focus User" onPress={props.onFocusUser} />
      )}
    </View>
  );

  return {
    __esModule: true,
    default: MockDirectionStepsPanel,
    DirectionStepsPanel: MockDirectionStepsPanel,
  };
});

beforeEach(() => {
  // Most tests don't care about transitions; default to none.
  (parseTransitionPayload as jest.Mock).mockReturnValue(null);
});

jest.mock("../hooks/useShuttleAvailability", () => ({
  useShuttleAvailability: jest.fn(),
}));

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    // invalid bbox -> should be skipped
    { name: "BAD", displayName: "Bad", boundingBox: [] },

    // valid polygon A (distance will be 10)
    {
      name: "A",
      displayName: "A Building",
      boundingBox: [
        { latitude: 10, longitude: 0 },
        { latitude: 10, longitude: 1 },
        { latitude: 10, longitude: 2 },
      ],
    },

    // valid polygon B (distance will be 5) -> nearest
    {
      name: "B",
      displayName: "B Building",
      boundingBox: [
        { latitude: 5, longitude: 0 },
        { latitude: 5, longitude: 1 },
        { latitude: 5, longitude: 2 },
      ],
    },
  ],
}));

jest.mock("../utils/pointInPolygon", () => ({
  // return "distance" based on the first vertex latitude
  getDistanceToPolygon: jest.fn((_pt: any, polygon: any[]) => polygon[0].latitude),
}));

jest.mock("../components/ShuttleSchedulePanel", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  const Mock = (props: any) => (
    <View testID="shuttle-schedule-panel">
      <Text>Schedule</Text>
      <Pressable testID="shuttle-schedule-close" onPress={props.onClose}>
        <Text>Close</Text>
      </Pressable>
    </View>
  );
  return { __esModule: true, ShuttleSchedulePanel: Mock, default: Mock };
});

jest.mock("../components/NextClassDirectionsPanel", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");

  const MockNextClassPanel = (props: any) => {
    const [result, setResult] = React.useState(undefined);

    return (
      <View testID="next-class-panel">
        <Text testID="next-class-visible">
          {props.visible ? "visible" : "hidden"}
        </Text>

        <Text testID="next-class-info">
          {props.nextClass ? JSON.stringify(props.nextClass) : "null"}
        </Text>

        <Text testID="next-class-use-location-result">
          {result ? JSON.stringify(result) : "null"}
        </Text>

        {props.canOpenIndoorMap && props.onOpenIndoorMap ? (
          <Pressable
            testID="next-class-open-indoor"
            onPress={props.onOpenIndoorMap}
          >
            <Text>Open Indoor</Text>
          </Pressable>
        ) : null}

        <Pressable
          testID="next-class-confirm"
          onPress={() => {
            props.onConfirm("H", "MB", {
              mode: "walking",
              label: "Walk",
              icon: "walk",
            });
            props.onClose();
          }}
        >
          <Text>Confirm</Text>
        </Pressable>

        <Pressable testID="next-class-close" onPress={props.onClose}>
          <Text>Close</Text>
        </Pressable>

        <Pressable
          testID="next-class-use-location"
          onPress={() => {
            const res = props.onUseMyLocation?.();
            setResult(res);
          }}
        >
          <Text>Use Location</Text>
        </Pressable>
      </View>
    );
  };

  return {
    __esModule: true,
    default: MockNextClassPanel,
  };
});

jest.mock("../utils/parseCourseEvents", () => ({
  loadCachedSchedule: jest.fn(),
  getNextClassFromItems: jest.fn(),
}));

const getMapProps = () =>
  JSON.parse(screen.getByTestId("campus-map-props").props.children);

const renderScreen = async () => {
  render(<CampusMapScreen />);
  await waitFor(() => { }); // flush async useEffect
};

describe("CampusMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    (Location.requestForegroundPermissionsAsync as jest.Mock)
      .mockResolvedValue({ status: "granted" });

    (Location.getCurrentPositionAsync as jest.Mock)
      .mockResolvedValue({
        coords: {
          latitude: 45.497,
          longitude: -73.578,
        },
      });

    (useShuttleAvailability as jest.Mock).mockReturnValue({ available: true });
    (getAvailableFloors as jest.Mock).mockImplementation((buildingCode: string) => {
      const normalized = (buildingCode ?? "").trim().toUpperCase();
      if (normalized === "H") return [1, 2, 8];
      if (normalized === "MB") return [1, -2];
      return [];
    });
    (hasBuildingPlanAsset as jest.Mock).mockImplementation((buildingCode: string) => {
      const normalized = (buildingCode ?? "").trim().toUpperCase();
      return normalized === "H" || normalized === "MB";
    });

    (loadCachedSchedule as jest.Mock).mockResolvedValue(null);
    (getNextClassFromItems as jest.Mock).mockReturnValue(null);
  });

  it("defaults to SGW when no campus param is provided", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    await renderScreen();

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 1, longitude: 2 },
      focusTarget: "sgw",
      startOverride: null,
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
      startOverride: null,
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
      startOverride: null,
      startPoint: null,
      destinationPoint: null,
      strategy: WALKING_STRATEGY,
    });
  });

  it("passes transition exitOutdoor to CampusMap as startOverride", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: JSON.stringify({
        mode: "indoor_to_outdoor",
        originBuildingCode: "H",
        exitNodeId: "Hall_F1_building_entry_exit_1",
        exitIndoor: { buildingCode: "H", floor: 1, x: 1, y: 2 },
        exitOutdoor: { latitude: 45.0, longitude: -73.0 },
        destinationBuildingCode: "MB",
        destinationCampus: "sgw",
      }),
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      exitNodeId: "Hall_F1_building_entry_exit_1",
      exitIndoor: { buildingCode: "H", floor: 1, x: 1, y: 2 },
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      destinationBuildingCode: "MB",
      destinationCampus: "sgw",
    });

    await renderScreen();

    expect(getMapProps().startOverride).toEqual({ latitude: 45.0, longitude: -73.0 });
  });

  it("merges indoor/outdoor/indoor steps when transition includes a destination indoor room", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "loyola",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      exitNodeId: "H_EXIT_1",
      exitIndoor: { buildingCode: "H", floor: 1, x: 0, y: 0 },
      exitOutdoor: { latitude: 45, longitude: -73 },
      destinationBuildingCode: "VL",
      destinationCampus: "loyola",
      destinationIndoorRoomQuery: "VL-202-30",
    });

    await renderScreen();

    // Create an active route (start/dest) and inject outdoor steps via the CampusMap mock.
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    const serialized = screen.getByTestId("steps-serialized").props.children;
    expect(serialized).toContain("Exit H to the selected entrance");
    expect(serialized).toContain("Walk");
    expect(serialized).toContain("Enter VL and continue to VL-202-30");
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
      startOverride: null,
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
        startOverride: null,
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

  it("keeps focusTarget as user when campus param changes (prev === 'user' branch)", async () => {
    const params: any = { campus: "sgw" };
    (useLocalSearchParams as jest.Mock).mockImplementation(() => params);

    const { rerender } = render(<CampusMapScreen />);
    await waitFor(() => { });

    // set focus target to user
    fireEvent.press(screen.getByTestId("my-location-button"));
    expect(getMapProps().focusTarget).toBe("user");

    // change route param to loyola and rerender
    params.campus = "loyola";
    rerender(<CampusMapScreen />);
    await waitFor(() => { });

    // campus coords update, focusTarget stays user
    expect(getMapProps().coordinates).toEqual({ latitude: 3, longitude: 4 });
    expect(getMapProps().focusTarget).toBe("user");
  });

  it("computes nearest building on mount (skips invalid bbox and chooses nearest)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    await renderScreen();

    // our mocks make B the nearest building (distance 5 vs 10, and BAD skipped)
    await waitFor(() => {
      expect(screen.getByTestId("nav-auto-start").props.children).toContain('"name":"B"');
    });
  });

  it("opens and closes the ShuttleSchedulePanel", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    expect(screen.queryByTestId("shuttle-schedule-panel")).toBeNull();

    // calendar button has no testID; easiest is press by icon text
    // because icons are mocked to <Text>{name}</Text>
    fireEvent.press(screen.getByText("calendar-clock"));

    expect(screen.getByTestId("shuttle-schedule-panel")).toBeTruthy();

    fireEvent.press(screen.getByTestId("shuttle-schedule-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("shuttle-schedule-panel")).toBeNull();
    });
  });

  it("does not toggle shuttle when shuttle is not available (and label shows not available)", async () => {
    (useShuttleAvailability as jest.Mock).mockReturnValue({ available: false });
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    await renderScreen();

    const btn = screen.getByTestId("show-shuttle-button");
    expect(btn.props.accessibilityState.disabled).toBe(true);
    expect(btn.props.accessibilityLabel).toBe("Shuttle not available");

    // press should do nothing
    fireEvent.press(btn);

    // icon should remain bus-stop (showShuttle false)
    expect(screen.getByText("bus-stop")).toBeTruthy();
  });

  it("toggles shuttle when available and auto-hides if availability becomes false while showing", async () => {
    const shuttle = { available: true };
    (useShuttleAvailability as jest.Mock).mockImplementation(() => shuttle);
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    const { rerender } = render(<CampusMapScreen />);
    await waitFor(() => { });

    const btn = screen.getByTestId("show-shuttle-button");
    expect(btn.props.accessibilityLabel).toBe("Show shuttle");

    // turn on
    fireEvent.press(btn);
    await waitFor(() => {
      expect(screen.getByText("bus-clock")).toBeTruthy();
    });

    // availability flips false -> effect should hide shuttle
    shuttle.available = false;
    rerender(<CampusMapScreen />);
    await waitFor(() => {
      expect(screen.getByText("bus-stop")).toBeTruthy();
    });
  });

  it("clears initialStart and initialDestination when nav is closed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    // set start
    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    expect(screen.getByTestId("nav-visible").props.children).toBe("visible");
    expect(screen.getByTestId("nav-initial-start").props.children).not.toBe("null");

    // set destination
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    expect(screen.getByTestId("nav-initial-destination").props.children).not.toBe("null");

    // close should clear both
    fireEvent.press(screen.getByTestId("nav-close"));
    await waitFor(() => {
      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
      expect(screen.getByTestId("nav-initial-start").props.children).toBe("null");
      expect(screen.getByTestId("nav-initial-destination").props.children).toBe("null");
    });
  });

  it("covers onInitialStartApplied and does not increment routeFocusTrigger when start is null", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    // cover onInitialStartApplied
    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    fireEvent.press(screen.getByTestId("nav-start-applied"));
    await waitFor(() => {
      expect(screen.getByTestId("nav-initial-start").props.children).toBe("null");
    });

    const trigger0 = screen.getByTestId("campus-map-route-focus-trigger").props.children;

    // confirm route with null start -> should NOT increment routeFocusTrigger
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm-nullstart"));

    expect(screen.getByTestId("campus-map-route-focus-trigger").props.children).toBe(trigger0);
  });

  it("opens indoor map with navOrigin/navDest when same-building rooms are confirmed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm-same-building-rooms"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: "H",
        floors: JSON.stringify([1, 2, 8]),
        navOrigin: "H-110",
        navDest: "H-920",
        accessibleOnly: "false",
      },
    });
    expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
  });

  it("opens indoor map with roomQuery when same-building destination room is confirmed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm-same-building-dest-room"));

    expect(router.push).toHaveBeenCalledWith({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: "H",
        floors: JSON.stringify([1, 2, 8]),
        roomQuery: "H-920",
        accessibleOnly: "false",
      },
    });
    expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
  });

  describe("Next Class Directions Panel", () => {
    it("keeps next class panel hidden when no next class is available", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      (loadCachedSchedule as jest.Mock).mockResolvedValue([]);
      (getNextClassFromItems as jest.Mock).mockReturnValue(null);

      await renderScreen();

      expect(screen.getByTestId("next-class-visible").props.children).toBe("hidden");

      fireEvent.press(screen.getByTestId("next-class-button"));

      expect(screen.getByTestId("next-class-visible").props.children).toBe("hidden");
    });

    it("opens next class panel when next-class button is pressed", async () => {
      const mockSchedule = [
        {
          id: "1",
          kind: "class",
          courseName: "COMP 335",
          start: new Date(Date.now() + 3_600_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW MB 1.210",
          campus: "SGW",
          building: "MB",
          room: "1.210",
          level: "1",
        },
      ];

      (loadCachedSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockSchedule[0]);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      expect(screen.getByTestId("next-class-visible").props.children).toBe("hidden");

      fireEvent.press(screen.getByTestId("next-class-button"));

      expect(screen.getByTestId("next-class-visible").props.children).toBe("visible");
    });

    it("closes next class panel when close button is pressed", async () => {
      const mockSchedule = [
        {
          id: "1",
          kind: "class",
          courseName: "COMP 335",
          start: new Date(Date.now() + 3_600_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW MB 1.210",
          campus: "SGW",
          building: "MB",
          room: "1.210",
          level: "1",
        },
      ];

      (loadCachedSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockSchedule[0]);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("next-class-button"));
      expect(screen.getByTestId("next-class-visible").props.children).toBe("visible");

      fireEvent.press(screen.getByTestId("next-class-close"));
      expect(screen.getByTestId("next-class-visible").props.children).toBe("hidden");
    });

    it("loads schedule from cache on mount", async () => {
      const mockSchedule = [
        {
          id: "1",
          kind: "class",
          courseName: "COMP 335",
          start: new Date(Date.now() + 3_600_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW MB 1.210",
          campus: "SGW",
          building: "MB",
          room: "1.210",
          level: "1",
        },
      ];

      (loadCachedSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockSchedule[0]);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      expect(loadCachedSchedule).toHaveBeenCalled();
    });

    it("confirms route from next class panel", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("next-class-button"));
      fireEvent.press(screen.getByTestId("next-class-confirm"));

      // Panel should close and route should be set
      expect(screen.getByTestId("next-class-visible").props.children).toBe("hidden");
      const mapProps = getMapProps();
      expect(mapProps.startPoint).toBe("H");
      expect(mapProps.destinationPoint).toBe("MB");
    });

    it("recomputes next class when panel is opened", async () => {
      const mockSchedule = [
        {
          id: "1",
          kind: "class",
          courseName: "COMP 335",
          start: new Date(Date.now() + 3_600_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW MB 1.210",
          campus: "SGW",
          building: "MB",
          room: "1.210",
          level: "1",
        },
      ];

      (loadCachedSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockSchedule[0]);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      // Open the panel - this should trigger recompute
      fireEvent.press(screen.getByTestId("next-class-button"));

      // getNextClassFromItems should have been called again
      expect(getNextClassFromItems).toHaveBeenCalled();
    });

    it("displays next class info when schedule is loaded", async () => {
      const mockNextClass = {
        id: "1",
        kind: "class",
        courseName: "SOEN 390",
        start: new Date(Date.now() + 3_600_000),
        end: new Date(Date.now() + 7_200_000),
        location: "SGW H 820",
        campus: "SGW",
        building: "H",
        room: "820",
        level: "8",
      };

      (loadCachedSchedule as jest.Mock).mockResolvedValue([mockNextClass]);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockNextClass);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("next-class-button"));

      await waitFor(() => {
        const nextClassInfo = screen.getByTestId("next-class-info").props.children;
        expect(nextClassInfo).toContain("SOEN 390");
      });
    });

    it("opens indoor map for the next class and prefills the room query", async () => {
      const mockNextClass = {
        id: "1",
        kind: "class",
        courseName: "COMP 335",
        start: new Date(Date.now() + 3_600_000),
        end: new Date(Date.now() + 7_200_000),
        location: "SGW MB 1.210",
        campus: "SGW",
        building: "MB",
        room: "1.210",
        level: "1",
      };

      (loadCachedSchedule as jest.Mock).mockResolvedValue([mockNextClass]);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockNextClass);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("next-class-button"));

      await waitFor(() => {
        expect(screen.getByTestId("next-class-open-indoor")).toBeTruthy();
      });

      fireEvent.press(screen.getByTestId("next-class-open-indoor"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "MB",
          floors: JSON.stringify([1, -2]),
          roomQuery: "MB-1.210",
          accessibleOnly: "false",
        },
      });
    });

    it("shows Indoor button when selected building has a map and pushes indoor screen with floors", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-building-with-map"));
      fireEvent.press(screen.getByTestId("trigger-popup-open-indoor"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "false",
        },
      });
    });

    it("hides Indoor button when selected building does not have a map", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-building-without-map"));

      expect(screen.queryByTestId("popup-view-indoor")).toBeNull();
    });

    it("falls back to empty schedule when cached schedule loading fails", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      (loadCachedSchedule as jest.Mock).mockRejectedValue(new Error("cache failed"));
      (getNextClassFromItems as jest.Mock).mockReturnValue(null);

      await renderScreen();

      await waitFor(() => {
        expect(loadCachedSchedule).toHaveBeenCalled();
      });

      expect(screen.getByTestId("next-class-visible").props.children).toBe("hidden");
    });

    it("returns demoCurrentBuilding from nav onUseMyLocation when available", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-set-my-location"));
      fireEvent.press(screen.getByTestId("nav-use-my-location"));

      await waitFor(() => {
        expect(screen.getByTestId("nav-use-my-location-result").props.children).toContain('"name":"EV"');
      });
    });

    it("returns autoStartBuilding from nav onUseMyLocation when demo location is not set", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("nav-use-my-location"));

      await waitFor(() => {
        expect(screen.getByTestId("nav-use-my-location-result").props.children).toContain('"name":"B"');
      });
    });

    it("returns null from nav onUseMyLocation when neither demo nor autoStartBuilding exists", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: "denied" });

      await renderScreen();

      fireEvent.press(screen.getByTestId("nav-use-my-location"));

      expect(screen.getByTestId("nav-use-my-location-result").props.children).toBe("null");
    });

    it("returns demoCurrentBuilding from next class panel onUseMyLocation", async () => {
      const mockSchedule = [
        {
          id: "1",
          kind: "class",
          courseName: "COMP 335",
          start: new Date(Date.now() + 3_600_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW MB 1.210",
          campus: "SGW",
          building: "MB",
          room: "1.210",
          level: "1",
        },
      ];

      (loadCachedSchedule as jest.Mock).mockResolvedValue(mockSchedule);
      (getNextClassFromItems as jest.Mock).mockReturnValue(mockSchedule[0]);
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-set-my-location"));
      fireEvent.press(screen.getByTestId("next-class-button"));
      fireEvent.press(screen.getByTestId("next-class-use-location"));

      await waitFor(() => {
        expect(screen.getByTestId("next-class-use-location-result").props.children).toContain('"name":"EV"');
      });
    });

    it("sets shuttle button accessibility label to Hide shuttle when shuttle is visible", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      (useShuttleAvailability as jest.Mock).mockReturnValue({ available: true });

      await renderScreen();

      const btn = screen.getByTestId("show-shuttle-button");
      expect(btn.props.accessibilityLabel).toBe("Show shuttle");

      fireEvent.press(btn);

      await waitFor(() => {
        expect(screen.getByTestId("show-shuttle-button").props.accessibilityLabel).toBe("Hide shuttle");
      });
    });

    it("does not show steps panel when route exists but steps are empty", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(screen.queryByTestId("steps-panel")).toBeNull();
    });

    it("hides Indoor button after switching from a mapped building to a non-mapped building", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-building-with-map"));
      fireEvent.press(screen.getByTestId("trigger-building-without-map"));
      expect(screen.queryByTestId("popup-view-indoor")).toBeNull();
    });

    it("uses the latest indoor floors when navigating to Indoor", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-building-with-map"));
      fireEvent.press(screen.getByTestId("trigger-indoor-floors"));
      fireEvent.press(screen.getByTestId("trigger-popup-open-indoor"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "false",
        },
      });
    });

    it("passes accessibleOnly true to IndoorMapScreen when accessibility mode is on", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("accessible-mode-toggle"));

      expect(screen.getByTestId("accessible-mode-toggle").props.value).toBe(true);

      fireEvent.press(screen.getByTestId("nav-confirm-accessible"));
      fireEvent.press(screen.getByTestId("trigger-popup-open-indoor"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/IndoorMapScreen",
        params: expect.objectContaining({
          accessibleOnly: "true",
        }),
      });
    });

    it("uses the same normalized indoor route when opening from the building popup flow", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-popup-open-indoor"));

      expect(router.push).toHaveBeenCalledWith({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "false",
        },
      });
    });
  });
});
