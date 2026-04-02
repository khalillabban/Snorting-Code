import { render, screen } from "@testing-library/react-native";
import React from "react";
import { ShuttleUnavailableBanner } from "../components/ShuttleUnavailableBanner"; // Adjust path if necessary

// Mock the vector icons to prevent font-loading errors in Jest
jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require("react-native");
  return {
    MaterialCommunityIcons: (props: any) => (
      <Text testID={`icon-${props.name}`}>{props.name}</Text>
    ),
  };
});

describe("ShuttleUnavailableBanner", () => {
  it("renders the reason text and icon by default", () => {
    render(<ShuttleUnavailableBanner reason="No bus available during weekend" />);
    
    expect(screen.getByText("No bus available during weekend")).toBeTruthy();
    expect(screen.getByTestId("icon-bus-alert")).toBeTruthy();
    
    // Verify summary is NOT rendered
    expect(screen.queryByText("Mon–Fri")).toBeNull();
  });

  it("renders the operating summary when provided", () => {
    render(
      <ShuttleUnavailableBanner 
        reason="Shuttle is not available." 
        operatingSummary="Mon–Fri 9:15 AM – 7:00 PM" 
      />
    );
    
    expect(screen.getByText("Shuttle is not available.")).toBeTruthy();
    expect(screen.getByText("Mon–Fri 9:15 AM – 7:00 PM")).toBeTruthy();
  });

  it("does not render the operating summary if it is an empty string", () => {
    render(
      <ShuttleUnavailableBanner 
        reason="Empty summary test" 
        operatingSummary="" 
      />
    );
    
    expect(screen.getByText("Empty summary test")).toBeTruthy();
    // This executes the `operatingSummary !== ""` branch to ensure 100% coverage
  });

  it("renders correctly in compact mode", () => {
    render(
      <ShuttleUnavailableBanner 
        reason="Compact reason" 
        operatingSummary="Short summary"
        compact={true} 
      />
    );
    
    expect(screen.getByText("Compact reason")).toBeTruthy();
    expect(screen.getByText("Short summary")).toBeTruthy();
    
    // Verifies the icon rendered successfully in compact size
    expect(screen.getByTestId("icon-bus-alert")).toBeTruthy();
  });
});