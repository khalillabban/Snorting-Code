import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { BuildingInfoPopup } from "../components/BuildingInfoPopup";

// mock BuildingIcons so we don’t test its internals
jest.mock("../components/AccessibilityIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    BuildingIcons: ({ icons }: any) => (
      <Text testID="building-icons">{JSON.stringify(icons)}</Text>
    ),
  };
});

const mockBuilding = {
  displayName: "Hall Building",
  address: "1455 De Maisonneuve Blvd W",
  campusName: "sgw",
  departments: ["Computer Science", "Engineering"],
  services: ["Security", "IT Support"],
  icons: ["wheelchair", "elevator"],
};

describe("BuildingInfoPopup", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when building is null", () => {
    const { queryByText } = render(
      <BuildingInfoPopup building={null} onClose={onClose} />
    );

    expect(queryByText("Get Directions")).toBeNull();
  });

  it("renders building basic information", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    expect(screen.getByText("Hall Building")).toBeTruthy();
    expect(screen.getByText("1455 De Maisonneuve Blvd W")).toBeTruthy();
    expect(screen.getByText("SGW")).toBeTruthy();
  });

  it("renders tabs when departments and services exist", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    expect(screen.getByText("Departments")).toBeTruthy();
    expect(screen.getByText("Services")).toBeTruthy();
  });

  it("shows department list when Departments tab is pressed", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    fireEvent.press(screen.getByText("Departments"));

    expect(screen.getByText("Computer Science")).toBeTruthy();
    expect(screen.getByText("Engineering")).toBeTruthy();
  });

  it("toggles tab off when the same tab is pressed again", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    fireEvent.press(screen.getByText("Departments"));
    fireEvent.press(screen.getByText("Departments"));

    expect(screen.queryByText("Computer Science")).toBeNull();
  });

  it("switches between Departments and Services tabs", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    fireEvent.press(screen.getByText("Departments"));
    expect(screen.getByText("Computer Science")).toBeTruthy();

    fireEvent.press(screen.getByText("Services"));
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.queryByText("Computer Science")).toBeNull();
  });

  it("calls onClose when close button is pressed", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    fireEvent.press(screen.getByText("✕"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders building icons when icons exist", () => {
    render(<BuildingInfoPopup building={mockBuilding as any} onClose={onClose} />);

    expect(screen.getByTestId("building-icons")).toBeTruthy();
  });
});
