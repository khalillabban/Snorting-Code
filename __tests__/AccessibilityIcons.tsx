import { render, screen } from "@testing-library/react-native";
import React from "react";
import { BuildingIcons } from "../components/AccessibilityIcons";

// mock Image so we can inspect render count safely
jest.mock("react-native/Libraries/Image/Image", () => {
  const React = require("react");
  const { View } = require("react-native");
  return (props: any) => <View testID="icon-image" {...props} />;
});

describe("BuildingIcons", () => {
  it("returns null when icons array is empty", () => {
    const { queryByTestId } = render(<BuildingIcons icons={[]} />);

    expect(queryByTestId("icon-image")).toBeNull();
  });

  it("renders icons in the defined order regardless of input order", () => {
    render(
      <BuildingIcons
        icons={["wheelchair", "information", "bike"]}
      />
    );

    const icons = screen.getAllByTestId("icon-image");

    // order should follow ICON_ORDER:
    // information → bike → wheelchair
    expect(icons).toHaveLength(3);

    // source prop reflects order
    expect(icons[0].props.source).toBeDefined();
    expect(icons[1].props.source).toBeDefined();
    expect(icons[2].props.source).toBeDefined();
  });

  it("renders only icons that exist in ICON_ORDER", () => {
    render(
      <BuildingIcons
        icons={["printer", "parking"]}
      />
    );

    const icons = screen.getAllByTestId("icon-image");
    expect(icons).toHaveLength(2);
  });

  it("applies default icon size when size prop is not provided", () => {
    render(<BuildingIcons icons={["information"]} />);

    const icon = screen.getByTestId("icon-image");
    expect(icon.props.style.width).toBe(24);
    expect(icon.props.style.height).toBe(24);
  });

  it("applies custom icon size when size prop is provided", () => {
    render(<BuildingIcons icons={["information"]} size={32} />);

    const icon = screen.getByTestId("icon-image");
    expect(icon.props.style.width).toBe(32);
    expect(icon.props.style.height).toBe(32);
  });
});
