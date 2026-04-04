import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { ZoomableView } from "../components/ZoomableView";

const createGestureMock = () => {
  const gesture = {
    onStart: jest.fn(() => gesture),
    onUpdate: jest.fn(() => gesture),
    onEnd: jest.fn(() => gesture),
    numberOfTaps: jest.fn(() => gesture),
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
    Pinch: () => createGestureMock(),
    Pan: () => createGestureMock(),
    Tap: () => createGestureMock(),
    Simultaneous: jest.fn(() => ({})),
    Race: jest.fn(() => ({})),
  },
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  const Animated = { View };
  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (init: number) => ({ value: init }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
  };
});

const createGestureMockFn = () => {
  const gesture: any = {
    onStart: jest.fn(() => gesture),
    onUpdate: jest.fn(() => gesture),
    onEnd: jest.fn(() => gesture),
    numberOfTaps: jest.fn(() => gesture),
  };
  return gesture;
};

describe("ZoomableView", () => {
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
});
