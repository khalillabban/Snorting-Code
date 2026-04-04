import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { ColorAccessibilityProvider } from "../contexts/ColorAccessibilityContext";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockPush,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Index = require("../app/index").default;

function renderIndex() {
  return render(
    <ColorAccessibilityProvider>
      <Index />
    </ColorAccessibilityProvider>,
  );
}

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
    renderIndex();

    expect(screen.getByText("Concordia Maps")).toBeTruthy();
    expect(screen.getByText("Select a campus")).toBeTruthy();
    expect(screen.getByText("SGW Campus")).toBeTruthy();
    expect(screen.getByText("Loyola Campus")).toBeTruthy();
    expect(screen.getByText("My Schedule")).toBeTruthy();
  });

  it("navigates to SGW campus map", () => {
    renderIndex();

    fireEvent.press(screen.getByText("SGW Campus"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/CampusMapScreen",
      params: { campus: "sgw" },
    });
  });

  it("navigates to Loyola campus map", () => {
    renderIndex();

    fireEvent.press(screen.getByText("Loyola Campus"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/CampusMapScreen",
      params: { campus: "loyola" },
    });
  });

  it('navigates to "/schedule"', () => {
    renderIndex();

    fireEvent.press(screen.getByText("My Schedule"));

    expect(mockPush).toHaveBeenCalledWith("/schedule");
  });

  it("opens and closes color accessibility modal from the color mode button", () => {
    renderIndex();

    fireEvent.press(screen.getByTestId("home-color-mode-button"));
    expect(screen.getByText("Color accessibility")).toBeTruthy();

    fireEvent.press(screen.getByText("Done"));
    expect(screen.queryByText("Color accessibility")).toBeNull();
  });

  it("updates home color mode label when selecting Red-Green Safe", async () => {
    renderIndex();

    fireEvent.press(screen.getByTestId("home-color-mode-button"));
    fireEvent.press(screen.getByLabelText("Red-Green Safe"));
    fireEvent.press(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Color mode: Red-Green Safe")).toBeTruthy();
    });
  });

  it("updates home color mode label when selecting High Contrast", async () => {
    renderIndex();

    fireEvent.press(screen.getByTestId("home-color-mode-button"));
    fireEvent.press(screen.getByLabelText("High Contrast"));
    fireEvent.press(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Color mode: High Contrast")).toBeTruthy();
    });
  });

  it("updates home color mode label when selecting Blue-Yellow Safe", async () => {
    renderIndex();

    fireEvent.press(screen.getByTestId("home-color-mode-button"));
    fireEvent.press(screen.getByLabelText("Blue-Yellow Safe"));
    fireEvent.press(screen.getByText("Done"));

    await waitFor(() => {
      expect(screen.getByText("Color mode: Blue-Yellow Safe")).toBeTruthy();
    });
  });
});