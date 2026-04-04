import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockPush,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Index = require("../app/index").default;

describe("Index screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Suppress known Icon component act() warnings from @expo/vector-icons
    jest.spyOn(console, "error").mockImplementation((...args: any[]) => {
      const message = String(args[0] || "");
      if (message.includes("An update to Icon inside a test was not wrapped")) {
        return;
      }
      // For other errors, call the original console.error
    });
  });

  it("renders title, subtitle, and all buttons", () => {
    render(<Index />);

    expect(screen.getByText("Concordia Maps")).toBeTruthy();
    expect(screen.getByText("Select a campus")).toBeTruthy();
    expect(screen.getByText("SGW Campus")).toBeTruthy();
    expect(screen.getByText("Loyola Campus")).toBeTruthy();
    expect(screen.getByText("My Schedule")).toBeTruthy();
  });

  it("navigates to SGW campus map", () => {
    render(<Index />);

    fireEvent.press(screen.getByText("SGW Campus"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/CampusMapScreen",
      params: { campus: "sgw" },
    });
  });

  it("navigates to Loyola campus map", () => {
    render(<Index />);

    fireEvent.press(screen.getByText("Loyola Campus"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/CampusMapScreen",
      params: { campus: "loyola" },
    });
  });

  it('navigates to "/schedule"', () => {
    render(<Index />);

    fireEvent.press(screen.getByText("My Schedule"));

    expect(mockPush).toHaveBeenCalledWith("/schedule");
  });

  it("opens and closes color accessibility modal from the color mode button", () => {
    render(<Index />);

    fireEvent.press(screen.getByTestId("home-color-mode-button"));
    expect(screen.getByText("Color accessibility")).toBeTruthy();

    fireEvent.press(screen.getByText("Done"));
    expect(screen.queryByText("Color accessibility")).toBeNull();
  });
});