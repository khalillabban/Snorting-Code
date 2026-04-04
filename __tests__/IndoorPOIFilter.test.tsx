import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { IndoorPOIFilter } from "../components/IndoorPOIFilter";
import { POI_CATEGORIES, type POICategoryId } from "../constants/indoorPOI";
import * as ColorAccessibilityContext from "../contexts/ColorAccessibilityContext";

jest.mock("@expo/vector-icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require("react");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require("react-native");
  const MockIcon = (props: any) => <Text>{props?.name ?? "icon"}</Text>;
  return {
    __esModule: true,
    MaterialCommunityIcons: MockIcon,
  };
});

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
      // Labels removed — chips are icon-only; verify via accessibilityLabel instead
      expect(screen.getByLabelText(`Show ${cat.label}`)).toBeTruthy();
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

  it("fires onFirstInteraction only once", () => {
    const onFirstInteraction = jest.fn();
    render(
      <IndoorPOIFilter
        activeCategories={new Set()}
        onToggle={mockToggle}
        onFirstInteraction={onFirstInteraction}
      />,
    );

    fireEvent.press(screen.getByTestId("poi-filter-chip-washroom"));
    fireEvent.press(screen.getByTestId("poi-filter-chip-stairs"));

    expect(onFirstInteraction).toHaveBeenCalledTimes(1);
  });

  it("applies mapped accessible colors in non-classic mode for active chips", () => {
    const spy = jest
      .spyOn(ColorAccessibilityContext, "useColorAccessibility")
      .mockReturnValue({
        mode: "redGreenSafe",
        isHydrated: true,
        options: [],
        setMode: jest.fn(),
        colors: {
          white: "#fff",
          gray300: "#b3b3b3",
          primary: "#111111",
          route2: "#222222",
          info: "#333333",
          routeShuttle: "#444444",
          routeTransit: "#555555",
          warning: "#666666",
        } as any,
      } as any);

    render(
      <IndoorPOIFilter
        activeCategories={new Set<POICategoryId>(["washroom"])}
        onToggle={mockToggle}
      />,
    );

    const washroomChip = screen.getByTestId("poi-filter-chip-washroom");
    const flattened = Array.isArray(washroomChip.props.style)
      ? Object.assign({}, ...washroomChip.props.style.filter(Boolean))
      : washroomChip.props.style;
    expect(flattened.backgroundColor).toBe("#222222");

    spy.mockRestore();
  });

  it("falls back to primary color for unknown category colors in non-classic mode", () => {
    const target = POI_CATEGORIES.find((cat) => cat.id === "washroom");
    expect(target).toBeTruthy();
    const originalColor = target!.color;
    (target as any).color = "#abcdef";

    const spy = jest
      .spyOn(ColorAccessibilityContext, "useColorAccessibility")
      .mockReturnValue({
        mode: "redGreenSafe",
        isHydrated: true,
        options: [],
        setMode: jest.fn(),
        colors: {
          white: "#fff",
          gray300: "#b3b3b3",
          primary: "#101010",
          route2: "#222222",
          info: "#333333",
          routeShuttle: "#444444",
          routeTransit: "#555555",
          warning: "#666666",
        } as any,
      } as any);

    render(
      <IndoorPOIFilter
        activeCategories={new Set<POICategoryId>(["washroom"])}
        onToggle={mockToggle}
      />,
    );

    const chip = screen.getByTestId("poi-filter-chip-washroom");
    const flattened = Array.isArray(chip.props.style)
      ? Object.assign({}, ...chip.props.style.filter(Boolean))
      : chip.props.style;
    expect(flattened.backgroundColor).toBe("#101010");

    (target as any).color = originalColor;
    spy.mockRestore();
  });
});
