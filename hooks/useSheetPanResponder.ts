import { useRef } from "react";
import {
    Animated,
    GestureResponderEvent,
    PanResponder,
    PanResponderGestureState,
} from "react-native";

const SHEET_TOP = 0;
const SPRING_CONFIG = { useNativeDriver: true, damping: 20, stiffness: 150 };

interface UseSheetPanResponderProps {
  translateY: Animated.Value;
  onClose: () => void;
}

export function useSheetPanResponder({
  translateY,
  onClose,
}: UseSheetPanResponderProps) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (
        _: GestureResponderEvent,
        g: PanResponderGestureState,
      ) => Math.abs(g.dy) > 10,
      onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
        if (g.dy > 0) translateY.setValue(SHEET_TOP + g.dy);
      },
      onPanResponderRelease: (
        _: GestureResponderEvent,
        g: PanResponderGestureState,
      ) => {
        if (g.dy > 120 || g.vy > 0.5) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: SHEET_TOP,
            ...SPRING_CONFIG,
          }).start();
        }
      },
    }),
  ).current;

  return panResponder;
}
