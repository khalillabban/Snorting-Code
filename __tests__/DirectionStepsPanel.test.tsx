import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import {
  DirectionStepsPanel,
  StepWrapper,
} from "../components/DirectionStepsPanel";
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
    MaterialCommunityIcons: (props: any) => (
      <Text testID="mci-icon">{props.name}</Text>
    ),
    MaterialIcons: (props: any) => <Text testID="mi-icon">{props.name}</Text>,
  };
});

const mockSteps: RouteStep[] = [
  {
    instruction: "Head north on Main St",
    distance: "100 m",
    duration: "1 min",
  },
  {
    instruction: "Turn right onto Oak Ave",
    distance: "200 m",
    duration: "3 min",
  },
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
    expect(screen.getByText("5 min \u00B7 300 m")).toBeTruthy();
    expect(screen.getByText("Change route")).toBeTruthy();
    expect(
      screen.getByText("3 steps hidden to keep the route visible"),
    ).toBeTruthy();
    expect(screen.queryByText("Head north on Main St")).toBeNull();

    expandStepsPanel();

    expect(screen.getByText("Head north on Main St")).toBeTruthy();
    expect(screen.getByText("100 m \u00B7 1 min")).toBeTruthy();
    expect(screen.getByText("Turn right onto Oak Ave")).toBeTruthy();
    expect(screen.getByText("200 m \u00B7 3 min")).toBeTruthy();
    expect(screen.getByText("Arrive at destination")).toBeTruthy();
  });

  it("prefers the provided route summary over the computed one", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        routeSummary={{ duration: "7 min", distance: "450 m" }}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("7 min \u00B7 450 m")).toBeTruthy();
    expect(screen.queryByText("5 min \u00B7 300 m")).toBeNull();
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
    expect(
      screen.getByText("3 steps hidden to keep the route visible"),
    ).toBeTruthy();
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
    expect(screen.getByText("10 m \u00B7 1 min")).toBeTruthy();
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
    expect(screen.queryByText(" \u00B7 ")).toBeNull();
  });

  it("renders different strategy label for transit", () => {
    const transitStrategy = {
      mode: "transit" as const,
      label: "Transit",
      icon: "bus",
    };

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

  it("expands from the collapsed preview when preview is pressed", () => {
    render(
      <DirectionStepsPanel
        steps={mockSteps}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    fireEvent.press(screen.getByLabelText("Open route steps preview"));

    expect(screen.getByLabelText("Collapse directions steps")).toBeTruthy();
    expect(screen.getByText("Head north on Main St")).toBeTruthy();
  });

  it("computes route summary from imperial units", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Head out", distance: "1 mi", duration: "1 hr" },
          { instruction: "Final approach", distance: "500 ft", duration: "0 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("1 hr · 1.8 km")).toBeTruthy();
  });

  it("formats multi-hour durations with and without remaining minutes", () => {
    const { rerender } = render(
      <DirectionStepsPanel
        steps={[{ instruction: "Long trip", duration: "120 min", distance: "100 m" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("2 hrs · 100 m")).toBeTruthy();

    rerender(
      <DirectionStepsPanel
        steps={[{ instruction: "Long trip", duration: "125 min", distance: "100 m" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("2 hrs 5 min · 100 m")).toBeTruthy();
  });

  it("formats singular-hour durations with remaining minutes", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Almost there", duration: "65 min", distance: "100 m" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("1 hr 5 min · 100 m")).toBeTruthy();
  });

  it("ignores unparsable values when computing summary", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Bad", distance: "about one block", duration: "soon" },
          { instruction: "Good", distance: "10 m", duration: "1 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("1 min · 10 m")).toBeTruthy();
  });

  it("ignores values that parse to non-finite durations", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Huge duration",
            distance: "10 m",
            duration: `${"1"}${"0".repeat(400)} min`,
          },
          { instruction: "Valid", distance: "20 m", duration: "2 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("2 min · 30 m")).toBeTruthy();
  });

  it("uses explicit routeSummary when provided", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Step", distance: "10 m", duration: "1 min" }]}
        strategy={WALKING_STRATEGY}
        routeSummary={{ duration: "Custom Time", distance: "Custom Distance" }}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("Custom Time · Custom Distance")).toBeTruthy();
  });

  it("skips invalid parser inputs and formats exact kilometer totals", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Invalid values", distance: "1.2.3 km", duration: "1..2 h" },
          { instruction: "Blank duration", distance: "500 m", duration: "   " },
          { instruction: "Valid values", distance: "500 m", duration: "60 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("3 hrs · 1 km")).toBeTruthy();
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
    expect(screen.getAllByText("5 m").length).toBeGreaterThanOrEqual(1);
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

  it("renders transit details metadata for a transit step", () => {
    const transitStep: RouteStep = {
      instruction: "Bus towards Atwater",
      distance: "4 km",
      duration: "15 min",
      transitDetails: {
        lineName: "24",
        vehicleType: "BUS",
        departureTime: "3:15 PM",
        arrivalTime: "3:30 PM",
        numStops: 5,
      },
    };

    render(
      <DirectionStepsPanel
        steps={[transitStep]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Bus towards Atwater")).toBeTruthy();
    expect(
      screen.getByText("Line 24 · Departs 3:15 PM · Arrives 3:30 PM · 5 stops"),
    ).toBeTruthy();
    expect(screen.getByText("4 km · 15 min")).toBeTruthy();
  });

  it("renders partial transit details when some fields are missing", () => {
    const transitStep: RouteStep = {
      instruction: "Metro towards Berri",
      duration: "8 min",
      transitDetails: {
        lineName: "Green",
        vehicleType: "SUBWAY",
        numStops: 3,
      },
    };

    render(
      <DirectionStepsPanel
        steps={[transitStep]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Line Green · 3 stops")).toBeTruthy();
  });

  it("renders subway icon for SUBWAY vehicleType", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Take metro",
            transitDetails: { vehicleType: "SUBWAY", lineName: "Orange" },
          },
        ]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);
    expect(iconNames).toContain("subway");
  });

  it("renders train icon for RAIL vehicleType", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Take train",
            transitDetails: { vehicleType: "RAIL", lineName: "Exo" },
          },
        ]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);
    expect(iconNames).toContain("train");
  });

  it("renders bus icon for unknown vehicleType in transitDetails", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Take ferry",
            transitDetails: { vehicleType: "FERRY", lineName: "F1" },
          },
        ]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    const icons = screen.getAllByTestId("mci-icon");
    const stepIcons = icons.map((icon) => icon.props.children);
    // Header icon is "bus" (from strategy), step icon should also be "bus" (fallback)
    expect(stepIcons.filter((n) => n === "bus").length).toBe(2);
  });

  it("does not render transit details row for steps without transitDetails", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Walk north", distance: "200 m", duration: "3 min" },
        ]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Walk north")).toBeTruthy();
    expect(screen.getByText("200 m · 3 min")).toBeTruthy();
    expect(screen.queryByText(/^Line /)).toBeNull();
    expect(screen.queryByText(/Departs/)).toBeNull();
  });

  it("computes route summary with miles and feet distances", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Step A", distance: "1 mi", duration: "20 min" },
          { instruction: "Step B", distance: "500 ft", duration: "3 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    // 1 mi = 1609.34 m, 500 ft = 152.4 m => total ~1761.74 m => "1.8 km"
    // 20 + 3 = 23 min
    expect(screen.getByText("23 min · 1.8 km")).toBeTruthy();
  });

  it("computes route summary with hours when duration >= 60 min", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Long walk", distance: "5 km", duration: "75 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    // 75 min => "1 hr 15 min"
    expect(screen.getByText("1 hr 15 min · 5 km")).toBeTruthy();
  });

  it("computes route summary with exact hours when remaining is 0", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Drive", distance: "10 km", duration: "60 min" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    // 60 min => "1 hr"
    expect(screen.getByText("1 hr · 10 km")).toBeTruthy();
  });

  it("computes route summary with plural hours", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Long drive",
            distance: "100 km",
            duration: "2 hours 30 min",
          },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    // 150 min => "2 hrs 30 min"
    expect(screen.getByText("2 hrs 30 min · 100 km")).toBeTruthy();
  });

  it("uses routeSummary prop when provided instead of computed summary", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Walk", distance: "100 m", duration: "2 min" }]}
        strategy={WALKING_STRATEGY}
        routeSummary={{ duration: "5 min", distance: "500 m" }}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("5 min · 500 m")).toBeTruthy();
  });

  it("handles unparseable distance values gracefully in summary", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Go", distance: "NaN m", duration: "5 min" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("5 min")).toBeTruthy();
  });

  it("handles unparseable duration values gracefully in summary", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Go", distance: "100 m", duration: "soon" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("100 m")).toBeTruthy();
  });

  it("handles empty string duration in summary computation", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Go", distance: "100 m", duration: "" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    // Empty duration string returns null from parseDurationMinutes,
    // formatDuration(0) returns "", so summary is just distance.
    // "100 m" appears in both the summary and the step meta.
    expect(screen.getAllByText("100 m").length).toBeGreaterThanOrEqual(1);
  });

  it("handles distance that does not match any unit pattern", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Go", distance: "nearby", duration: "3 min" }]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    // "nearby" doesn't match the regex, parseDistanceMeters returns null
    // formatDistance(0) returns "", so summary is just duration
    expect(screen.getByText("3 min")).toBeTruthy();
  });

  it("shows no summary when all distances and durations are unparseable", () => {
    render(
      <DirectionStepsPanel
        steps={[
          { instruction: "Go somewhere", distance: "far", duration: "later" },
        ]}
        strategy={WALKING_STRATEGY}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    expect(screen.getByText("Go somewhere")).toBeTruthy();
    // The per-step meta still renders the raw values
    expect(screen.getByText("far · later")).toBeTruthy();
  });

  it("handles routeSummary with only duration", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Walk" }]}
        strategy={WALKING_STRATEGY}
        routeSummary={{ duration: "10 min" }}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("10 min")).toBeTruthy();
  });

  it("handles routeSummary with only distance", () => {
    render(
      <DirectionStepsPanel
        steps={[{ instruction: "Walk" }]}
        strategy={WALKING_STRATEGY}
        routeSummary={{ distance: "2 km" }}
        onChangeRoute={() => {}}
      />,
    );

    expect(screen.getByText("2 km")).toBeTruthy();
  });

  it("renders metro_rail vehicleType as subway icon", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Take light rail",
            transitDetails: { vehicleType: "METRO_RAIL", lineName: "Blue" },
          },
        ]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);
    expect(iconNames).toContain("subway");
  });

  it("renders train icon for COMMUTER_TRAIN vehicleType", () => {
    render(
      <DirectionStepsPanel
        steps={[
          {
            instruction: "Take commuter train",
            transitDetails: {
              vehicleType: "COMMUTER_TRAIN",
              lineName: "Exo 1",
            },
          },
        ]}
        strategy={{ mode: "transit" as const, label: "Transit", icon: "bus" }}
        onChangeRoute={() => {}}
      />,
    );

    expandStepsPanel();

    const icons = screen.getAllByTestId("mci-icon");
    const iconNames = icons.map((icon) => icon.props.children);
    expect(iconNames).toContain("train");
  });
});
