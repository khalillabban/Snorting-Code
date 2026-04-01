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
});