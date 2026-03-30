import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { POIRangeSelector } from "../components/POIRangeSelector";
import { POI_RANGE_OPTIONS } from "../constants/poiRange";

describe("POIRangeSelector", () => {
  it("renders all configured range buttons", () => {
    render(
      <POIRangeSelector
        selected={POI_RANGE_OPTIONS[1]}
        onSelect={jest.fn()}
      />,
    );

    expect(screen.getByTestId("poi-range-selector")).toBeTruthy();
    expect(screen.getByText("Range:")).toBeTruthy();

    for (const option of POI_RANGE_OPTIONS) {
      expect(screen.getByTestId(`poi-range-${option.id}`)).toBeTruthy();
      expect(screen.getByText(option.label)).toBeTruthy();
    }
  });

  it("uses selected state in accessibility labels and forwards selected option", () => {
    const onSelect = jest.fn();
    render(
      <POIRangeSelector
        selected={POI_RANGE_OPTIONS[1]}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByLabelText("Set search radius to 500m")).toBeTruthy();

    fireEvent.press(screen.getByTestId("poi-range-2000"));
    expect(onSelect).toHaveBeenCalledWith({ id: "2000", label: "2 km", meters: 2000 });
  });
});
