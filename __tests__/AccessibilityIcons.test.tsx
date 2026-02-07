import { render, screen } from "@testing-library/react-native";
import React from "react";
import { BuildingIcons } from "../components/AccessibilityIcons";

describe("BuildingIcons", () => {
  it("returns null when icons array is empty", () => {
    const { queryByTestId } = render(<BuildingIcons icons={[]} />);
    expect(queryByTestId("building-icons-row")).toBeNull();
  });

  it("renders the correct number of icons", () => {
    render(<BuildingIcons icons={["information", "wheelchair"]} />);

    expect(screen.getByTestId("building-icon-information")).toBeTruthy();
    expect(screen.getByTestId("building-icon-wheelchair")).toBeTruthy();
  });

  it("respects predefined icon order instead of input order", () => {
    render(<BuildingIcons icons={["wheelchair", "information", "bike"]} />);

    const row = screen.getByTestId("building-icons-row");
    const children = row.children;

    // ICON_ORDER is: information, printer, bike, parking, wheelchair
    // So rendered order should be: information, bike, wheelchair
    expect(children).toHaveLength(3);

    const icons = screen.getAllByTestId(/^building-icon-/);
    expect(icons[0].props.testID).toBe("building-icon-information");
    expect(icons[1].props.testID).toBe("building-icon-bike");
    expect(icons[2].props.testID).toBe("building-icon-wheelchair");
  });

  it("filters out icons not in ICON_ORDER", () => {
    // Only valid icons should render; any unknown value is ignored
    render(<BuildingIcons icons={["information", "parking"]} />);

    expect(screen.getByTestId("building-icon-information")).toBeTruthy();
    expect(screen.getByTestId("building-icon-parking")).toBeTruthy();
    expect(screen.queryByTestId("building-icon-wheelchair")).toBeNull();
  });

  it("uses default size (24) when size prop is not provided", () => {
    render(<BuildingIcons icons={["information"]} />);

    const icon = screen.getByTestId("building-icon-information");
    expect(icon.props.style.width).toBe(24);
    expect(icon.props.style.height).toBe(24);
  });

  it("uses custom size when size prop is provided", () => {
    render(<BuildingIcons icons={["information"]} size={32} />);

    const icon = screen.getByTestId("building-icon-information");
    expect(icon.props.style.width).toBe(32);
    expect(icon.props.style.height).toBe(32);
  });

  it("renders all five icon types when all are provided", () => {
    render(
      <BuildingIcons
        icons={["information", "printer", "bike", "parking", "wheelchair"]}
      />
    );

    expect(screen.getByTestId("building-icon-information")).toBeTruthy();
    expect(screen.getByTestId("building-icon-printer")).toBeTruthy();
    expect(screen.getByTestId("building-icon-bike")).toBeTruthy();
    expect(screen.getByTestId("building-icon-parking")).toBeTruthy();
    expect(screen.getByTestId("building-icon-wheelchair")).toBeTruthy();
  });
});