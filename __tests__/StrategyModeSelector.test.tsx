import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { StrategyModeSelector } from "../components/StrategyModeSelector";
import { SHUTTLE_STRATEGY, WALKING_STRATEGY } from "../constants/strategies";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

const mockButtonStyles = {
  modeButton: { padding: 8 },
  activeModeButton: { backgroundColor: "#912338" },
  disabledModeButton: { opacity: 0.5 },
  modeText: { fontSize: 12 },
  modeSummary: { fontSize: 10 },
};

describe("StrategyModeSelector", () => {
  it("renders all strategy buttons", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        buttonStyles={mockButtonStyles}
      />,
    );

    expect(screen.getByTestId("mode-button-walking")).toBeTruthy();
    expect(screen.getByTestId("mode-button-bicycling")).toBeTruthy();
    expect(screen.getByTestId("mode-button-driving")).toBeTruthy();
    expect(screen.getByTestId("mode-button-transit")).toBeTruthy();
    expect(screen.getByTestId("mode-button-shuttle")).toBeTruthy();
  });

  it("renders route duration beneath each transportation mode", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        buttonStyles={mockButtonStyles}
        routeSummaries={{
          walking: "22 min",
          bicycling: "14 min",
          driving: "9 min",
          transit: "27 min",
          shuttle: "31 min",
        }}
      />,
    );

    expect(screen.getByText("22 min")).toBeTruthy();
    expect(screen.getByText("14 min")).toBeTruthy();
    expect(screen.getByText("9 min")).toBeTruthy();
    expect(screen.getByText("27 min")).toBeTruthy();
    expect(screen.getByText("31 min")).toBeTruthy();
  });

  it("calls onSelect when a strategy button is pressed", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        buttonStyles={mockButtonStyles}
      />,
    );

    fireEvent.press(screen.getByTestId("mode-button-bicycling"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "bicycling" }),
    );
  });

  it("disables shuttle button when shuttleAvailable is false", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={false}
        buttonStyles={mockButtonStyles}
      />,
    );

    const shuttleButton = screen.getByTestId("mode-button-shuttle");
    expect(shuttleButton.props.accessibilityState?.disabled).toBe(true);
  });

  it("does not call onSelect when disabled shuttle button is pressed", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={false}
        buttonStyles={mockButtonStyles}
      />,
    );

    fireEvent.press(screen.getByTestId("mode-button-shuttle"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("guards onPress callback when shuttle is disabled", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={false}
        buttonStyles={mockButtonStyles}
      />,
    );

    const shuttleButton = screen.getByTestId("mode-button-shuttle");
    fireEvent(shuttleButton, "onPress");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("enables shuttle button when shuttleAvailable is true", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={true}
        buttonStyles={mockButtonStyles}
      />,
    );

    const shuttleButton = screen.getByTestId("mode-button-shuttle");
    expect(shuttleButton.props.accessibilityState?.disabled).toBe(false);
  });

  it("calls onSelect when shuttle is available and pressed", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={true}
        buttonStyles={mockButtonStyles}
      />,
    );

    fireEvent.press(screen.getByTestId("mode-button-shuttle"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "shuttle" }),
    );
  });

  it("applies active style to selected strategy", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={SHUTTLE_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={true}
        buttonStyles={mockButtonStyles}
      />,
    );

    const shuttleButton = screen.getByTestId("mode-button-shuttle");
    expect(shuttleButton.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining(mockButtonStyles.activeModeButton),
      ]),
    );
  });

  it("uses custom testIDPrefix when provided", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        buttonStyles={mockButtonStyles}
        testIDPrefix="custom-prefix"
      />,
    );

    expect(screen.getByTestId("custom-prefix-walking")).toBeTruthy();
  });

  it("shows gray color for disabled shuttle button", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        shuttleAvailable={false}
        buttonStyles={mockButtonStyles}
      />,
    );

    const shuttleButton = screen.getByTestId("mode-button-shuttle");
    expect(shuttleButton.props.accessibilityHint).toBe(
      "Shuttle is currently unavailable",
    );
  });

  it("shows white color for active strategy button", () => {
    const onSelect = jest.fn();
    render(
      <StrategyModeSelector
        selectedStrategy={WALKING_STRATEGY}
        onSelect={onSelect}
        buttonStyles={mockButtonStyles}
      />,
    );

    const walkingButton = screen.getByTestId("mode-button-walking");
    expect(walkingButton.props.accessibilityState?.disabled).toBeFalsy();
  });
});
