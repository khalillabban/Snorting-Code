import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { DirectionStepsPanel, StepWrapper } from "../components/DirectionStepsPanel";
import { WALKING_STRATEGY } from "../constants/strategies";
import { RouteStep } from "../constants/type";
import { createStyles } from "../styles/DirectionStepsPanel.styles";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Text } = require("react-native");

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
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

const wrapperStyles = createStyles();

function expandStepsPanel() {
  fireEvent.press(screen.getByLabelText("Expand directions steps"));
}

describe("DirectionStepsPanel", () => {
  it("renders StepWrapper as a plain row when no onPress is provided", () => {
    const { getByText, queryByRole } = render(
      <StepWrapper styles={wrapperStyles}>
        <Text>Plain wrapper</Text>
      </StepWrapper>,
    );

    expect(getByText("Plain wrapper")).toBeTruthy();
    expect(queryByRole("button")).toBeNull();
  });

  it("renders StepWrapper as a pressable and uses the default CTA flag when omitted", () => {
    const onPress = jest.fn();

    render(
      <StepWrapper styles={wrapperStyles} onPress={onPress}>
        <Text>Pressable wrapper</Text>
      </StepWrapper>,
    );

    expect(screen.getByText("Pressable wrapper")).toBeTruthy();
    expect(screen.queryByHintText("Opens indoor directions")).toBeNull();

    fireEvent.press(screen.getByText("Pressable wrapper"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("returns null when steps array is empty", () => {
    const { queryByText } = render(
      <DirectionStepsPanel
        steps={[]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(queryByText("Walk")).toBeNull();
    expect(queryByText("Change route")).toBeNull();
  });

  it("renders strategy label and steps when steps are expanded", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("Walk")).toBeTruthy();
    expect(screen.getByText("Change route")).toBeTruthy();
    expect(screen.getByText("3 steps hidden to keep the route visible")).toBeTruthy();
    expect(screen.queryByText("Head north on Main St")).toBeNull();

    expandStepsPanel();

    expect(screen.getByText("Head north on Main St")).toBeTruthy();
    expect(screen.getByText("100 m - 1 min")).toBeTruthy();
    expect(screen.getByText("Turn right onto Oak Ave")).toBeTruthy();
    expect(screen.getByText("200 m - 3 min")).toBeTruthy();
    expect(screen.getByText("Arrive at destination")).toBeTruthy();
  });

  it("starts collapsed and toggles expanded state from the header control", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("3 steps available")).toBeTruthy();
    expect(screen.queryByText("Head north on Main St")).toBeNull();

    expandStepsPanel();

    expect(screen.getByLabelText("Collapse directions steps")).toBeTruthy();
    expect(screen.getByText("Head north on Main St")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("Collapse directions steps"));

    expect(screen.queryByText("Head north on Main St")).toBeNull();
    expect(screen.getByText("3 steps hidden to keep the route visible")).toBeTruthy();
  });

  it("calls onChangeRoute when Change route is pressed", () => {
    const onChangeRoute = jest.fn();

    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={onChangeRoute}
      />,
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
      />,
    );

    const closeButton = screen.getByLabelText("Close directions");
    expect(closeButton).toBeTruthy();

    fireEvent.press(closeButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

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
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Walk to the stop")).toBeTruthy();
    expect(screen.getByText("Board the Shuttle to Loyola")).toBeTruthy();
    expect(screen.getByText("Take the SHUTTLE back")).toBeTruthy();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);

    expect(iconNames.filter((name) => name === "bus").length).toBe(2);
    expect(iconNames.filter((name) => name === "walk").length).toBe(2);
  });

  it("formats metadata correctly when missing distance or duration", () => {
    const mixedSteps: RouteStep[] = [
      { instruction: "Only distance", distance: "50 m" },
      { instruction: "Only duration", duration: "2 mins" },
      { instruction: "Neither" },
      { instruction: "Both", distance: "10 m", duration: "1 min" },
    ];

    render(
      <DirectionStepsPanel
        steps={mixedSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("50 m")).toBeTruthy();
    expect(screen.getByText("2 mins")).toBeTruthy();
    expect(screen.getByText("10 m - 1 min")).toBeTruthy();
  });

  it("does not render metadata when distance and duration are empty strings", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Empty meta", distance: "", duration: "" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Empty meta")).toBeTruthy();
    expect(screen.queryByText(" - ")).toBeNull();
  });

  it("renders different strategy label for transit", () => {
    const transitStrategy = { mode: "transit" as const, label: "Transit", icon: "bus" };

    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={transitStrategy}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("Transit")).toBeTruthy();
  });

  it("renders a pressable step when onPress is provided and calls it when pressed", () => {
    const onStepPress = jest.fn();

    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Tap me",
            distance: "1 m",
            duration: "1 sec",
            onPress: onStepPress,
          },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    fireEvent.press(screen.getByText("Tap me"));
    expect(onStepPress).toHaveBeenCalledTimes(1);
  });

  it("renders the location button and calls onFocusUser when pressed", () => {
    const onFocusUser = jest.fn();

    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
        onFocusUser={onFocusUser}
      />,
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
      />,
    );

    expect(screen.queryByLabelText("Center on my location")).toBeNull();
  });

  it("does not render dismiss button when onDismiss is not provided", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.queryByLabelText("Close directions")).toBeNull();
  });

  it("renders the final pressable step as a continue indoors CTA", () => {
    const onFinalStepPress = jest.fn();

    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Walk outside", distance: "50 m", duration: "1 min" },
          {
            instruction: "Continue indoors to H-920",
            onPress: onFinalStepPress,
          },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Continue indoors to H-920")).toBeTruthy();
    expect(screen.getByHintText("Opens indoor directions")).toBeTruthy();
    expect(screen.getByText("chevron-right")).toBeTruthy();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);

    expect(iconNames).toContain("door-open");
    expect(iconNames.filter((name) => name === "walk").length).toBe(2);

    fireEvent.press(screen.getByText("Continue indoors to H-920"));
    expect(onFinalStepPress).toHaveBeenCalledTimes(1);
  });

  it("renders the final pressable step as a CTA with indoor directions hint", () => {
    const onPress = jest.fn();

    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Walk outside", distance: "50 m" },
          { instruction: "Continue indoors", onPress },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Continue indoors")).toBeTruthy();
    expect(screen.getByHintText("Opens indoor directions")).toBeTruthy();

    fireEvent.press(screen.getByText("Continue indoors"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not add CTA accessibility hint for non-final pressable step", () => {
    const onMidStepPress = jest.fn();

    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Tap midpoint", onPress: onMidStepPress },
          { instruction: "Final non-cta" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.queryByHintText("Opens indoor directions")).toBeNull();

    fireEvent.press(screen.getByText("Tap midpoint"));
    expect(onMidStepPress).toHaveBeenCalledTimes(1);
  });

  it("renders non-pressable steps as plain rows", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Plain step", distance: "5 m" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Plain step")).toBeTruthy();
    expect(screen.queryByHintText("Opens indoor directions")).toBeNull();
    expect(screen.getByText("5 m")).toBeTruthy();
  });

  it("renders shuttle highlight path when instruction contains board", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Board shuttle at stop", duration: "2 min" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);
    expect(iconNames).toContain("bus");
  });
});
