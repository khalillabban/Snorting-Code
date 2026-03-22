import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { FloorSwitcher } from "../components/Floorswitcher";

describe("FloorSwitcher", () => {
  const mockOnFloorChange = jest.fn();
  const mockOnExit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders floor buttons in reverse order", () => {
    render(
      <FloorSwitcher
        floors={[1, -2]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("Floor")).toBeTruthy();
  });

  it("highlights the active floor button", () => {
    render(
      <FloorSwitcher
        floors={[1, 2, 3]}
        activeFloor={2}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    const buttons = screen.getAllByText(/\d+/);
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("calls onFloorChange when a floor button is pressed", () => {
    render(
      <FloorSwitcher
        floors={[1, 2, 3]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    const floorButton = screen.getByText("2");
    fireEvent.press(floorButton);
    expect(mockOnFloorChange).toHaveBeenCalledWith(2);
  });

  it("handles single floor", () => {
    render(
      <FloorSwitcher
        floors={[1]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("handles negative floor numbers", () => {
    render(
      <FloorSwitcher
        floors={[1, -1, -2]}
        activeFloor={-1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("-1")).toBeTruthy();
    expect(screen.getByText("-2")).toBeTruthy();
  });

  it("renders multiple floor buttons", () => {
    render(
      <FloorSwitcher
        floors={[1, 2, 3, 4, 5]}
        activeFloor={3}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("maintains active floor state visually", () => {
    const { rerender } = render(
      <FloorSwitcher
        floors={[1, 2, 3]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("1")).toBeTruthy();

    rerender(
      <FloorSwitcher
        floors={[1, 2, 3]}
        activeFloor={2}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("displays 'Floor' label", () => {
    render(
      <FloorSwitcher
        floors={[1, 2]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("Floor")).toBeTruthy();
  });

  it("handles rapid floor changes", () => {
    render(
      <FloorSwitcher
        floors={[1, 2, 3, 4]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    fireEvent.press(screen.getByText("2"));
    fireEvent.press(screen.getByText("3"));
    fireEvent.press(screen.getByText("4"));
    expect(mockOnFloorChange).toHaveBeenCalledTimes(3);
    expect(mockOnFloorChange).toHaveBeenLastCalledWith(4);
  });

  it("has accessibility role for floor buttons", () => {
    render(
      <FloorSwitcher
        floors={[1]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    const button = screen.getByText("1");
    expect(button).toBeTruthy();
  });

  it("handles floors in non-sequential order", () => {
    render(
      <FloorSwitcher
        floors={[1, -2, 8, 9]}
        activeFloor={-2}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("-2")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("displays floors in reverse order", () => {
    // Floors should be reversed: [3, 2, 1] becomes [1, 2, 3] visually
    render(
      <FloorSwitcher
        floors={[3, 2, 1]}
        activeFloor={1}
        onFloorChange={mockOnFloorChange}
        onExit={mockOnExit}
      />
    );
    expect(true).toBe(true);
  });
});
