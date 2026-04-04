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

  it("does not render content when visible is false", () => {
    jest.spyOn(ColorAccessibilityContext, "useColorAccessibility").mockReturnValue({
      mode: "classic",
      setMode: jest.fn(),
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
      options: [],
    } as any);

    render(<ColorAccessibilitySettingsModal visible={false} onClose={jest.fn()} />);
    expect(screen.queryByText("Color accessibility")).toBeNull();
  });

  it("calls onClose when Done is pressed", () => {
    const onClose = jest.fn();
    jest.spyOn(ColorAccessibilityContext, "useColorAccessibility").mockReturnValue({
      mode: "classic",
      setMode: jest.fn(),
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
      ],
    } as any);

    render(<ColorAccessibilitySettingsModal visible onClose={onClose} />);

    fireEvent.press(screen.getByText("Done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the modal requests close", () => {
    const onClose = jest.fn();
    jest.spyOn(ColorAccessibilityContext, "useColorAccessibility").mockReturnValue({
      mode: "classic",
      setMode: jest.fn(),
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
      ],
    } as any);

    const { UNSAFE_getByType } = render(
      <ColorAccessibilitySettingsModal visible onClose={onClose} />,
    );

    const modal = UNSAFE_getByType(require("react-native").Modal);
    fireEvent(modal, "onRequestClose");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when tapping the backdrop", () => {
    const onClose = jest.fn();
    jest.spyOn(ColorAccessibilityContext, "useColorAccessibility").mockReturnValue({
      mode: "classic",
      setMode: jest.fn(),
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
      ],
    } as any);

    render(<ColorAccessibilitySettingsModal visible onClose={onClose} />);

    fireEvent.press(screen.getByTestId("color-settings-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stops propagation when pressing inside the sheet", () => {
    const onClose = jest.fn();
    jest.spyOn(ColorAccessibilityContext, "useColorAccessibility").mockReturnValue({
      mode: "classic",
      setMode: jest.fn(),
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
      ],
    } as any);

    render(<ColorAccessibilitySettingsModal visible onClose={onClose} />);

    const stopPropagation = jest.fn();
    fireEvent(screen.getByTestId("color-settings-sheet"), "onPress", {
      stopPropagation,
    });

    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
