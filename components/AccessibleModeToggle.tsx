import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";

interface AccessibleModeToggleProps {
  localAccessibleOnly: boolean;
  onAccessibleOnlyChange: (value: boolean) => void;
  colors: { white: string; primary: string };
  styles: {
    modeButton?: StyleProp<ViewStyle>;
    activeModeButton?: StyleProp<ViewStyle>;
  };
  testID?: string;
  rowStyle?: StyleProp<ViewStyle>;
  buttonLabel?: string;
}

export function AccessibleModeToggle({
  localAccessibleOnly,
  onAccessibleOnlyChange,
  colors,
  styles,
  testID = "accessible-mode-toggle",
  rowStyle,
  buttonLabel = "Accessible Route",
}: Readonly<AccessibleModeToggleProps>) {
  return (
    <View style={rowStyle}>
      <Pressable
        onPress={() => {
          onAccessibleOnlyChange(!localAccessibleOnly);
        }}
        style={[
          styles.modeButton,
          localAccessibleOnly && styles.activeModeButton,
          {
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
          },
        ]}
        accessibilityRole="switch"
        accessibilityState={{ checked: localAccessibleOnly }}
        testID={testID}
      >
        <MaterialCommunityIcons
          name={localAccessibleOnly ? "wheelchair-accessibility" : "walk"}
          size={22}
          color={localAccessibleOnly ? colors.white : colors.primary}
        />
        <Text
          style={{
            color: localAccessibleOnly ? colors.white : colors.primary,
            marginLeft: 8,
          }}
        >
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}
