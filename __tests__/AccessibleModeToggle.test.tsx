import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { AccessibleModeToggle } from "../components/AccessibleModeToggle";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

const mockStyles = {
  modeButton: { padding: 8 },
  activeModeButton: { backgroundColor: "#912338" },
};

const mockColors = {
  white: "#ffffff",
  primary: "#912338",
};

describe("AccessibleModeToggle", () => {
  it("uses default testID and button label when optional props are omitted", () => {
    const onAccessibleOnlyChange = jest.fn();

    render(
      <AccessibleModeToggle
        localAccessibleOnly={false}
        onAccessibleOnlyChange={onAccessibleOnlyChange}
        colors={mockColors}
        styles={mockStyles}
      />,
    );

    expect(screen.getByTestId("accessible-mode-toggle")).toBeTruthy();
    expect(screen.getByText("Accessible Route")).toBeTruthy();
  });

  it("calls onAccessibleOnlyChange with the toggled value", () => {
    const onAccessibleOnlyChange = jest.fn();

    render(
      <AccessibleModeToggle
        localAccessibleOnly={false}
        onAccessibleOnlyChange={onAccessibleOnlyChange}
        colors={mockColors}
        styles={mockStyles}
      />,
    );

    fireEvent.press(screen.getByTestId("accessible-mode-toggle"));

    expect(onAccessibleOnlyChange).toHaveBeenCalledWith(true);
  });
});
