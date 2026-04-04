import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { OutdoorPOIFilter } from "../components/OutdoorPOIFilter";
import { OUTDOOR_POI_CATEGORIES } from "../constants/outdoorPOI";
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

describe("OutdoorPOIFilter", () => {
  it("renders one toggle chip for each configured outdoor category", () => {
    render(
      <OutdoorPOIFilter
        activeCategories={new Set()}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByTestId("outdoor-poi-filter-bar")).toBeTruthy();
    for (const category of OUTDOOR_POI_CATEGORIES) {
      expect(screen.getByTestId(`outdoor-poi-chip-${category.id}`)).toBeTruthy();
      expect(screen.getByText(category.label)).toBeTruthy();
    }
  });

  it("reflects active categories in accessibility labels", () => {
    render(
      <OutdoorPOIFilter
        activeCategories={new Set(["coffee", "restaurant"])}
        onToggle={jest.fn()}
      />,
    );

    expect(screen.getByLabelText("Hide Coffee")).toBeTruthy();
    expect(screen.getByLabelText("Hide Food")).toBeTruthy();
    expect(screen.getByLabelText("Show Library")).toBeTruthy();
  });

  it("calls onToggle with the selected category id", () => {
    const onToggle = jest.fn();
    render(
      <OutdoorPOIFilter
        activeCategories={new Set()}
        onToggle={onToggle}
      />,
    );

    fireEvent.press(screen.getByTestId("outdoor-poi-chip-pharmacy"));
    expect(onToggle).toHaveBeenCalledWith("pharmacy");
  });

  it("uses mapped accessible colors for active chips in non-classic mode", () => {
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
          accent1: "#111122",
          route1: "#111133",
          route2: "#111144",
          route3: "#111155",
          route4: "#111166",
          accent2: "#111177",
        } as any,
      } as any);

    render(
      <OutdoorPOIFilter
        activeCategories={new Set(["restaurant"])}
        onToggle={jest.fn()}
      />,
    );

    const foodChip = screen.getByTestId("outdoor-poi-chip-restaurant");
    const flattened = Array.isArray(foodChip.props.style)
      ? Object.assign({}, ...foodChip.props.style.filter(Boolean))
      : foodChip.props.style;
    expect(flattened.backgroundColor).toBe("#111122");

    spy.mockRestore();
  });

  it("uses original category color in classic mode", () => {
    const spy = jest
      .spyOn(ColorAccessibilityContext, "useColorAccessibility")
      .mockReturnValue({
        mode: "classic",
        isHydrated: true,
        options: [],
        setMode: jest.fn(),
        colors: {
          white: "#fff",
          gray300: "#b3b3b3",
          primary: "#abcabc",
          accent1: "#1",
          route1: "#2",
          route2: "#3",
          route3: "#4",
          route4: "#5",
          accent2: "#6",
        } as any,
      } as any);

    render(
      <OutdoorPOIFilter
        activeCategories={new Set(["coffee"])}
        onToggle={jest.fn()}
      />,
    );

    const coffeeChip = screen.getByTestId("outdoor-poi-chip-coffee");
    const flattened = Array.isArray(coffeeChip.props.style)
      ? Object.assign({}, ...coffeeChip.props.style.filter(Boolean))
      : coffeeChip.props.style;
    expect(flattened.backgroundColor).toBe("#6d4c41");

    spy.mockRestore();
  });

  it("falls back to primary color for unknown category colors in non-classic mode", () => {
    const target = OUTDOOR_POI_CATEGORIES.find((cat) => cat.id === "coffee");
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
          primary: "#777777",
          accent1: "#1",
          route1: "#2",
          route2: "#3",
          route3: "#4",
          route4: "#5",
          accent2: "#6",
        } as any,
      } as any);

    render(
      <OutdoorPOIFilter
        activeCategories={new Set(["coffee"])}
        onToggle={jest.fn()}
      />,
    );

    const coffeeChip = screen.getByTestId("outdoor-poi-chip-coffee");
    const flattened = Array.isArray(coffeeChip.props.style)
      ? Object.assign({}, ...coffeeChip.props.style.filter(Boolean))
      : coffeeChip.props.style;
    expect(flattened.backgroundColor).toBe("#777777");

    (target as any).color = originalColor;
    spy.mockRestore();
  });
});
