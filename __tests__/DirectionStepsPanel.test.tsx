import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { DirectionStepsPanel } from "../components/DirectionStepsPanel";
import { WALKING_STRATEGY } from "../constants/strategies";
import { RouteStep } from "../services/GoogleDirectionsService";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

const mockSteps: RouteStep[] = [
  { instruction: "Head north on Main St", distance: "100 m", duration: "1 min" },
  { instruction: "Turn right onto Oak Ave", distance: "200 m", duration: "3 min" },
  { instruction: "Arrive at destination", duration: "1 min" },
];

describe("DirectionStepsPanel", () => {
  it("returns null when steps array is empty", () => {
    const { queryByText } = render(
      <DirectionStepsPanel
        steps={[]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );
    expect(queryByText("Walk")).toBeNull();
    expect(queryByText("Change route")).toBeNull();
  });

  it("renders strategy label and steps when steps are provided", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );
    expect(screen.getByText("Walk")).toBeTruthy();
    expect(screen.getByText("Change route")).toBeTruthy();
    expect(screen.getByText("Head north on Main St")).toBeTruthy();
    expect(screen.getByText("100 m · 1 min")).toBeTruthy();
    expect(screen.getByText("Turn right onto Oak Ave")).toBeTruthy();
    expect(screen.getByText("200 m · 3 min")).toBeTruthy();
    expect(screen.getByText("Arrive at destination")).toBeTruthy();
  });

  it("calls onChangeRoute when Change route is pressed", () => {
    const onChangeRoute = jest.fn();
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={onChangeRoute}
      />
    );
    fireEvent.press(screen.getByText("Change route"));
    expect(onChangeRoute).toHaveBeenCalledTimes(1);
  });

  it("renders dismiss button and calls onDismiss when provided", () => {
    const onDismiss = jest.fn();
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
        onDismiss={onDismiss}
      />
    );
    const closeButton = screen.getByLabelText("Close directions");
    expect(closeButton).toBeTruthy();
    fireEvent.press(closeButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders step numbers", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders different strategy label for transit", () => {
    const transitStrategy = { mode: "transit" as const, label: "Transit", icon: "bus" };
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={transitStrategy}
        onChangeRoute={() => {}}
      />
    );
    expect(screen.getByText("Transit")).toBeTruthy();
  });
});
