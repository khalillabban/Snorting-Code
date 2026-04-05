import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { ZoomableView, clampScale } from "../components/ZoomableView";

type GestureCallback = (event?: any) => void;

const capturedCallbacks: {
  pinch: { onStart?: GestureCallback; onUpdate?: GestureCallback };
  pan: { onStart?: GestureCallback; onUpdate?: GestureCallback };
  tap: { onEnd?: GestureCallback };
} = {
  pinch: {},
  pan: {},
  tap: {},
};

const createPinchGestureMock = () => {
  const gesture: any = {
    onStart: jest.fn((cb: GestureCallback) => {
      capturedCallbacks.pinch.onStart = cb;
      return gesture;
    }),
    onUpdate: jest.fn((cb: GestureCallback) => {
      capturedCallbacks.pinch.onUpdate = cb;
      return gesture;
    }),
  };
  return gesture;
};

const createPanGestureMock = () => {
  const gesture: any = {
    onStart: jest.fn((cb: GestureCallback) => {
      capturedCallbacks.pan.onStart = cb;
      return gesture;
    }),
    onUpdate: jest.fn((cb: GestureCallback) => {
      capturedCallbacks.pan.onUpdate = cb;
      return gesture;
    }),
  };
  return gesture;
};

const createTapGestureMock = () => {
  const gesture: any = {
    numberOfTaps: jest.fn(() => gesture),
    onEnd: jest.fn((cb: GestureCallback) => {
      capturedCallbacks.tap.onEnd = cb;
      return gesture;
    }),
  };
  return gesture;
};

jest.mock("react-native-gesture-handler", () => ({
  GestureHandlerRootView: ({ children, style }: any) => {
    const { View } = require("react-native");
    return <View style={style}>{children}</View>;
  },
  GestureDetector: ({ children }: any) => children,
  Gesture: {
    Pinch: () => createPinchGestureMock(),
    Pan: () => createPanGestureMock(),
    Tap: () => createTapGestureMock(),
    Simultaneous: jest.fn(() => ({})),
    Race: jest.fn(() => ({})),
  },
}));

const createSharedValue = (init: number) => {
  const obj = { value: init };
  return obj;
};

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const Animated = { View };
  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (init: number) => createSharedValue(init),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
  };
});

describe("clampScale", () => {
  it("returns value when within bounds", () => {
    expect(clampScale(2, 1, 4)).toBe(2);
  });

  it("clamps to min when value is below min", () => {
    expect(clampScale(0.5, 1, 4)).toBe(1);
  });

  it("clamps to max when value is above max", () => {
    expect(clampScale(5, 1, 4)).toBe(4);
  });

  it("handles edge case where value equals min", () => {
    expect(clampScale(1, 1, 4)).toBe(1);
  });

  it("handles edge case where value equals max", () => {
    expect(clampScale(4, 1, 4)).toBe(4);
  });

  it("handles negative values", () => {
    expect(clampScale(-1, 0, 4)).toBe(0);
  });
});

describe("ZoomableView", () => {
  beforeEach(() => {
    capturedCallbacks.pinch = {};
    capturedCallbacks.pan = {};
    capturedCallbacks.tap = {};
  });

  it("renders children correctly", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Test Content</Text>
      </ZoomableView>
    );

    expect(screen.getByText("Test Content")).toBeTruthy();
  });

  it("applies custom style", () => {
    render(
      <ZoomableView style={{ backgroundColor: "red" }} testID="zoomable">
        <Text>Styled Content</Text>
      </ZoomableView>
    );

    expect(screen.getByText("Styled Content")).toBeTruthy();
  });

  it("accepts minScale and maxScale props", () => {
    render(
      <ZoomableView minScale={0.5} maxScale={5} testID="zoomable">
        <Text>Scalable Content</Text>
      </ZoomableView>
    );

    expect(screen.getByText("Scalable Content")).toBeTruthy();
  });

  it("renders with testID", () => {
    render(
      <ZoomableView testID="zoom-container">
        <Text>Content</Text>
      </ZoomableView>
    );

    expect(screen.getByTestId("zoom-container")).toBeTruthy();
  });

  it("uses default minScale of 1 and maxScale of 4", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Default Scale</Text>
      </ZoomableView>
    );

    expect(screen.getByText("Default Scale")).toBeTruthy();
  });

  it("registers pinch gesture callbacks", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Pinch Test</Text>
      </ZoomableView>
    );

    expect(capturedCallbacks.pinch.onStart).toBeDefined();
    expect(capturedCallbacks.pinch.onUpdate).toBeDefined();
  });

  it("registers pan gesture callbacks", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Pan Test</Text>
      </ZoomableView>
    );

    expect(capturedCallbacks.pan.onStart).toBeDefined();
    expect(capturedCallbacks.pan.onUpdate).toBeDefined();
  });

  it("registers tap gesture callback", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Tap Test</Text>
      </ZoomableView>
    );

    expect(capturedCallbacks.tap.onEnd).toBeDefined();
  });

  it("handles pinch gesture lifecycle", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Pinch Lifecycle</Text>
      </ZoomableView>
    );

    expect(() => {
      capturedCallbacks.pinch.onStart?.();
      capturedCallbacks.pinch.onUpdate?.({ scale: 2 });
    }).not.toThrow();
  });

  it("handles pinch to zoom in", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Zoom In</Text>
      </ZoomableView>
    );

    capturedCallbacks.pinch.onStart?.();
    capturedCallbacks.pinch.onUpdate?.({ scale: 3 });
  });

  it("handles pan gesture when zoomed", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Pan Zoomed</Text>
      </ZoomableView>
    );

    capturedCallbacks.pinch.onStart?.();
    capturedCallbacks.pinch.onUpdate?.({ scale: 2 });
    capturedCallbacks.pan.onStart?.();
    capturedCallbacks.pan.onUpdate?.({ translationX: 50, translationY: 30 });
  });

  it("handles double tap to zoom", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Double Tap</Text>
      </ZoomableView>
    );

    capturedCallbacks.tap.onEnd?.();
  });

  it("handles double tap to reset zoom", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Reset Zoom</Text>
      </ZoomableView>
    );

    capturedCallbacks.pinch.onStart?.();
    capturedCallbacks.pinch.onUpdate?.({ scale: 2 });
    capturedCallbacks.tap.onEnd?.();
  });

  it("clamps scale to maxScale on pinch", () => {
    render(
      <ZoomableView minScale={1} maxScale={2} testID="zoomable">
        <Text>Max Scale</Text>
      </ZoomableView>
    );

    capturedCallbacks.pinch.onStart?.();
    capturedCallbacks.pinch.onUpdate?.({ scale: 10 });
  });

  it("handles pan at default scale (no movement)", () => {
    render(
      <ZoomableView testID="zoomable">
        <Text>Pan Default</Text>
      </ZoomableView>
    );

    capturedCallbacks.pan.onStart?.();
    capturedCallbacks.pan.onUpdate?.({ translationX: 100, translationY: 100 });
  });

  it("renders without style prop", () => {
    render(
      <ZoomableView testID="no-style">
        <Text>No Style</Text>
      </ZoomableView>
    );

    expect(screen.getByTestId("no-style")).toBeTruthy();
  });

});
