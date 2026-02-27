import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { DirectionStepsPanel } from "../components/DirectionStepsPanel";
import { WALKING_STRATEGY } from "../constants/strategies";
import { RouteStep } from "../constants/type";

// Updated mock to render icon names, allowing us to test "bus" vs "walk" icons
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    MaterialCommunityIcons: (props: any) => <Text testID="mci-icon">{props.name}</Text>,
    MaterialIcons: (props: any) => <Text testID="mi-icon">{props.name}</Text>,
  };
});

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

  // --- NEW COVERAGE: Shuttle logic & icons ---
  it("identifies shuttle steps using 'shuttle' or 'board' keywords and renders correct icons", () => {
    const shuttleSteps: RouteStep[] = [
      { instruction: "Walk to the stop", distance: "100 m" },
      { instruction: "Board the Shuttle to Loyola", duration: "15 min" },
      { instruction: "Take the SHUTTLE back", distance: "5 km" },
    ];
    
    render(
      <DirectionStepsPanel
        steps={shuttleSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );
    
    expect(screen.getByText("Walk to the stop")).toBeTruthy();
    expect(screen.getByText("Board the Shuttle to Loyola")).toBeTruthy();
    expect(screen.getByText("Take the SHUTTLE back")).toBeTruthy();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map(icon => icon.props.children);
    
    // Total icons should be 4: 
    // 1 for the Header Badge (walk)
    // 1 for Step 0 (walk)
    // 1 for Step 1 (bus - triggered by 'Board')
    // 1 for Step 2 (bus - triggered by 'SHUTTLE')
    expect(iconNames.filter(name => name === "bus").length).toBe(2);
    expect(iconNames.filter(name => name === "walk").length).toBe(2);
  });

  // --- NEW COVERAGE: Distance / Duration combinations ---
  it("formats metadata correctly when missing distance or duration", () => {
    const mixedSteps: RouteStep[] = [
      { instruction: "Only distance", distance: "50 m" },
      { instruction: "Only duration", duration: "2 mins" },
      { instruction: "Neither" },
      { instruction: "Both", distance: "10 m", duration: "1 min" }
    ];

    render(
      <DirectionStepsPanel
        steps={mixedSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );

    // Verifies `[step.distance, step.duration].filter(Boolean).join(" · ")` logic
    expect(screen.getByText("50 m")).toBeTruthy();
    expect(screen.getByText("2 mins")).toBeTruthy();
    expect(screen.getByText("10 m · 1 min")).toBeTruthy();
    // The "Neither" step shouldn't render any metadata text block
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

  it("renders the location button and calls onFocusUser when pressed", () => {
    const onFocusUser = jest.fn();
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
        onFocusUser={onFocusUser}
      />
    );
    const locationButton = screen.getByLabelText("Center on my location");
    expect(locationButton).toBeTruthy();
    fireEvent.press(locationButton);
    expect(onFocusUser).toHaveBeenCalledTimes(1);
  });

  it("does not render location button when onFocusUser is not provided", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );
    expect(screen.queryByLabelText("Center on my location")).toBeNull();
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />
    );
    expect(screen.queryByLabelText("Close directions")).toBeNull();
  });
});