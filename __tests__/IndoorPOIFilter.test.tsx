import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { IndoorPOIFilter } from "../components/IndoorPOIFilter";
import { POI_CATEGORIES, type POICategoryId } from "../constants/indoorPOI";

describe("IndoorPOIFilter", () => {
  const mockToggle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all POI category chips", () => {
    render(
      <IndoorPOIFilter activeCategories={new Set()} onToggle={mockToggle} />,
    );

    for (const cat of POI_CATEGORIES) {
      expect(screen.getByTestId(`poi-filter-chip-${cat.id}`)).toBeTruthy();
      expect(screen.getByText(cat.label)).toBeTruthy();
    }
  });

  it("renders the filter bar container", () => {
    render(
      <IndoorPOIFilter activeCategories={new Set()} onToggle={mockToggle} />,
    );
    expect(screen.getByTestId("poi-filter-bar")).toBeTruthy();
  });

  it("calls onToggle with category id when a chip is pressed", () => {
    render(
      <IndoorPOIFilter activeCategories={new Set()} onToggle={mockToggle} />,
    );

    fireEvent.press(screen.getByTestId("poi-filter-chip-washroom"));
    expect(mockToggle).toHaveBeenCalledWith("washroom");

    fireEvent.press(screen.getByTestId("poi-filter-chip-stairs"));
    expect(mockToggle).toHaveBeenCalledWith("stairs");
  });

  it("marks active chips with selected accessibility state", () => {
    const active = new Set<POICategoryId>(["stairs", "elevator"]);
    render(
      <IndoorPOIFilter activeCategories={active} onToggle={mockToggle} />,
    );

    const stairsChip = screen.getByTestId("poi-filter-chip-stairs");
    expect(stairsChip.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );

    const washroomChip = screen.getByTestId("poi-filter-chip-washroom");
    expect(washroomChip.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  it("has appropriate accessibility labels", () => {
    const active = new Set<POICategoryId>(["washroom"]);
    render(
      <IndoorPOIFilter activeCategories={active} onToggle={mockToggle} />,
    );

    const washroomChip = screen.getByTestId("poi-filter-chip-washroom");
    expect(washroomChip.props.accessibilityLabel).toBe("Hide Washrooms");

    const stairsChip = screen.getByTestId("poi-filter-chip-stairs");
    expect(stairsChip.props.accessibilityLabel).toBe("Show Stairs");
  });
});
