import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface ZoomableViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  minScale?: number;
  maxScale?: number;
  testID?: string;
}

export function clampScale(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(Math.max(value, min), max);
}

function maxTranslateForAxis(scale: number, viewportSize: number): number {
  "worklet";
  return Math.max(0, ((scale - 1) * viewportSize) / 2);
}

function clampTranslate(
  value: number,
  scale: number,
  viewportSize: number,
): number {
  "worklet";
  const max = maxTranslateForAxis(scale, viewportSize);
  return Math.min(Math.max(value, -max), max);
}

export function ZoomableView({
  children,
  style,
  minScale = 1,
  maxScale = 4,
  testID,
}: Readonly<ZoomableViewProps>) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const viewportWidth = useSharedValue(0);
  const viewportHeight = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      "worklet";
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      "worklet";
      const nextScale = clampScale(
        savedScale.value * event.scale,
        minScale,
        maxScale,
      );
      const scaleRatio =
        savedScale.value === 0 ? 1 : nextScale / savedScale.value;
      const nextTranslateX = savedTranslateX.value * scaleRatio;
      const nextTranslateY = savedTranslateY.value * scaleRatio;

      scale.value = nextScale;
      translateX.value = clampTranslate(
        nextTranslateX,
        nextScale,
        viewportWidth.value,
      );
      translateY.value = clampTranslate(
        nextTranslateY,
        nextScale,
        viewportHeight.value,
      );
    });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      "worklet";
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      "worklet";
      if (scale.value <= minScale) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }

      translateX.value = clampTranslate(
        savedTranslateX.value + event.translationX,
        scale.value,
        viewportWidth.value,
      );
      translateY.value = clampTranslate(
        savedTranslateY.value + event.translationY,
        scale.value,
        viewportHeight.value,
      );
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      "worklet";
      if (scale.value > minScale) {
        scale.value = withTiming(minScale);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      } else {
        scale.value = withTiming(clampScale(2, minScale, maxScale));
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(panGesture, doubleTapGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureHandlerRootView style={styles.root}>
      <View
        style={[styles.container, style]}
        onLayout={(event) => {
          viewportWidth.value = event.nativeEvent.layout.width;
          viewportHeight.value = event.nativeEvent.layout.height;
        }}
      >
        <GestureDetector gesture={composedGesture}>
          <Animated.View
            style={[styles.content, animatedStyle]}
            testID={testID}
          >
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    width: "100%",
    height: "100%",
  },
});
