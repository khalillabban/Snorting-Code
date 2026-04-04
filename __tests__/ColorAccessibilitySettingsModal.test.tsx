import { describe, expect, it, jest } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ColorAccessibilitySettingsModal } from "../components/ColorAccessibilitySettingsModal";
import * as ColorAccessibilityContext from "../contexts/ColorAccessibilityContext";

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require("react-native");
  return {
    __esModule: true,
    MaterialCommunityIcons: (props: any) => <Text>{props.name}</Text>,
  };
});

describe("ColorAccessibilitySettingsModal", () => {
  it("renders options and calls setMode when selecting an option", () => {
    const setMode = jest.fn();
    jest.spyOn(ColorAccessibilityContext, "useColorAccessibility").mockReturnValue({
      mode: "classic",
      setMode,
      isHydrated: true,
      colors: {
        white: "#fff",
        black: "#000",
        offWhite: "#f2f2f2",
        primary: "#912338",
        primaryDark: "#6d1a2a",
        gray100: "#e5e5e5",
        gray700: "#404040",
      } as any,
      options: [
        {
          value: "classic",
          label: "Classic Concordia",
          description: "Original campus red and gold branding.",
        },
        {
          value: "redGreenSafe",
          label: "Red-Green Safe",
          description: "Uses blue, teal, and amber to reduce confusion for red-green deficiencies.",
        },
      ],
    } as any);

    render(<ColorAccessibilitySettingsModal visible onClose={jest.fn()} />);

    expect(screen.getByText("Color accessibility")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Red-Green Safe"));
    expect(setMode).toHaveBeenCalledWith("redGreenSafe");
  });
});
