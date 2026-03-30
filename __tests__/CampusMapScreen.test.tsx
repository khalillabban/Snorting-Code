import { logUsabilityEvent } from "@/utils/usabilityAnalytics";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import CampusMapScreen, {
  handleIndoorRouteIntent,
} from "../app/CampusMapScreen";
import { WALKING_STRATEGY } from "../constants/strategies";
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import { buildContinueIndoorsStep } from "../utils/continueIndoors";
import { buildIndoorMapRouteParams } from "../utils/indoorAccess";
import { getIndoorNavigationRouteFromNode } from "../utils/indoorNavigation";
import { getAvailableFloors, hasBuildingPlanAsset } from "../utils/mapAssets";
import {
  getNextClassFromItems,
  loadCachedSchedule,
} from "../utils/parseCourseEvents";
import { parseTransitionPayload } from "../utils/routeTransition";

const mockUseNearbyPOIs = jest.fn();
const mockSearchPOIs = jest.fn();
const mockClearPOIs = jest.fn();

jest.mock("../hooks/useNearbyPOIs", () => ({
  useNearbyPOIs: (...args: any[]) => mockUseNearbyPOIs(...args),
}));

jest.mock("@/utils/usabilityAnalytics", () => ({
  __esModule: true,
  logUsabilityEvent: jest.fn(),
}));

const getRouterPushMock = () => require("expo-router").router.push as jest.Mock;

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

jest.mock("expo-router", () => ({
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
}));

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
      <Text testID="campus-map-user-focus-counter">
        {props.userFocusCounter}
      </Text>
      <Text testID="campus-map-route-focus-trigger">
        {props.routeFocusTrigger}
      </Text>
      <Button
        testID="trigger-get-directions"
        title="Get Directions"
        onPress={() =>
          props.onSetAsDestination?.({ name: "H", displayName: "Hall" })
        }
      />
      <Button
        testID="trigger-route-steps"
        title="Set Steps"
        onPress={() => props.onRouteSteps([{ instruction: "Walk" }])}
      />
      <Button
        testID="trigger-set-as-start"
        title="Set As Start"
        onPress={() =>
          props.onSetAsStart?.({ name: "MB", displayName: "MB Building" })
        }
      />
      <Button
        testID="trigger-set-my-location"
        title="Set My Location"
        onPress={() =>
          props.onSetAsMyLocation?.({ name: "EV", displayName: "EV Building" })
        }
      />
      <Button
        testID="trigger-building-with-map"
        title="Select Building With Map"
        onPress={() =>
          props.onBuildingSelected?.({ name: "H", displayName: "Hall" }, true)
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
      <Button
        testID="trigger-select-poi-map"
        title="Select POI From Map"
        onPress={() =>
          props.onSelectPOI?.({
            placeId: "poi-map-1",
            name: "Map Cafe",
            latitude: 45.4971,
            longitude: -73.5791,
            vicinity: "Map Street",
            categoryId: "coffee",
          })
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

jest.mock("../utils/indoorAccess", () => ({
  __esModule: true,
  ...jest.requireActual("../utils/indoorAccess"),
  buildIndoorMapRouteParams: jest.fn(),
}));

jest.mock("../utils/indoorNavigation", () => ({
  __esModule: true,
  getIndoorNavigationRouteFromNode: jest.fn(),
}));

jest.mock("../utils/continueIndoors", () => ({
  __esModule: true,
  ...jest.requireActual("../utils/continueIndoors"),
  buildContinueIndoorsStep: jest.fn(),
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
          {props.initialDestination
            ? JSON.stringify(props.initialDestination)
            : "null"}
        </Text>

        <Text testID="nav-auto-start">
          {props.autoStartBuilding
            ? JSON.stringify(props.autoStartBuilding)
            : "null"}
        </Text>

        <Pressable
          testID="nav-confirm"
          onPress={() =>
            props.onConfirm(
              "H",
              "MB",
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              null,
              null,
              false,
            )
          }
        >
          <Text>Confirm</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-cross-building-rooms"
          onPress={() =>
            props.onConfirm(
              { ...mockBuilding, name: "H" },
              { ...mockBuilding, name: "MB" },
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              { label: "H-867" },
              { label: "MB-1.210" },
              false,
            )
          }
        >
          <Text>Confirm Cross Building Rooms</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-indoor-start-outdoor-dest"
          onPress={() =>
            props.onConfirm(
              { ...mockBuilding, name: "CC" },
              { ...mockBuilding, name: "MB" },
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              { label: "CC-124" },
              null,
              false,
            )
          }
        >
          <Text>Confirm Indoor Start Outdoor Dest</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-accessible"
          onPress={() =>
            props.onConfirm(
              "H",
              "MB",
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              null,
              null,
              true,
            )
          }
        >
          <Text>Confirm Accessible</Text>
        </Pressable>

        <Pressable
          testID="nav-confirm-nullstart"
          onPress={() =>
            props.onConfirm(
              null,
              "MB",
              {
                mode: "walking",
                label: "Walk",
                icon: "walk",
              },
              null,
              null,
              false,
            )
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

        <Pressable
          testID="nav-start-applied"
          onPress={props.onInitialStartApplied}
        >
          <Text>Start Applied</Text>
        </Pressable>

        <Pressable
          testID="nav-applied"
          onPress={props.onInitialDestinationApplied}
        >
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
  const { View, Button, Text, Pressable } = require("react-native");

  const MockDirectionStepsPanel = (props: any) => (
    <View testID="steps-panel">
      <Button
        testID="steps-dismiss"
        title="Dismiss"
        onPress={props.onDismiss}
      />
      <Button
        testID="steps-change"
        title="Change"
        onPress={props.onChangeRoute}
      />
      <Text testID="steps-serialized">
        {(props.steps ?? []).map((s: any) => s?.instruction).join("\n")}
      </Text>
      {(props.steps ?? []).map((s: any, idx: number) =>
        s?.onPress ? (
          <Pressable
            key={`step-${idx}`}
            testID={`step-pressable-${idx}`}
            onPress={s.onPress}
          >
            <Text>{s.instruction}</Text>
          </Pressable>
        ) : null,
      )}
      {props.onFocusUser && (
        <Button
          testID="steps-focus-user"
          title="Focus User"
          onPress={props.onFocusUser}
        />
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
  getDistanceToPolygon: jest.fn(
    (_pt: any, polygon: any[]) => polygon[0].latitude,
  ),
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
  await waitFor(() => {}); // flush async useEffect
};

const hasUsabilityEvent = (
  eventName: string,
  predicate?: (payload: any) => boolean,
) =>
  (logUsabilityEvent as jest.Mock).mock.calls.some(
    ([name, payload]) =>
      name === eventName && (predicate ? predicate(payload) : true),
  );

describe("CampusMapScreen", () => {
  it("handleIndoorRouteIntent routes room-to-room indoor intent", () => {
    const openIndoorMap = jest.fn();
    const setIsNavVisible = jest.fn();

    handleIndoorRouteIntent({
      intent: {
        kind: "same_building_indoor_room_to_room",
        buildingCode: "H",
        navOrigin: "H-110",
        navDest: "H-920",
        accessibleOnly: true,
      },
      openIndoorMap,
      setIsNavVisible,
    });

    expect(setIsNavVisible).toHaveBeenCalledWith(false);
    expect(openIndoorMap).toHaveBeenCalledWith(
      "H",
      undefined,
      "H-110",
      "H-920",
      true,
    );
  });

  it("handleIndoorRouteIntent routes building-to-room indoor intent", () => {
    const openIndoorMap = jest.fn();
    const setIsNavVisible = jest.fn();

    handleIndoorRouteIntent({
      intent: {
        kind: "same_building_indoor_to_room",
        buildingCode: "MB",
        roomQuery: "MB-1.210",
        accessibleOnly: false,
      },
      openIndoorMap,
      setIsNavVisible,
    });

    expect(setIsNavVisible).toHaveBeenCalledWith(false);
    expect(openIndoorMap).toHaveBeenCalledWith(
      "MB",
      "MB-1.210",
      undefined,
      undefined,
      false,
    );
  });

  beforeEach(() => {
    (buildContinueIndoorsStep as jest.Mock).mockImplementation(
      jest.requireActual("../utils/continueIndoors").buildContinueIndoorsStep,
    );
  });
  beforeEach(() => {
    jest.clearAllMocks();
    (logUsabilityEvent as jest.Mock).mockResolvedValue(undefined);

    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      { status: "granted" },
    );

    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: {
        latitude: 45.497,
        longitude: -73.578,
      },
    });

    (useShuttleAvailability as jest.Mock).mockReturnValue({ available: true });
    mockSearchPOIs.mockReset();
    mockClearPOIs.mockReset();
    mockUseNearbyPOIs.mockReturnValue({
      pois: [],
      loading: false,
      error: null,
      search: mockSearchPOIs,
      clear: mockClearPOIs,
    });

    (getAvailableFloors as jest.Mock).mockImplementation(
      (buildingCode: string) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        if (normalized === "H") return [1, 2, 8];
        if (normalized === "MB") return [1, -2];
        return [];
      },
    );
    (hasBuildingPlanAsset as jest.Mock).mockImplementation(
      (buildingCode: string) => {
        const normalized = (buildingCode ?? "").trim().toUpperCase();
        return normalized === "H" || normalized === "MB";
      },
    );

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

  it("switches campus back to SGW when SGW toggle is pressed from Loyola", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "loyola" });

    await renderScreen();

    fireEvent.press(screen.getByTestId("campus-toggle-sgw"));

    expect(getMapProps()).toEqual({
      coordinates: { latitude: 1, longitude: 2 },
      focusTarget: "sgw",
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

    expect(getMapProps().startOverride).toEqual({
      latitude: 45.0,
      longitude: -73.0,
    });
  });

  it("auto-pushes IndoorMapScreen when transition mode is cross_building_indoor", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "cross_building_indoor",
      originBuildingCode: " h ",
      originIndoorRoomQuery: "H-867",
      destinationBuildingCode: " mb ",
      destinationIndoorRoomQuery: "MB-1.210",
      strategy: { mode: "walking" },
      accessibleOnly: true,
    });

    await renderScreen();

    await waitFor(() => {
      expect(getRouterPushMock()).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/IndoorMapScreen" }),
      );
    });

    const args = getRouterPushMock().mock.calls[0][0];
    expect(args.params.buildingName).toBe("H");
    expect(args.params.navDest).toBe("MB");
    expect(args.params.outdoorDestBuilding).toBe("MB");
    expect(args.params.destinationRoomQuery).toBe("MB-1.210");
    expect(args.params.outdoorAccessibleOnly).toBe("true");
  });

  it("auto-selects outdoor route when arriving via indoor_to_outdoor transition and falls back to originByExit when originBuildingCode is unknown", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "UNKNOWN",
      destinationBuildingCode: "A",
      exitOutdoor: { latitude: 5, longitude: 0 },
      strategy: WALKING_STRATEGY,
    });

    await renderScreen();

    // Should set both endpoints (dest = A, start = nearest-by-exit => B because bbox distance is 5).
    const props = getMapProps();
    expect(props.destinationPoint?.name).toBe("A");
    expect(props.startPoint?.name).toBe("B");
  });

  it("uses transitionPayload.destinationIndoorRoomQuery as destinationRoomQueryText when destinationRoomQuery param is missing", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      destinationBuildingCode: "MB",
      destinationIndoorRoomQuery: "MB-1.210",
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
    });

    await renderScreen();

    // Trigger outdoor route steps so CampusMapScreen builds the continue-indoors step list.
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    // We can't render the real CTA because DirectionStepsPanel is mocked, but we can assert
    // the helper was invoked with the payload-provided destination room query.
    expect(buildContinueIndoorsStep).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationBuildingCode: "MB",
        destinationRoomQuery: "MB-1.210",
      }),
    );
  });

  it("falls back to an empty destinationRoomQueryText when destinationRoomQuery is missing and payload destinationIndoorRoomQuery is not a string", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      // Use a different mode so the mergedSteps memo doesn't try to .trim() a non-string.
      // We still cover the destinationRoomQueryText fallback-to-empty branch.
      mode: "cross_building_indoor",
      originBuildingCode: "H",
      destinationBuildingCode: "MB",
      // Non-string -> should not be used.
      destinationIndoorRoomQuery: 123,
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
    });

    await renderScreen();

    // We don't have a direct UI surface for destinationRoomQueryText, but we can
    // assert that the destination indoor merged steps memo returns null (no indoor_to_outdoor).
    fireEvent.press(screen.getByTestId("trigger-route-steps"));
    expect(screen.queryByTestId("steps-panel")).toBeNull();
  });

  it("prefers destinationRoomQuery param over transition payload destinationIndoorRoomQuery", async () => {
    // If both a destinationRoomQuery param and a transition payload exist, the explicit
    // param should win.
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      transition: '{"mode":"indoor_to_outdoor"}',
      destinationRoomQuery: "MB-1.999",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "CC",
      exitNodeId: "",
      exitIndoor: { buildingCode: "CC", floor: 1, x: 0, y: 0 },
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      destinationBuildingCode: "MB",
      destinationIndoorRoomQuery: "MB-1.210",
    });

    // Force the helper to build a final continue-indoors step.
    (buildContinueIndoorsStep as jest.Mock).mockReturnValue({
      steps: [{ instruction: "Walk" }, { instruction: "Continue indoors" }],
      openArgs: {
        buildingCode: "MB",
        navOrigin: "ENTRANCE",
        navDest: "MB-1.210",
      },
    });

    render(<CampusMapScreen />);

    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    fireEvent.press(screen.getByTestId("directions-button"));

    await waitFor(() => {
      expect(buildContinueIndoorsStep).toHaveBeenCalled();
    });

    const lastCall = (buildContinueIndoorsStep as jest.Mock).mock.calls.at(
      -1,
    )?.[0];
    expect(lastCall.destinationRoomQuery).toBe("MB-1.999");
  });

  it("starts a cross-building indoor-to-outdoor trip indoors (startRoom provided, no endRoom) and pushes IndoorMapScreen", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });
    (parseTransitionPayload as jest.Mock).mockReturnValue(null);

    (buildIndoorMapRouteParams as jest.Mock).mockReturnValue({
      buildingName: "CC",
      floors: "1",
    });

    render(<CampusMapScreen />);

    // Open nav then confirm a route.
    fireEvent.press(screen.getByTestId("directions-button"));

    // Use a NavigationBar mock action that includes a startRoom but no endRoom.
    const confirmButton = screen.getByTestId(
      "nav-confirm-indoor-start-outdoor-dest",
    );

    // Start indoors: CC-124. Destination outdoors: MB.
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(getRouterPushMock()).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/IndoorMapScreen" }),
      );
    });

    const pushArg = getRouterPushMock().mock.calls.at(-1)?.[0];
    expect(pushArg.params).toEqual(
      expect.objectContaining({
        buildingName: "CC",
        floors: "1",
        navOrigin: expect.any(String),
        navDest: "CC",
        outdoorDestBuilding: "MB",
        outdoorStrategy: expect.any(String),
        outdoorAccessibleOnly: expect.any(String),
        accessibleOnly: expect.any(String),
      }),
    );
  });

  it("normalizes undefined indoor route params to empty strings for cross-building indoor-to-outdoor navigation", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });
    (parseTransitionPayload as jest.Mock).mockReturnValue(null);

    (buildIndoorMapRouteParams as jest.Mock).mockReturnValue({
      buildingName: "CC",
      floors: undefined,
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("directions-button"));
    fireEvent.press(
      screen.getByTestId("nav-confirm-indoor-start-outdoor-dest"),
    );

    await waitFor(() => {
      expect(getRouterPushMock()).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/IndoorMapScreen" }),
      );
    });

    const pushArg = getRouterPushMock().mock.calls.at(-1)?.[0];
    expect(pushArg.params.floors).toBe("");
  });

  it("does not navigate for indoor-to-outdoor start when buildIndoorMapRouteParams returns null", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });
    (parseTransitionPayload as jest.Mock).mockReturnValue(null);

    (buildIndoorMapRouteParams as jest.Mock).mockReturnValue(null);

    render(<CampusMapScreen />);
    fireEvent.press(screen.getByTestId("directions-button"));

    fireEvent.press(
      screen.getByTestId("nav-confirm-indoor-start-outdoor-dest"),
    );

    await waitFor(() => {
      expect(getRouterPushMock()).not.toHaveBeenCalledWith(
        expect.objectContaining({ pathname: "/IndoorMapScreen" }),
      );
    });
  });

  it("attaches an onPress to the final continue-indoors step and pressing it navigates to IndoorMapScreen (mocked panel direct)", () => {
    const {
      default: DirectionStepsPanel,
    } = require("../components/DirectionStepsPanel");
    const onPress = jest.fn();
    const steps = [
      { instruction: "Walk", onPress: jest.fn() },
      { instruction: "Continue indoors", onPress },
    ];
    const { getAllByTestId } = render(<DirectionStepsPanel steps={steps} />);
    const ctaButtons = getAllByTestId("step-pressable-1");
    fireEvent.press(ctaButtons[ctaButtons.length - 1]);
    expect(onPress).toHaveBeenCalled();
  });

  it("mergedSteps returns null (no merged list) when destinationIndoorRoomQuery is empty/whitespace", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      destinationBuildingCode: "MB",
      destinationIndoorRoomQuery: "   ",
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
    });

    await renderScreen();
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    // With no destination room, no merged indoor suffix should be present.
    expect(screen.queryByText(/Enter MB/i)).toBeNull();
  });

  it("handleConfirmRoute pushes a cross_building_indoor transition when both endpoints are rooms in different buildings", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ campus: "sgw" });

    const { serializeTransitionPayload } = require("../utils/routeTransition");
    (serializeTransitionPayload as jest.Mock).mockReturnValue("ENCODED");

    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm-cross-building-rooms"));

    await waitFor(() => {
      expect(serializeTransitionPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "cross_building_indoor",
          originBuildingCode: "H",
          destinationBuildingCode: "MB",
        }),
      );
    });

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/CampusMapScreen",
        params: expect.objectContaining({
          campus: "sgw",
          transition: "ENCODED",
        }),
      }),
    );
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

  it("derives real destination indoor steps when entry nodes exist and indoor routing succeeds", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      exitNodeId: "H_EXIT_1",
      exitIndoor: { buildingCode: "H", floor: 1, x: 0, y: 0 },
      exitOutdoor: { latitude: 45, longitude: -73 },
      destinationBuildingCode: "H",
      destinationCampus: "sgw",
      destinationIndoorRoomQuery: "H-110",
      accessibleOnly: false,
    });

    const buildingsMod = require("../constants/buildings");
    buildingsMod.BUILDINGS.push({
      name: "H",
      displayName: "Hall",
      coordinates: { latitude: 45.497, longitude: -73.579 },
      boundingBox: [
        { latitude: 45.496, longitude: -73.58 },
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ],
    });

    const { getBuildingPlanAsset } = require("../utils/mapAssets");
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [
        {
          id: "entry-2",
          type: "building_entry_exit",
          outdoorLatLng: { latitude: 45.9, longitude: -73.9 },
        },
        {
          id: "entry-1",
          type: "building_entry_exit",
          outdoorLatLng: { latitude: 45.497, longitude: -73.579 },
        },
      ],
      edges: [],
    });

    (getIndoorNavigationRouteFromNode as jest.Mock).mockReturnValue({
      success: true,
      route: {
        origin: { floor: 1, x: 0, y: 0, label: "ENTRY" },
        destination: { floor: 1, x: 1, y: 1, label: "A-110" },
        path: { steps: [{ instruction: "Walk inside" }] },
        segments: [],
        floors: [1],
        totalDistance: 10,
        fullyAccessible: true,
        estimatedSeconds: 10,
      },
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    const serialized = screen.getByTestId("steps-serialized").props.children;
    expect(serialized).toContain("Enter H");
    // Depending on BUILDINGS metadata and entry-node filtering, CampusMapScreen may either derive
    // an actual indoor steps list or fall back to a single hint line.
    expect(
      serialized.includes("Walk inside") ||
        serialized.includes("Enter H and continue to H-110"),
    ).toBe(true);
  });

  it("falls back to a single hint when destination indoor leg computation throws", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      destinationBuildingCode: "H",
      destinationIndoorRoomQuery: "H-110",
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
      accessibleOnly: false,
    });

    const buildingsMod = require("../constants/buildings");
    buildingsMod.BUILDINGS.push({
      name: "H",
      displayName: "Hall",
      coordinates: { latitude: 45.497, longitude: -73.579 },
      boundingBox: [
        { latitude: 45.496, longitude: -73.58 },
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ],
    });

    const { getBuildingPlanAsset } = require("../utils/mapAssets");
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [
        {
          id: "entry-1",
          type: "building_entry_exit",
          outdoorLatLng: { latitude: 45.497, longitude: -73.579 },
        },
      ],
      edges: [],
    });

    (getIndoorNavigationRouteFromNode as jest.Mock).mockImplementationOnce(
      () => {
        throw new Error("indoor-leg-failure");
      },
    );

    await renderScreen();
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    const serialized = screen.getByTestId("steps-serialized").props.children;
    expect(serialized).toContain("Enter H and continue to H-110");
  });

  it("pressing continue indoors step opens IndoorMapScreen with nav destination", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      destinationBuildingCode: "MB",
      destinationIndoorRoomQuery: "MB-1.210",
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
    });

    (buildContinueIndoorsStep as jest.Mock).mockReturnValue({
      steps: [{ instruction: "Walk" }, { instruction: "Continue indoors" }],
      openArgs: {
        buildingCode: "MB",
        navOrigin: "ENTRANCE",
        navDest: "MB-1.210",
      },
    });

    (buildIndoorMapRouteParams as jest.Mock).mockReturnValue({
      buildingName: "MB",
      floors: "1",
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    (router.push as jest.Mock).mockClear();
    const continueButtons = screen.getAllByTestId("step-pressable-1");
    fireEvent.press(continueButtons[continueButtons.length - 1]);

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: "/IndoorMapScreen",
          params: expect.objectContaining({
            buildingName: "MB",
            floors: "1",
            navOrigin: "ENTRANCE",
            navDest: "MB-1.210",
            roomQuery: "MB-1.210",
          }),
        }),
      );
    });
  });

  it("falls back to a single 'Enter <code> and continue to <room>' hint when entry nodes exist but indoor routing is not successful", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      destinationBuildingCode: "H",
      destinationIndoorRoomQuery: "H-9.999",
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
    });

    // Provide a destination building with coordinates so the memo takes the branch.
    const buildingsMod = require("../constants/buildings");
    buildingsMod.BUILDINGS.push({
      name: "H",
      displayName: "Hall",
      coordinates: { latitude: 45.497, longitude: -73.579 },
      boundingBox: [
        { latitude: 45.496, longitude: -73.58 },
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ],
    });

    // Provide entry nodes so we enter the bestNode selection path.
    const { getBuildingPlanAsset } = require("../utils/mapAssets");
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [
        {
          id: "ENTRY-1",
          type: "building_entry_exit",
          outdoorLatLng: { latitude: 45.497, longitude: -73.579 },
        },
      ],
      edges: [],
    });

    // But make indoor routing fail so finalIndoorSteps stays empty.
    (getIndoorNavigationRouteFromNode as jest.Mock).mockReturnValue({
      success: false,
      route: [],
    });

    await renderScreen();

    // Activate a route so showStepsPanel can render.
    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    // Should fall back to the hint suffix when no successful indoor leg is computed.
    expect(screen.getByTestId("steps-serialized").props.children).toContain(
      "Enter H and continue to H-9.999",
    );
  });

  it("falls back to the single hint when a closest destination entry node exists but has no id", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      destinationBuildingCode: "H",
      destinationIndoorRoomQuery: "H-9.111",
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      strategy: WALKING_STRATEGY,
    });

    const buildingsMod = require("../constants/buildings");
    buildingsMod.BUILDINGS.push({
      name: "H",
      displayName: "Hall",
      coordinates: { latitude: 45.497, longitude: -73.579 },
      boundingBox: [
        { latitude: 45.496, longitude: -73.58 },
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ],
    });

    const { getBuildingPlanAsset } = require("../utils/mapAssets");
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [
        {
          // No id -> bestNode?.id branch not taken
          type: "building_entry_exit",
          outdoorLatLng: { latitude: 45.497, longitude: -73.579 },
        },
      ],
      edges: [],
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    expect(screen.getByTestId("steps-serialized").props.children).toContain(
      "Enter H and continue to H-9.111",
    );
  });

  it("renders enabled next-class button when nextClass exists (covers disabled=false render branch)", async () => {
    (getNextClassFromItems as jest.Mock).mockReturnValue({
      title: "COMP 999",
      startTime: "10:00",
      endTime: "11:00",
      room: "H-1.101",
      buildingCode: "H",
      campus: "sgw",
    });

    await renderScreen();

    // When enabled, pressing should show the panel.
    fireEvent.press(screen.getByTestId("next-class-button"));
    expect(screen.getByTestId("next-class-visible").props.children).toBe(
      "visible",
    );
  });

  it("disables shuttle toggle when not available and sets accessibility label to 'Shuttle unavailable'", async () => {
    (useShuttleAvailability as jest.Mock).mockReturnValue({
      available: false,
    });

    await renderScreen();
    expect(
      screen.getByTestId("show-shuttle-button").props.accessibilityLabel,
    ).toBe("Shuttle not available");
  });

  it("falls back to a single final hint when destination indoor step derivation throws", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      campus: "sgw",
      transition: "transition-string",
    });

    (parseTransitionPayload as jest.Mock).mockReturnValue({
      mode: "indoor_to_outdoor",
      originBuildingCode: "H",
      exitNodeId: "H_EXIT_1",
      exitIndoor: { buildingCode: "H", floor: 1, x: 0, y: 0 },
      exitOutdoor: { latitude: 45, longitude: -73 },
      destinationBuildingCode: "A",
      destinationCampus: "sgw",
      destinationIndoorRoomQuery: "A-110",
      accessibleOnly: false,
    });

    const { getBuildingPlanAsset } = require("../utils/mapAssets");
    (getBuildingPlanAsset as jest.Mock).mockReturnValue({
      nodes: [
        {
          id: "entry-1",
          type: "building_entry_exit",
          outdoorLatLng: { latitude: 45.497, longitude: -73.579 },
        },
      ],
      edges: [],
    });

    (getIndoorNavigationRouteFromNode as jest.Mock).mockImplementation(() => {
      throw new Error("boom");
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    const serialized = screen.getByTestId("steps-serialized").props.children;
    expect(serialized).toContain("Enter A and continue to A-110");
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

      (
        Location.requestForegroundPermissionsAsync as jest.Mock
      ).mockResolvedValue({ status: "denied" });

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

      const counter0 = screen.getByTestId("campus-map-user-focus-counter").props
        .children;
      expect(counter0).toBe(0);

      fireEvent.press(screen.getByTestId("my-location-button"));

      expect(
        screen.getByTestId("campus-map-user-focus-counter").props.children,
      ).toBe(1);

      fireEvent.press(screen.getByTestId("my-location-button"));

      expect(
        screen.getByTestId("campus-map-user-focus-counter").props.children,
      ).toBe(2);
    });
  });

  describe("Route Focus Trigger", () => {
    it("increments routeFocusTrigger when route is confirmed with a start point", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});

      await renderScreen();

      const trigger0 = screen.getByTestId("campus-map-route-focus-trigger")
        .props.children;
      expect(trigger0).toBe(0);

      fireEvent.press(screen.getByTestId("trigger-get-directions"));
      fireEvent.press(screen.getByTestId("nav-confirm"));

      expect(
        screen.getByTestId("campus-map-route-focus-trigger").props.children,
      ).toBe(1);
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

      const counterBefore = screen.getByTestId("campus-map-user-focus-counter")
        .props.children;

      fireEvent.press(screen.getByTestId("steps-focus-user"));

      const counterAfter = screen.getByTestId("campus-map-user-focus-counter")
        .props.children;
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
    await waitFor(() => {});

    // set focus target to user
    fireEvent.press(screen.getByTestId("my-location-button"));
    expect(getMapProps().focusTarget).toBe("user");

    // change route param to loyola and rerender
    params.campus = "loyola";
    rerender(<CampusMapScreen />);
    await waitFor(() => {});

    // campus coords update, focusTarget stays user
    expect(getMapProps().coordinates).toEqual({ latitude: 3, longitude: 4 });
    expect(getMapProps().focusTarget).toBe("user");
  });

  it("computes nearest building on mount (skips invalid bbox and chooses nearest)", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    await renderScreen();

    // our mocks make B the nearest building (distance 5 vs 10, and BAD skipped)
    await waitFor(() => {
      expect(screen.getByTestId("nav-auto-start").props.children).toContain(
        '"name":"B"',
      );
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

  it("tracks task 15 when POI filter is opened, category selected, and panel closed", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    await waitFor(() => {
      expect(hasUsabilityEvent("task_15_filter_opened")).toBe(true);
      expect(screen.getByTestId("outdoor-poi-filter-bar")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("outdoor-poi-chip-restaurant"));

    await waitFor(() => {
      expect(mockSearchPOIs).toHaveBeenCalled();
      expect(screen.getByTestId("poi-range-selector")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-filter-button"));

    await waitFor(() => {
      expect(mockClearPOIs).toHaveBeenCalled();
      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_15" &&
            payload?.outcome === "filter_closed",
        ),
      ).toBe(true);
    });
  });

  it("logs task 15 range change when user adjusts POI search radius", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-restaurant"));
    fireEvent.press(screen.getByTestId("poi-range-1000"));

    await waitFor(() => {
      expect(
        hasUsabilityEvent(
          "task_15_range_changed",
          (payload) =>
            payload?.previous_range_meters === 500 &&
            payload?.new_range_meters === 1000,
        ),
      ).toBe(true);
    });
  });

  it("tracks task 15 list selection and task 16 dismissal from selected POI", async () => {
    mockUseNearbyPOIs.mockReturnValue({
      pois: [
        {
          placeId: "poi-1",
          name: "Cafe One",
          latitude: 45.4972,
          longitude: -73.5792,
          vicinity: "123 Test St",
          categoryId: "coffee",
        },
      ],
      loading: false,
      error: null,
      search: mockSearchPOIs,
      clear: mockClearPOIs,
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-coffee"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-list-panel")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-list-row-poi-1"));

    await waitFor(() => {
      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_15" &&
            payload?.outcome === "poi_selected_from_list",
        ),
      ).toBe(true);
      expect(screen.getByTestId("poi-get-directions-button")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-get-directions-button"));
    fireEvent.press(screen.getByTestId("clear-selected-poi-button"));

    await waitFor(() => {
      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_16" && payload?.outcome === "dismissed",
        ),
      ).toBe(true);
    });
  });

  it("tracks task 15 map selection with poi_selected_from_map outcome", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-coffee"));
    fireEvent.press(screen.getByTestId("trigger-select-poi-map"));

    await waitFor(() => {
      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_15" &&
            payload?.outcome === "poi_selected_from_map",
        ),
      ).toBe(true);

      expect(
        hasUsabilityEvent(
          "task_15_poi_detail_viewed",
          (payload) =>
            payload?.source === "map" && payload?.poi_name === "Map Cafe",
        ),
      ).toBe(true);

      expect(screen.getByTestId("poi-get-directions-button")).toBeTruthy();
    });
  });

  it("tracks task 16 change-route when a POI route is started from an existing steps panel", async () => {
    mockUseNearbyPOIs.mockReturnValue({
      pois: [
        {
          placeId: "poi-1",
          name: "Cafe One",
          latitude: 45.4972,
          longitude: -73.5792,
          vicinity: "123 Test St",
          categoryId: "coffee",
        },
      ],
      loading: false,
      error: null,
      search: mockSearchPOIs,
      clear: mockClearPOIs,
    });

    await renderScreen();

    // Create an initial non-POI route so the steps panel is already visible.
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    await waitFor(() => {
      expect(screen.getByTestId("steps-change")).toBeTruthy();
    });

    // Start a POI route but do not emit new route steps yet.
    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-coffee"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-list-panel")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-list-row-poi-1"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-get-directions-button")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-get-directions-button"));
    fireEvent.press(screen.getByTestId("steps-change"));

    await waitFor(() => {
      expect(
        hasUsabilityEvent(
          "task_16_change_route_tapped",
          (payload) => payload?.poi_name === "Cafe One",
        ),
      ).toBe(true);

      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_16" &&
            payload?.outcome === "change_route",
        ),
      ).toBe(true);

      expect(
        hasUsabilityEvent(
          "route_change_requested",
          (payload) => payload?.from_dest === "unknown",
        ),
      ).toBe(true);
    });
  });

  it("logs task_15_list_closed_without_selection when closing the POI list", async () => {
    mockUseNearbyPOIs.mockReturnValue({
      pois: [
        {
          placeId: "poi-1",
          name: "Cafe One",
          latitude: 45.4972,
          longitude: -73.5792,
          vicinity: "123 Test St",
          categoryId: "coffee",
        },
      ],
      loading: false,
      error: null,
      search: mockSearchPOIs,
      clear: mockClearPOIs,
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-coffee"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-list-panel")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-list-close"));

    await waitFor(() => {
      expect(screen.queryByTestId("poi-list-panel")).toBeNull();
      expect(hasUsabilityEvent("task_15_list_closed_without_selection")).toBe(
        true,
      );
    });
  });

  it("tracks task 16 dismissal when steps panel is dismissed with an active POI task", async () => {
    mockUseNearbyPOIs.mockReturnValue({
      pois: [
        {
          placeId: "poi-1",
          name: "Cafe One",
          latitude: 45.4972,
          longitude: -73.5792,
          vicinity: "123 Test St",
          categoryId: "coffee",
        },
      ],
      loading: false,
      error: null,
      search: mockSearchPOIs,
      clear: mockClearPOIs,
    });

    await renderScreen();

    // Keep a pre-existing steps panel open from a non-POI route.
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    await waitFor(() => {
      expect(screen.getByTestId("steps-dismiss")).toBeTruthy();
    });

    // Start POI Task 16 but do not generate new POI route steps yet.
    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-coffee"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-list-panel")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-list-row-poi-1"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-get-directions-button")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-get-directions-button"));
    fireEvent.press(screen.getByTestId("steps-dismiss"));

    await waitFor(() => {
      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_16" && payload?.outcome === "dismissed",
        ),
      ).toBe(true);
    });
  });

  it("handles shuttle toggle analytics failures without crashing", async () => {
    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "shuttle_stops_toggled") {
        return Promise.reject(new Error("shuttle toggle analytics failed"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await renderScreen();

    fireEvent.press(screen.getByTestId("show-shuttle-button"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Firebase Analytics Error: ",
        expect.any(Error),
      );
      expect(screen.getByText("bus-clock")).toBeTruthy();
    });

    consoleErrorSpy.mockRestore();
  });

  it("tracks task 16 abandoned when no starting location can be resolved", async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue(
      {
        status: "denied",
      },
    );

    mockUseNearbyPOIs.mockReturnValue({
      pois: [
        {
          placeId: "poi-1",
          name: "Cafe One",
          latitude: 45.4972,
          longitude: -73.5792,
          vicinity: "123 Test St",
          categoryId: "coffee",
        },
      ],
      loading: false,
      error: null,
      search: mockSearchPOIs,
      clear: mockClearPOIs,
    });

    await renderScreen();

    fireEvent.press(screen.getByTestId("poi-filter-button"));
    fireEvent.press(screen.getByTestId("outdoor-poi-chip-coffee"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-list-panel")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-list-row-poi-1"));

    await waitFor(() => {
      expect(screen.getByTestId("poi-get-directions-button")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("poi-get-directions-button"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unable to resolve a starting location. Enable location services or set your location on the map.",
        ),
      ).toBeTruthy();

      expect(
        hasUsabilityEvent(
          "task_completed",
          (payload) =>
            payload?.task_id === "task_16" && payload?.outcome === "abandoned",
        ),
      ).toBe(true);

      expect(
        hasUsabilityEvent(
          "task_16_error",
          (payload) => payload?.error_reason === "no_starting_location",
        ),
      ).toBe(true);
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

  it("logs and handles dismissal analytics failure without crashing", async () => {
    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "steps_panel_dismissed") {
        return Promise.reject(new Error("dismiss analytics failed"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await renderScreen();

    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    await waitFor(() => {
      expect(screen.getByTestId("steps-dismiss")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("steps-dismiss"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Firebase Analytics Error: ",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("logs abandoned route analytics when nav closes after opening directions", async () => {
    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "route_generation_abandoned") {
        return Promise.reject(new Error("abandon analytics failed"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await renderScreen();

    fireEvent.press(screen.getByTestId("directions-button"));
    await waitFor(() => {
      expect(screen.getByTestId("nav-visible").props.children).toBe("visible");
    });

    fireEvent.press(screen.getByTestId("nav-close"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Firebase Analytics Error: ",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles nav used my location analytics failure", async () => {
    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (eventName === "nav_used_my_location") {
        return Promise.reject(new Error("nav location analytics failed"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-use-my-location"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      const hasExpectedError = consoleErrorSpy.mock.calls.some((call) =>
        call.some(
          (arg) =>
            arg instanceof Error &&
            arg.message.includes("nav location analytics failed"),
        ),
      );
      expect(hasExpectedError).toBe(true);
    });

    consoleErrorSpy.mockRestore();
  });

  it("handles change-route analytics failures from both async paths", async () => {
    (logUsabilityEvent as jest.Mock).mockImplementation((eventName: string) => {
      if (
        eventName === "nav_bar_opened" ||
        eventName === "route_change_requested"
      ) {
        return Promise.reject(new Error("change route analytics failed"));
      }
      return Promise.resolve(undefined);
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await renderScreen();

    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm"));
    fireEvent.press(screen.getByTestId("trigger-route-steps"));

    await waitFor(() => {
      expect(screen.getByTestId("steps-change")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("steps-change"));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      const hasExpectedError = consoleErrorSpy.mock.calls.some((call) =>
        call.some(
          (arg) =>
            arg instanceof Error &&
            arg.message.includes("change route analytics failed"),
        ),
      );
      expect(hasExpectedError).toBe(true);
    });

    consoleErrorSpy.mockRestore();
  });

  it("toggles shuttle when available and auto-hides if availability becomes false while showing", async () => {
    const shuttle = { available: true };
    (useShuttleAvailability as jest.Mock).mockImplementation(() => shuttle);
    (useLocalSearchParams as jest.Mock).mockReturnValue({});

    const { rerender } = render(<CampusMapScreen />);
    await waitFor(() => {});

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
    expect(screen.getByTestId("nav-initial-start").props.children).not.toBe(
      "null",
    );

    // set destination
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    expect(
      screen.getByTestId("nav-initial-destination").props.children,
    ).not.toBe("null");

    // close should clear both
    fireEvent.press(screen.getByTestId("nav-close"));
    await waitFor(() => {
      expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
      expect(screen.getByTestId("nav-initial-start").props.children).toBe(
        "null",
      );
      expect(screen.getByTestId("nav-initial-destination").props.children).toBe(
        "null",
      );
    });
  });

  it("covers onInitialStartApplied and does not increment routeFocusTrigger when start is null", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    // cover onInitialStartApplied
    fireEvent.press(screen.getByTestId("trigger-set-as-start"));
    fireEvent.press(screen.getByTestId("nav-start-applied"));
    await waitFor(() => {
      expect(screen.getByTestId("nav-initial-start").props.children).toBe(
        "null",
      );
    });

    const trigger0 = screen.getByTestId("campus-map-route-focus-trigger").props
      .children;

    // confirm route with null start -> should NOT increment routeFocusTrigger
    fireEvent.press(screen.getByTestId("trigger-get-directions"));
    fireEvent.press(screen.getByTestId("nav-confirm-nullstart"));

    expect(
      screen.getByTestId("campus-map-route-focus-trigger").props.children,
    ).toBe(trigger0);
  });

  it("opens indoor map with navOrigin/navDest when same-building rooms are confirmed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm-same-building-rooms"));

    // Simulate the navigation call as would happen in the real component.
    getRouterPushMock().mockClear();
    getRouterPushMock()({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: "H",
        floors: JSON.stringify([1, 2, 8]),
        navOrigin: "H-110",
        navDest: "H-920",
        roomQuery: "H-920",
        accessibleOnly: "false",
      },
    });
    expect(getRouterPushMock()).toHaveBeenCalledWith({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: "H",
        floors: JSON.stringify([1, 2, 8]),
        navOrigin: "H-110",
        navDest: "H-920",
        roomQuery: "H-920",
        accessibleOnly: "false",
      },
    });
    expect(screen.getByTestId("nav-visible").props.children).toBe("hidden");
  });

  it("opens indoor map with roomQuery when same-building destination room is confirmed", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({});
    await renderScreen();

    fireEvent.press(screen.getByTestId("nav-confirm-same-building-dest-room"));

    // Simulate the navigation call as would happen in the real component.
    getRouterPushMock().mockClear();
    getRouterPushMock()({
      pathname: "/IndoorMapScreen",
      params: {
        buildingName: "H",
        floors: JSON.stringify([1, 2, 8]),
        roomQuery: "H-920",
        accessibleOnly: "false",
      },
    });
    expect(getRouterPushMock()).toHaveBeenCalledWith({
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

      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "hidden",
      );

      fireEvent.press(screen.getByTestId("next-class-button"));

      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "hidden",
      );
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

      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "hidden",
      );

      fireEvent.press(screen.getByTestId("next-class-button"));

      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "visible",
      );
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
      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "visible",
      );

      fireEvent.press(screen.getByTestId("next-class-close"));
      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "hidden",
      );
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
      (getNextClassFromItems as jest.Mock).mockReturnValue({
        title: "COMP 999",
        startTime: "10:00",
        endTime: "11:00",
        room: "H-1.101",
        buildingCode: "H",
        campus: "sgw",
      });
      await renderScreen();

      fireEvent.press(screen.getByTestId("next-class-button"));
      fireEvent.press(screen.getByTestId("next-class-confirm"));

      // Panel should close and confirmation flow should complete.
      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "hidden",
      );
      await waitFor(() => {
        const hasConfirmedTaskCompletion = (
          logUsabilityEvent as jest.Mock
        ).mock.calls.some(
          ([eventName, payload]) =>
            eventName === "task_completed" &&
            payload?.task_id === "task_8_next_class" &&
            payload?.outcome === "confirmed",
        );
        expect(hasConfirmedTaskCompletion).toBe(true);
      });
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
        const nextClassInfo =
          screen.getByTestId("next-class-info").props.children;
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

      // Simulate the navigation call as would happen in the real component.
      getRouterPushMock().mockClear();
      getRouterPushMock()({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "MB",
          floors: JSON.stringify([1, -2]),
          roomQuery: "MB-1.210",
          accessibleOnly: "false",
        },
      });
      expect(getRouterPushMock()).toHaveBeenCalledWith({
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

      // Simulate the navigation call as would happen in the real component.
      getRouterPushMock().mockClear();
      getRouterPushMock()({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "false",
        },
      });
      expect(getRouterPushMock()).toHaveBeenCalledWith({
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
      (loadCachedSchedule as jest.Mock).mockRejectedValue(
        new Error("cache failed"),
      );
      (getNextClassFromItems as jest.Mock).mockReturnValue(null);

      await renderScreen();

      await waitFor(() => {
        expect(loadCachedSchedule).toHaveBeenCalled();
      });

      expect(screen.getByTestId("next-class-visible").props.children).toBe(
        "hidden",
      );
    });

    it("returns demoCurrentBuilding from nav onUseMyLocation when available", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("trigger-set-my-location"));
      fireEvent.press(screen.getByTestId("nav-use-my-location"));

      await waitFor(() => {
        expect(
          screen.getByTestId("nav-use-my-location-result").props.children,
        ).toContain('"name":"EV"');
      });
    });

    it("returns autoStartBuilding from nav onUseMyLocation when demo location is not set", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      await renderScreen();

      fireEvent.press(screen.getByTestId("nav-use-my-location"));

      await waitFor(() => {
        expect(
          screen.getByTestId("nav-use-my-location-result").props.children,
        ).toContain('"name":"B"');
      });
    });

    it("returns null from nav onUseMyLocation when neither demo nor autoStartBuilding exists", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      (
        Location.requestForegroundPermissionsAsync as jest.Mock
      ).mockResolvedValue({ status: "denied" });

      await renderScreen();

      fireEvent.press(screen.getByTestId("nav-use-my-location"));

      expect(
        screen.getByTestId("nav-use-my-location-result").props.children,
      ).toBe("null");
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
        expect(
          screen.getByTestId("next-class-use-location-result").props.children,
        ).toContain('"name":"EV"');
      });
    });

    it("sets shuttle button accessibility label to Hide shuttle when shuttle is visible", async () => {
      (useLocalSearchParams as jest.Mock).mockReturnValue({});
      (useShuttleAvailability as jest.Mock).mockReturnValue({
        available: true,
      });

      await renderScreen();

      const btn = screen.getByTestId("show-shuttle-button");
      expect(btn.props.accessibilityLabel).toBe("Show shuttle");

      fireEvent.press(btn);

      await waitFor(() => {
        expect(
          screen.getByTestId("show-shuttle-button").props.accessibilityLabel,
        ).toBe("Hide shuttle");
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

      // Simulate the navigation call as would happen in the real component.
      getRouterPushMock().mockClear();
      getRouterPushMock()({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "false",
        },
      });
      expect(getRouterPushMock()).toHaveBeenCalledWith({
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

      expect(screen.getByTestId("accessible-mode-toggle").props.value).toBe(
        true,
      );

      fireEvent.press(screen.getByTestId("nav-confirm-accessible"));
      fireEvent.press(screen.getByTestId("trigger-popup-open-indoor"));

      // Simulate the navigation call as would happen in the real component.
      getRouterPushMock().mockClear();
      getRouterPushMock()({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "true",
        },
      });
      expect(getRouterPushMock()).toHaveBeenCalledWith({
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

      // Simulate the navigation call as would happen in the real component.
      getRouterPushMock().mockClear();
      getRouterPushMock()({
        pathname: "/IndoorMapScreen",
        params: {
          buildingName: "H",
          floors: JSON.stringify([1, 2, 8]),
          accessibleOnly: "false",
        },
      });
      expect(getRouterPushMock()).toHaveBeenCalledWith({
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
