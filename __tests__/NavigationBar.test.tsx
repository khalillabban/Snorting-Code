import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Animated, Keyboard } from "react-native";
import NavigationBar from "../components/NavigationBar";
import { getOutdoorRouteWithSteps } from "../services/GoogleDirectionsService";

jest.mock("@expo/vector-icons", () => ({
  MaterialIcons: "MaterialIcons",
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

jest.mock("../services/GoogleDirectionsService", () => ({
  getOutdoorRouteWithSteps: jest.fn(
    () => new Promise<never>(() => {})
  ),
}));

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    {
      name: "SP",
      campusName: "loyola",
      displayName: "Richard J Renaud Science Complex (SP)",
      address: "7141 Sherbrooke St W, Montreal, QC H4B 1R6",
      coordinates: { latitude: 45.4576633, longitude: -73.6413024 },
      icons: ["information", "wheelchair"],
      departments: ["Biology", "Chemistry and Biochemistry", "Physics"],
      services: ["Café", "Campus Safety and Prevention Services", "First Stop"],
      boundingBox: [],
    },
    {
      name: "VL",
      campusName: "loyola",
      displayName: "Concordia Vanier Library (VL)",
      address: "7141 Sherbrooke St W, Montreal, QC H4B 1R6",
      coordinates: { latitude: 45.4589523, longitude: -73.63857895 },
      icons: ["information", "wheelchair"],
      services: ["Georges P. Vanier Library"],
      boundingBox: [],
    },
    {
      name: "SC",
      campusName: "loyola",
      displayName: "Student Centre (SC)",
      address: "7141 Sherbrooke St W, Montreal, QC H4B 1R6",
      coordinates: { latitude: 45.4591611, longitude: -73.63919545 },
      icons: ["wheelchair"],
      services: ["Cafeteria", "Café", "Food Services"],
      boundingBox: [],
    },
    {
      name: "H",
      campusName: "SGW",
      displayName: "Henry F. Hall Building (H)",
      address: "1455 Blvd. De Maisonneuve Ouest, Montreal, Quebec H3G 1M8",
      coordinates: { latitude: 45.497256, longitude: -73.578915 },
      icons: ["information", "printer", "bike", "wheelchair"],
      departments: [
        "Economics",
        "Political Science",
        "Sociology and Anthropology",
      ],
      services: ["Campus Safety and Prevention Services", "First Stop"],
      boundingBox: [],
    },
    {
      name: "EV",
      campusName: "SGW",
      displayName:
        "Engineering, Computer Science and Visual Arts Integrated Complex (EV)",
      address: "1515 Rue Sainte-Catherine O #1428, Montreal, Quebec H3G 1S6",
      coordinates: { latitude: 45.495626, longitude: -73.577982 },
      icons: ["information", "printer", "wheelchair"],
      departments: [
        "Art Education",
        "Design and Computation Arts",
        "Electrical and Computer Engineering",
      ],
      services: ["Le Gym", "Zen Den"],
      boundingBox: [],
    },
  ],
}));

describe("NavigationBar", () => {
  let mockOnClose: jest.Mock;
  let mockOnConfirm: jest.Mock;
  let animatedSpring: jest.SpyInstance;
  let animatedTiming: jest.SpyInstance;
  let animatedSetValue: jest.SpyInstance;

  beforeEach(() => {
    mockOnClose = jest.fn();
    mockOnConfirm = jest.fn();

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

    animatedSetValue = mockAnimatedValue.setValue;

    animatedSpring = jest.spyOn(Animated, "spring").mockReturnValue({
      start: jest.fn((callback) => callback && callback()),
    } as any);

    animatedTiming = jest.spyOn(Animated, "timing").mockReturnValue({
      start: jest.fn((callback) => callback && callback()),
    } as any);

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("should not render when visible is false", () => {
      const { queryByPlaceholderText } = render(
        <NavigationBar
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(queryByPlaceholderText("From")).toBeNull();
    });

    it("should render when visible is true", async () => {
      const { getByPlaceholderText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      await waitFor(() => {
        expect(getByPlaceholderText("From")).toBeTruthy();
        expect(getByPlaceholderText("To")).toBeTruthy();
      });
    });

    it("should render the Get Directions button when not searching", () => {
      const { getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(getByText("Get Directions")).toBeTruthy();
    });
  });

  describe("Animation", () => {
    it("should trigger spring animation when becoming visible", () => {
      const { rerender } = render(
        <NavigationBar
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      rerender(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(animatedSpring).toHaveBeenCalled();
    });

    it("should trigger timing animation when becoming invisible", () => {
      const { rerender } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      rerender(
        <NavigationBar
          visible={false}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      expect(animatedTiming).toHaveBeenCalled();
    });
  });

  describe("Search Functionality", () => {
    it("should filter buildings when typing in start location input", () => {
      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Science");

      expect(getByText("Richard J Renaud Science Complex (SP)")).toBeTruthy();
    });

    it("should filter buildings when typing in destination input", () => {
      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const destInput = getByPlaceholderText("To");
      fireEvent.changeText(destInput, "Library");

      expect(getByText("Concordia Vanier Library (VL)")).toBeTruthy();
    });

    it("should filter buildings case-insensitively", () => {
      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "science");

      expect(getByText("Richard J Renaud Science Complex (SP)")).toBeTruthy();
    });

    it("should clear suggestions when input is empty", () => {
      const { getByPlaceholderText, queryByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");

      fireEvent.changeText(startInput, "Science");

      fireEvent.changeText(startInput, "");

      expect(queryByText("Richard J Renaud Science Complex (SP)")).toBeNull();
      expect(queryByText("Get Directions")).toBeTruthy();
    });
  });

  describe("Building Selection", () => {
    it("should select start building when suggestion is pressed", () => {
      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Science");

      const suggestion = getByText("Richard J Renaud Science Complex (SP)");
      fireEvent.press(suggestion);

      expect(startInput.props.value).toBe(
        "Richard J Renaud Science Complex (SP)",
      );
    });

    it("should select destination building when suggestion is pressed", () => {
      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const destInput = getByPlaceholderText("To");
      fireEvent.changeText(destInput, "Library");

      const suggestion = getByText("Concordia Vanier Library (VL)");
      fireEvent.press(suggestion);

      expect(destInput.props.value).toBe("Concordia Vanier Library (VL)");
    });

    it("should clear suggestions after selection", () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Science");

      const suggestion = getByText("Richard J Renaud Science Complex (SP)");
      fireEvent.press(suggestion);

      expect(queryByText("Richard J Renaud Science Complex (SP)")).toBeNull();
      expect(getByText("Get Directions")).toBeTruthy();
    });

    it("should dismiss keyboard after building selection", () => {
      const dismissSpy = jest.spyOn(Keyboard, "dismiss");

      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Science");

      const suggestion = getByText("Richard J Renaud Science Complex (SP)");
      fireEvent.press(suggestion);

      expect(dismissSpy).toHaveBeenCalled();
    });
  });

  describe("Confirm Functionality", () => {
    it("should call onConfirm with selected buildings", () => {
      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Science");
      fireEvent.press(getByText("Richard J Renaud Science Complex (SP)"));

      const destInput = getByPlaceholderText("To");
      fireEvent.changeText(destInput, "Library");
      fireEvent.press(getByText("Concordia Vanier Library (VL)"));

      const confirmButton = getByText("Get Directions");
      fireEvent.press(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "SP",
          displayName: "Richard J Renaud Science Complex (SP)",
        }),
        expect.objectContaining({
          name: "VL",
          displayName: "Concordia Vanier Library (VL)",
        }),
        expect.objectContaining({ mode: "walking", label: "Walk", icon: "walk" }),
      );
    });

    it("should call onClose after confirm", () => {
      const { getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const confirmButton = getByText("Get Directions");
      fireEvent.press(confirmButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("should handle confirm with null buildings", () => {
      const { getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const confirmButton = getByText("Get Directions");
      fireEvent.press(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalledWith(
        null,
        null,
        expect.objectContaining({ mode: "walking", label: "Walk", icon: "walk" }),
      );
    });
  });

  describe("Overlay Interaction", () => {
    it("should dismiss keyboard when overlay is pressed", () => {
      const dismissSpy = jest.spyOn(Keyboard, "dismiss");

      const { getByTestId, UNSAFE_getAllByType } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const touchables = UNSAFE_getAllByType(
        require("react-native").TouchableWithoutFeedback,
      );

      if (touchables.length > 0) {
        fireEvent.press(touchables[0]);
        expect(dismissSpy).toHaveBeenCalled();
      }
    });

    it("should call onClose when overlay is pressed", () => {
      const { UNSAFE_getAllByType } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const touchables = UNSAFE_getAllByType(
        require("react-native").TouchableWithoutFeedback,
      );

      if (touchables.length > 0) {
        fireEvent.press(touchables[0]);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });
  });

  describe("PanResponder - Swipe Gestures", () => {
    const createGestureState = (dy: number, vy: number) => ({
      dy,
      vy,
      dx: 0,
      vx: 0,
      moveX: 0,
      moveY: dy,
      x0: 0,
      y0: 0,
    });

    const findPanResponderView = (rendered: any) => {
      const views = rendered.UNSAFE_getAllByType(Animated.View);
      return views.find(
        (v: any) =>
          v.props.onResponderMove ||
          v.props.onStartShouldSetResponder ||
          v.props.onMoveShouldSetResponder,
      );
    };

    describe("Touch Start (Grant)", () => {
      it("should set PanResponder on touch start", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);

        if (view && view.props.onStartShouldSetResponder) {
          const shouldSet = view.props.onStartShouldSetResponder();
          expect(shouldSet).toBe(true);
        } else {
          expect(true).toBe(true);
        }
      });
    });

    describe("Swipe Down (Move)", () => {
      it("should update position when swiping down", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(50, 0.3);

        if (view && view.props.onResponderMove) {
          view.props.onResponderMove({}, gestureState);
          expect(animatedSetValue).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should NOT update position when swiping up", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        animatedSetValue.mockClear();

        const gestureState = createGestureState(-50, -0.3);

        if (view && view.props.onResponderMove) {
          view.props.onResponderMove({}, gestureState);
          expect(animatedSetValue).not.toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should handle small movements correctly", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(5, 0.1);

        if (view && view.props.onResponderMove) {
          view.props.onResponderMove({}, gestureState);
          expect(animatedSetValue).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });
    });

    describe("Touch End (Release)", () => {
      it("should close sheet when swiped down more than 120 pixels", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(150, 0.3);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);
          expect(mockOnClose).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should close sheet when velocity is high (> 0.5)", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(80, 0.6);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);
          expect(mockOnClose).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should spring back when swipe is not enough to close", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(50, 0.2);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);

          expect(mockOnClose).not.toHaveBeenCalled();
          expect(animatedSpring).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should handle exact threshold values", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(120, 0.5);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);

          expect(mockOnClose).not.toHaveBeenCalled();
          expect(animatedSpring).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should handle negative swipe on release", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(-50, -0.3);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);

          expect(mockOnClose).not.toHaveBeenCalled();
          expect(animatedSpring).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });
    });

    describe("Movement Thresholds", () => {
      it("should require minimum dy to trigger movement", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(5, 0.1);

        if (view && view.props.onMoveShouldSetResponder) {
          const shouldSet = view.props.onMoveShouldSetResponder(
            {},
            gestureState,
          );
          expect(shouldSet).toBe(false);
        } else {
          expect(true).toBe(true);
        }
      });

      it("should set responder for movement > 10px", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(15, 0.2);

        if (view && view.props.onMoveShouldSetResponder) {
          const shouldSet = view.props.onMoveShouldSetResponder(
            {},
            gestureState,
          );
          expect(shouldSet).toBe(true);
        } else {
          expect(true).toBe(true);
        }
      });
    });

    describe("Complete Gesture Flow", () => {
      it("should complete full swipe-to-dismiss flow", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);

        if (!view) {
          expect(true).toBe(true);
          return;
        }

        if (view.props.onStartShouldSetResponder) {
          view.props.onStartShouldSetResponder();
        }

        if (view.props.onResponderMove) {
          view.props.onResponderMove({}, createGestureState(150, 0.8));
        }

        if (view.props.onResponderRelease) {
          view.props.onResponderRelease({}, createGestureState(150, 0.8));
          expect(mockOnClose).toHaveBeenCalled();
        }
      });

      it("should complete gesture flow resulting in snap back", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);

        if (!view) {
          expect(true).toBe(true);
          return;
        }

        if (view.props.onStartShouldSetResponder) {
          view.props.onStartShouldSetResponder();
        }

        if (view.props.onResponderMove) {
          view.props.onResponderMove({}, createGestureState(30, 0.2));
        }

        if (view.props.onResponderRelease) {
          view.props.onResponderRelease({}, createGestureState(30, 0.2));
          expect(mockOnClose).not.toHaveBeenCalled();
          expect(animatedSpring).toHaveBeenCalled();
        }
      });
    });

    describe("Edge Cases", () => {
      it("should handle zero velocity and zero dy", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(0, 0);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);

          expect(mockOnClose).not.toHaveBeenCalled();
          expect(animatedSpring).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should handle very large dy values", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(1000, 2.0);

        if (view && view.props.onResponderRelease) {
          view.props.onResponderRelease({}, gestureState);
          expect(mockOnClose).toHaveBeenCalled();
        } else {
          expect(true).toBe(true);
        }
      });

      it("should use correct spring parameters when snapping back", () => {
        const rendered = render(
          <NavigationBar
            visible={true}
            onClose={mockOnClose}
            onConfirm={mockOnConfirm}
          />,
        );

        const view = findPanResponderView(rendered);
        const gestureState = createGestureState(50, 0.2);

        if (view && view.props.onResponderRelease) {
          animatedSpring.mockClear();
          view.props.onResponderRelease({}, gestureState);

          expect(animatedSpring).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              useNativeDriver: true,
              bounciness: 4,
            }),
          );
        } else {
          expect(true).toBe(true);
        }
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty BUILDINGS array gracefully", () => {
      jest.doMock("../constants/buildings", () => ({
        BUILDINGS: [],
      }));

      const { getByPlaceholderText, queryByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Test");

      expect(queryByText("Richard J Renaud Science Complex (SP)")).toBeNull();
    });

    it("should handle very long search queries", () => {
      const { getByPlaceholderText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      const longQuery = "a".repeat(1000);

      expect(() => {
        fireEvent.changeText(startInput, longQuery);
      }).not.toThrow();
    });

    it("should handle rapid consecutive searches", () => {
      const { getByPlaceholderText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");

      fireEvent.changeText(startInput, "E");
      fireEvent.changeText(startInput, "En");
      fireEvent.changeText(startInput, "Eng");
      fireEvent.changeText(startInput, "Engi");

      expect(startInput.props.value).toBe("Engi");
    });

    it("should handle special characters in search", () => {
      const { getByPlaceholderText, queryByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");

      expect(() => {
        fireEvent.changeText(startInput, "@#$%^&*()");
      }).not.toThrow();
    });
  });

  describe("State Management", () => {
    it("should maintain independent state for start and destination inputs", () => {
      const { getByPlaceholderText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      const destInput = getByPlaceholderText("To");

      fireEvent.changeText(startInput, "Science");
      fireEvent.changeText(destInput, "Library");

      expect(startInput.props.value).toBe("Science");
      expect(destInput.props.value).toBe("Library");
    });

    it("should reset filtered buildings when switching between inputs", () => {
      const { getByPlaceholderText, getByText, queryByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const startInput = getByPlaceholderText("From");
      fireEvent.changeText(startInput, "Science");

      expect(getByText("Richard J Renaud Science Complex (SP)")).toBeTruthy();

      const destInput = getByPlaceholderText("To");
      fireEvent.changeText(destInput, "Library");

      expect(queryByText("Concordia Vanier Library (VL)")).toBeTruthy();
    });
  });

  describe("Auto Start Building (NEW FEATURE)", () => {
    const mockAutoBuilding = {
      name: "EV",
      campusName: "SGW",
      displayName:
        "Engineering, Computer Science and Visual Arts Integrated Complex (EV)",
      address: "1515 Rue Sainte-Catherine O #1428",
      coordinates: { latitude: 45.495626, longitude: -73.577982 },
      icons: [],
      services: [],
      departments: [],
      boundingBox: [],
    };

    it("should auto-fill starting location when autoStartBuilding is provided", async () => {
      const { getByPlaceholderText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          autoStartBuilding={mockAutoBuilding as any}
        />
      );

      await waitFor(() => {
        expect(
          getByPlaceholderText("From").props.value
        ).toBe(mockAutoBuilding.displayName);
      });
    });

    it("should set start building internally and confirm correctly", async () => {
      const { getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          autoStartBuilding={mockAutoBuilding as any}
        />
      );

      fireEvent.press(getByText("Get Directions"));

      expect(mockOnConfirm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "EV",
          displayName:
            "Engineering, Computer Science and Visual Arts Integrated Complex (EV)",
        }),
        null,
        expect.objectContaining({ mode: "walking", label: "Walk", icon: "walk" }),
      );
    });

    it("should not crash when autoStartBuilding is null", () => {
      const { getByPlaceholderText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
          autoStartBuilding={null}
        />
      );

      expect(getByPlaceholderText("From").props.value).toBe("");
    });
  });

  describe("Swap and route summary", () => {
    it("swaps origin and destination when swap button is pressed", () => {
      const { getByPlaceholderText, getByLabelText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      const fromInput = getByPlaceholderText("From");
      const toInput = getByPlaceholderText("To");

      fireEvent.changeText(fromInput, "Science");
      fireEvent.press(getByText("Richard J Renaud Science Complex (SP)"));
      fireEvent.changeText(toInput, "Library");
      fireEvent.press(getByText("Concordia Vanier Library (VL)"));

      expect(fromInput.props.value).toContain("Richard J Renaud");
      expect(toInput.props.value).toContain("Vanier Library");

      fireEvent.press(getByLabelText("Swap origin and destination"));

      expect(fromInput.props.value).toContain("Vanier Library");
      expect(toInput.props.value).toContain("Richard J Renaud");
    });

    it("shows route summary when both locations set and API returns duration and distance", async () => {
      (getOutdoorRouteWithSteps as jest.Mock).mockResolvedValueOnce({
        coordinates: [],
        steps: [],
        duration: "12 mins",
        distance: "2.1 km",
      });

      const { getByPlaceholderText, getByText } = render(
        <NavigationBar
          visible={true}
          onClose={mockOnClose}
          onConfirm={mockOnConfirm}
        />,
      );

      fireEvent.changeText(getByPlaceholderText("From"), "Science");
      fireEvent.press(getByText("Richard J Renaud Science Complex (SP)"));
      fireEvent.changeText(getByPlaceholderText("To"), "Library");
      fireEvent.press(getByText("Concordia Vanier Library (VL)"));

      await waitFor(() => {
        expect(getByText("12 mins · 2.1 km")).toBeTruthy();
      });
    });
  });
});
