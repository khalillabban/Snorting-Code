import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Animated, Keyboard, PanResponder, TouchableWithoutFeedback } from "react-native";
import NextClassDirectionsPanel from "../components/NextClassDirectionsPanel";
import type { ScheduleItem } from "../constants/type";

jest.mock("@expo/vector-icons", () => ({
  MaterialIcons: "MaterialIcons",
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

jest.mock("../services/GoogleDirectionsService", () => ({
  getOutdoorRouteWithSteps: jest.fn(
    () => new Promise<never>(() => {}),
  ),
}));

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    {
      name: "H",
      campusName: "SGW",
      displayName: "Henry F. Hall Building (H)",
      address: "1455 Blvd. De Maisonneuve Ouest",
      coordinates: { latitude: 45.497256, longitude: -73.578915 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
    {
      name: "MB",
      campusName: "SGW",
      displayName: "John Molson Building (MB)",
      address: "1450 Guy St",
      coordinates: { latitude: 45.495304, longitude: -73.579044 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
    {
      name: "SP",
      campusName: "loyola",
      displayName: "Richard J Renaud Science Complex (SP)",
      address: "7141 Sherbrooke St W",
      coordinates: { latitude: 45.4576633, longitude: -73.6413024 },
      boundingBox: [
        { latitude: 0, longitude: 0 },
        { latitude: 0, longitude: 1 },
        { latitude: 1, longitude: 1 },
      ],
    },
  ],
}));

const mockScheduleItems: ScheduleItem[] = [
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
  {
    id: "2",
    kind: "class",
    courseName: "SOEN 390",
    start: new Date(Date.now() + 10_800_000),
    end: new Date(Date.now() + 14_400_000),
    location: "SGW H 820",
    campus: "SGW",
    building: "H",
    room: "820",
    level: "8",
  },
];

describe("NextClassDirectionsPanel", () => {
  let mockOnClose: jest.Mock;
  let mockOnConfirm: jest.Mock;
  let mockOnOpenIndoorMap: jest.Mock;

  beforeEach(() => {
    mockOnClose = jest.fn();
    mockOnConfirm = jest.fn();
    mockOnOpenIndoorMap = jest.fn();

    const mockAnimatedValue = {
      setValue: jest.fn(),
      interpolate: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      stopAnimation: jest.fn(),
      resetAnimation: jest.fn(),
      _value: 0,
      _offset: 0,
    };

    jest
      .spyOn(Animated, "Value")
      .mockImplementation(() => mockAnimatedValue as any);

    jest.spyOn(Animated, "spring").mockReturnValue({
      start: jest.fn((cb) => cb && cb()),
    } as any);

    jest.spyOn(Animated, "timing").mockReturnValue({
      start: jest.fn((cb) => cb && cb()),
    } as any);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("does not render when visible is false", async () => {
      const { queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(queryByTestId("next-class-name")).toBeNull();
      });
    });

    it("renders next class info when visible", async () => {
      const { getByTestId, getByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(getByTestId("next-class-name")).toBeTruthy();
        expect(getByText("COMP 335")).toBeTruthy();
        expect(getByText("MB-1.210")).toBeTruthy();
      });
    });

    it("renders Get Directions button", async () => {
      const { getByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(getByText("Get Directions")).toBeTruthy();
      });
    });

    it("renders strategy mode buttons", async () => {
      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(getByTestId("next-class-mode-walking")).toBeTruthy();
        expect(getByTestId("next-class-mode-bicycling")).toBeTruthy();
        expect(getByTestId("next-class-mode-driving")).toBeTruthy();
        expect(getByTestId("next-class-mode-transit")).toBeTruthy();
        expect(getByTestId("next-class-mode-shuttle")).toBeTruthy();
      });
    });

    it("auto-sets destination to next class building", async () => {
      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        const destInput = getByTestId("next-class-dest-input");
        expect(destInput.props.value).toBe("John Molson Building (MB)");
      });
    });

    it("auto-sets start when autoStartBuilding is provided", async () => {
      const autoStart = {
        name: "H",
        campusName: "SGW",
        displayName: "Henry F. Hall Building (H)",
        coordinates: { latitude: 45.497256, longitude: -73.578915 },
        address: "",
        boundingBox: [],
      };

      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          autoStartBuilding={autoStart}
        />,
      );

      await waitFor(() => {
        const startInput = getByTestId("next-class-start-input");
        expect(startInput.props.value).toBe("Henry F. Hall Building (H)");
      });
    });
  });

  describe("Error handling", () => {
    it("shows error when next class has no building code", async () => {
      const badClass: ScheduleItem = {
        id: "bad",
        kind: "class",
        courseName: "ENGR 101",
        start: new Date(Date.now() + 3_600_000),
        end: new Date(Date.now() + 7_200_000),
        location: "",
        campus: "",
        building: "",
        room: "",
        level: "",
      };

      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={badClass}
          scheduleItems={[badClass]}
        />,
      );

      await waitFor(() => {
        expect(getByTestId("next-class-error")).toBeTruthy();
      });
    });

    it("shows error when building code is unrecognized", async () => {
      const badClass: ScheduleItem = {
        id: "bad",
        kind: "class",
        courseName: "ENGR 101",
        start: new Date(Date.now() + 3_600_000),
        end: new Date(Date.now() + 7_200_000),
        location: "SGW ZZ 100",
        campus: "SGW",
        building: "ZZ",
        room: "100",
        level: "1",
      };

      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={badClass}
          scheduleItems={[badClass]}
        />,
      );

      await waitFor(() => {
        const errorBanner = getByTestId("next-class-error");
        expect(errorBanner).toBeTruthy();
      });
    });
  });

  describe("Interactions", () => {
    it("calls onConfirm and onClose when Get Directions is pressed", async () => {
      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(getByTestId("next-class-get-directions")).toBeTruthy();
      });

      fireEvent.press(getByTestId("next-class-get-directions"));
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("renders and handles the indoor map shortcut when enabled", async () => {
      const { getByTestId, getByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          canOpenIndoorMap={true}
          onOpenIndoorMap={mockOnOpenIndoorMap}
        />,
      );

      await waitFor(() => {
        expect(getByTestId("next-class-open-indoor")).toBeTruthy();
        expect(getByText("Open Indoor Map")).toBeTruthy();
      });

      fireEvent.press(getByTestId("next-class-open-indoor"));
      expect(mockOnOpenIndoorMap).toHaveBeenCalledTimes(1);
    });

    it("hides the indoor map shortcut when disabled", async () => {
      const { queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(queryByTestId("next-class-open-indoor")).toBeNull();
      });
    });

    it("shows course list when destination picker is pressed", async () => {
      const { getByLabelText, getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      fireEvent.press(getByLabelText("Pick destination from course list"));

      await waitFor(() => {
        // Check for course items by their testIDs
        expect(getByTestId("nc-course-1")).toBeTruthy();
        expect(getByTestId("nc-course-2")).toBeTruthy();
      });
    });

    it("excludes event items from the destination course picker", async () => {
      const mixedItems: ScheduleItem[] = [
        ...mockScheduleItems,
        {
          id: "event-1",
          kind: "event",
          courseName: "Career Fair",
          start: new Date(Date.now() + 5_400_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW EV Atrium",
          campus: "SGW",
          building: "EV",
          room: "Atrium",
          level: "",
        },
      ];

      const { getByLabelText, getByTestId, queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mixedItems[0]}
          scheduleItems={mixedItems}
        />,
      );

      fireEvent.press(getByLabelText("Pick destination from course list"));

      await waitFor(() => {
        expect(getByTestId("nc-course-1")).toBeTruthy();
        expect(getByTestId("nc-course-2")).toBeTruthy();
        expect(queryByTestId("nc-course-event-1")).toBeNull();
      });
    });

    it("selects a course from destination list and updates dest", async () => {
      const { getByLabelText, getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      fireEvent.press(getByLabelText("Pick destination from course list"));

      await waitFor(() => {
        expect(getByTestId("nc-course-2")).toBeTruthy();
      });

      fireEvent.press(getByTestId("nc-course-2"));

      await waitFor(() => {
        const destInput = getByTestId("next-class-dest-input");
        expect(destInput.props.value).toBe("Henry F. Hall Building (H)");
      });
    });

    it("shows building list when start building picker is pressed", async () => {
      const { getByLabelText, getByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          currentCampus="sgw"
        />,
      );

      // There's a list button next to the start input
      const buttons = getByLabelText("Pick starting building from list");
      fireEvent.press(buttons);

      await waitFor(() => {
        expect(getByText("Henry F. Hall Building (H)")).toBeTruthy();
        expect(getByText("John Molson Building (MB)")).toBeTruthy();
      });
    });

    it("uses my location when the button is pressed", async () => {
      const mockLocation = jest.fn(() => ({
        name: "H",
        campusName: "SGW",
        displayName: "Henry F. Hall Building (H)",
        coordinates: { latitude: 45.497256, longitude: -73.578915 },
        address: "",
        boundingBox: [],
      }));

      const { getByLabelText, getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          onUseMyLocation={mockLocation}
        />,
      );

      fireEvent.press(getByLabelText("Use my current location as start"));

      await waitFor(() => {
        const startInput = getByTestId("next-class-start-input");
        expect(startInput.props.value).toBe("Henry F. Hall Building (H)");
      });
    });

    it("can change strategy mode", async () => {
      const { getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      fireEvent.press(getByTestId("next-class-mode-bicycling"));
      // Verify it doesn't crash and the button exists
      expect(getByTestId("next-class-mode-bicycling")).toBeTruthy();
    });

    it("filters courses when typing in destination input", async () => {
      const { getByTestId, queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      fireEvent.changeText(getByTestId("next-class-dest-input"), "SOEN");

      await waitFor(() => {
        // SOEN 390 course item should appear in course list
        expect(getByTestId("nc-course-2")).toBeTruthy();
        // COMP 335 course item should be filtered out from list
        expect(queryByTestId("nc-course-1")).toBeNull();
      });
    });

    it("filters buildings when typing in start input", async () => {
      const { getByTestId, queryByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      fireEvent.changeText(getByTestId("next-class-start-input"), "Hall");

      await waitFor(() => {
        expect(queryByText("Henry F. Hall Building (H)")).toBeTruthy();
        // MB should be filtered out
        expect(queryByText("John Molson Building (MB)")).toBeNull();
      });
    });

    it("can swap origin and destination", async () => {
      const autoStart = {
        name: "H",
        campusName: "SGW",
        displayName: "Henry F. Hall Building (H)",
        coordinates: { latitude: 45.497256, longitude: -73.578915 },
        address: "",
        boundingBox: [],
      };

      const { getByLabelText, getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          autoStartBuilding={autoStart}
        />,
      );

      await waitFor(() => {
        expect(getByTestId("next-class-start-input").props.value).toBe(
          "Henry F. Hall Building (H)",
        );
        expect(getByTestId("next-class-dest-input").props.value).toBe(
          "John Molson Building (MB)",
        );
      });

      fireEvent.press(getByLabelText("Swap origin and destination"));

      await waitFor(() => {
        expect(getByTestId("next-class-start-input").props.value).toBe(
          "John Molson Building (MB)",
        );
        expect(getByTestId("next-class-dest-input").props.value).toBe(
          "Henry F. Hall Building (H)",
        );
      });
    });

    it("clears building list when search text is emptied", async () => {
      const { getByTestId, queryByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      // Type to show buildings
      fireEvent.changeText(getByTestId("next-class-start-input"), "Hall");
      await waitFor(() => {
        expect(queryByText("Henry F. Hall Building (H)")).toBeTruthy();
      });

      // Clear text to hide buildings
      fireEvent.changeText(getByTestId("next-class-start-input"), "");
      await waitFor(() => {
        expect(queryByText("Henry F. Hall Building (H)")).toBeNull();
      });
    });

    it("clears course list when search text is emptied", async () => {
      const { getByTestId, queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      // Type to show courses
      fireEvent.changeText(getByTestId("next-class-dest-input"), "SOEN");
      await waitFor(() => {
        expect(getByTestId("nc-course-2")).toBeTruthy();
      });

      // Clear text to hide courses
      fireEvent.changeText(getByTestId("next-class-dest-input"), "");
      await waitFor(() => {
        expect(queryByTestId("nc-course-2")).toBeNull();
      });
    });

    it("selects a building from the building list", async () => {
      const { getByTestId, getByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      fireEvent.changeText(getByTestId("next-class-start-input"), "Hall");

      await waitFor(() => {
        expect(getByText("Henry F. Hall Building (H)")).toBeTruthy();
      });

      fireEvent.press(getByText("Henry F. Hall Building (H)"));

      await waitFor(() => {
        expect(getByTestId("next-class-start-input").props.value).toBe(
          "Henry F. Hall Building (H)",
        );
      });
    });

    it("toggles building picker closed when pressed while open", async () => {
      const { getByLabelText, queryByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          currentCampus="sgw"
        />,
      );

      // Open building picker
      fireEvent.press(getByLabelText("Pick starting building from list"));
      await waitFor(() => {
        expect(queryByText("Henry F. Hall Building (H)")).toBeTruthy();
      });

      // Press again to close
      fireEvent.press(getByLabelText("Pick starting building from list"));
      await waitFor(() => {
        expect(queryByText("Henry F. Hall Building (H)")).toBeNull();
      });
    });

    it("toggles course picker closed when pressed while open", async () => {
      const { getByLabelText, queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      // Open course picker
      fireEvent.press(getByLabelText("Pick destination from course list"));
      await waitFor(() => {
        expect(queryByTestId("nc-course-1")).toBeTruthy();
      });

      // Press again to close
      fireEvent.press(getByLabelText("Pick destination from course list"));
      await waitFor(() => {
        expect(queryByTestId("nc-course-1")).toBeNull();
      });
    });

    it("sets My Location text when onUseMyLocation returns null", async () => {
      const mockLocationNull = jest.fn(() => null);

      const { getByLabelText, getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
          onUseMyLocation={mockLocationNull}
        />,
      );

      fireEvent.press(getByLabelText("Use my current location as start"));

      await waitFor(() => {
        expect(getByTestId("next-class-start-input").props.value).toBe("My Location");
      });
    });

    it("shows error when selecting a course with unrecognized building", async () => {
      const badCourseItems: ScheduleItem[] = [
        {
          id: "bad",
          kind: "class",
          courseName: "BAD 101",
          start: new Date(Date.now() + 3_600_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW XX 100",
          campus: "SGW",
          building: "XX",
          room: "100",
          level: "1",
        },
      ];

      const { getByLabelText, getByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={badCourseItems}
        />,
      );

      fireEvent.press(getByLabelText("Pick destination from course list"));

      await waitFor(() => {
        expect(getByTestId("nc-course-bad")).toBeTruthy();
      });

      fireEvent.press(getByTestId("nc-course-bad"));

      await waitFor(() => {
        expect(getByTestId("next-class-error")).toBeTruthy();
      });
    });

    it("does not render when visible becomes false", async () => {
      const { rerender, queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(queryByTestId("next-class-name")).toBeTruthy();
      });

      rerender(
        <NextClassDirectionsPanel
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mockScheduleItems[0]}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(queryByTestId("next-class-name")).toBeNull();
      });
    });

    it("renders without nextClass (null case)", async () => {
      const { queryByTestId, getByText } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={null}
          scheduleItems={mockScheduleItems}
        />,
      );

      await waitFor(() => {
        expect(queryByTestId("next-class-name")).toBeNull();
        expect(getByText("Get Directions")).toBeTruthy();
      });
    });

    it("deduplicates courses with same name, building, and room", async () => {
      const duplicateCourses: ScheduleItem[] = [
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
        {
          id: "2",
          kind: "class",
          courseName: "COMP 335",
          start: new Date(Date.now() + 86_400_000),
          end: new Date(Date.now() + 90_000_000),
          location: "SGW MB 1.210",
          campus: "SGW",
          building: "MB",
          room: "1.210",
          level: "1",
        },
      ];

      const { getByLabelText, queryAllByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={duplicateCourses[0]}
          scheduleItems={duplicateCourses}
        />,
      );

      fireEvent.press(getByLabelText("Pick destination from course list"));

      await waitFor(() => {
        // Only one course should appear (deduplicated)
        const courses = queryAllByTestId(/^nc-course-/);
        expect(courses.length).toBe(1);
        });
      });

      describe("Gesture and overlay coverage", () => {
        it("closes on fast/large downward swipe and springs back on small swipe", async () => {
          const panSpy = jest
            .spyOn(PanResponder, "create")
            .mockImplementation((config: any) => ({ panHandlers: config } as any));

          render(
            <NextClassDirectionsPanel
              visible={true}
              onClose={mockOnClose}
              onConfirm={mockOnConfirm}
              nextClass={mockScheduleItems[0]}
              scheduleItems={mockScheduleItems}
            />,
          );

          const gestureConfig = panSpy.mock.calls[0][0];
          expect(gestureConfig).toBeTruthy();

          expect(gestureConfig.onMoveShouldSetPanResponder({}, { dy: 5 })).toBe(false);
          expect(gestureConfig.onMoveShouldSetPanResponder({}, { dy: 20 })).toBe(true);

          gestureConfig.onPanResponderMove({}, { dy: -10, vy: 0 });
          gestureConfig.onPanResponderRelease({}, { dy: 30, vy: 0.1 });
          expect(Animated.spring).toHaveBeenCalled();

          gestureConfig.onPanResponderMove({}, { dy: 40, vy: 0.1 });
          gestureConfig.onPanResponderRelease({}, { dy: 140, vy: 0.1 });
          expect(mockOnClose).toHaveBeenCalled();

          panSpy.mockRestore();
        });

        it("dismisses keyboard and closes when backdrop is pressed", async () => {
          const dismissSpy = jest.spyOn(Keyboard, "dismiss").mockImplementation(() => {});

          const rendered = render(
            <NextClassDirectionsPanel
              visible={true}
              onClose={mockOnClose}
              onConfirm={mockOnConfirm}
              nextClass={mockScheduleItems[0]}
              scheduleItems={mockScheduleItems}
            />,
          );

          const touchables = rendered.UNSAFE_getAllByType(TouchableWithoutFeedback);
          touchables[0].props.onPress();

          expect(dismissSpy).toHaveBeenCalled();
          expect(mockOnClose).toHaveBeenCalled();

          dismissSpy.mockRestore();
        });
      });
    });

    it("ignores matching event items when filtering destination courses", async () => {
      const mixedItems: ScheduleItem[] = [
        ...mockScheduleItems,
        {
          id: "event-soen",
          kind: "event",
          courseName: "SOEN Mixer",
          start: new Date(Date.now() + 5_400_000),
          end: new Date(Date.now() + 7_200_000),
          location: "SGW EV Atrium",
          campus: "SGW",
          building: "EV",
          room: "Atrium",
          level: "",
        },
      ];

      const { getByTestId, queryByTestId } = render(
        <NextClassDirectionsPanel
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          nextClass={mixedItems[0]}
          scheduleItems={mixedItems}
        />,
      );

      fireEvent.changeText(getByTestId("next-class-dest-input"), "SOEN");

      await waitFor(() => {
        expect(getByTestId("nc-course-2")).toBeTruthy();
        expect(queryByTestId("nc-course-event-soen")).toBeNull();
      });
    });
});

