import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { OutdoorPOIFilter } from "../components/OutdoorPOIFilter";
import { OUTDOOR_POI_CATEGORIES } from "../constants/outdoorPOI";

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
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
});
