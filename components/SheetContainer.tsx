import React from "react";
import type { StyleProp } from "react-native";
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";

interface SheetContainerProps {
  panResponder: any;
  translateY: Animated.Value;
  overlayStyle: StyleProp<ViewStyle>;
  keyboardContainerStyle: StyleProp<ViewStyle>;
  sheetStyle: StyleProp<ViewStyle>;
  gestureAreaStyle: StyleProp<ViewStyle>;
  handleStyle: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
  onClose: () => void;
  children: React.ReactNode;
}

export function SheetContainer({
  panResponder,
  translateY,
  overlayStyle,
  keyboardContainerStyle,
  sheetStyle,
  gestureAreaStyle,
  handleStyle,
  contentStyle,
  onClose,
  children,
}: Readonly<SheetContainerProps>) {
  return (
    <>
      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <View style={overlayStyle} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={keyboardContainerStyle}
        pointerEvents="box-none"
      >
        <Animated.View style={[sheetStyle, { transform: [{ translateY }] }]}>
          <View {...panResponder.panHandlers} style={gestureAreaStyle}>
            <View style={handleStyle} />
          </View>

          <View style={contentStyle}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
}
