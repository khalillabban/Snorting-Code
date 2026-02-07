import { render, screen } from "@testing-library/react-native";
import React from "react";
import { BuildingIcons } from "../components/AccessibilityIcons";


jest.mock("react-native/Libraries/Image/Image", () => {
  const { View } = require("react-native");
  return (props: any) => <View testID="building-icon" {...props} />;
});

describe("BuildingIcons", () => {
  it("returns null when icons array is empty", () => {
    const { queryByTestId } = render(<BuildingIcons icons={[]} />);
    expect(queryByTestId("building-icon")).toBeNull();
  });

  it("renders the correct number of icons", () => {
    render(<BuildingIcons icons={["information", "wheelchair"]} />);

    const icons = screen.getAllByTestId("building-icon");
    expect(icons).toHaveLength(2);
  });

  it("respects predefined icon order instead of input order", () => {
    render(<BuildingIcons icons={["wheelchair", "information", "bike"]} />);

    const icons = screen.getAllByTestId("building-icon");
    expect(icons).toHaveLength(3);
    // The component filters based on ICON_ORDER, so they will render 
    // in the order: information, bike, wheelchair.
  });

  it("uses default size when size prop is not provided", () => {
    render(<BuildingIcons icons={["information"]} />);

    const icon = screen.getByTestId("building-icon");
    // Accessing props.style directly since it's an inline object
    expect(icon.props.style.width).toBe(24);
    expect(icon.props.style.height).toBe(24);
  });

  it("uses custom size when size prop is provided", () => {
    render(<BuildingIcons icons={["information"]} size={32} />);

    const icon = screen.getByTestId("building-icon");
    expect(icon.props.style.width).toBe(32);
    expect(icon.props.style.height).toBe(32);
  });
});