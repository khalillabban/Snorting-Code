import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { BuildingInfoPopup } from "../components/BuildingInfoPopup";
import { Buildings } from "../constants/type";

// mock BuildingIcons so we don't test its internals here
jest.mock("../components/AccessibilityIcons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    BuildingIcons: ({ icons, size }: any) => (
      <Text testID="building-icons">
        {JSON.stringify({ icons, size })}
      </Text>
    ),
  };
});

const baseBuildingFields = {
  name: "H",
  coordinates: { latitude: 45.497, longitude: -73.579 },
  boundingBox: [
    { latitude: 45.497, longitude: -73.579 },
    { latitude: 45.498, longitude: -73.578 },
  ],
};

const fullBuilding: Buildings = {
  ...baseBuildingFields,
  displayName: "Hall Building",
  address: "1455 De Maisonneuve Blvd W",
  campusName: "sgw",
  departments: ["Computer Science", "Engineering"],
  services: ["Security", "IT Support"],
  icons: ["wheelchair", "information"],
};

const buildingNoDepts: Buildings = {
  ...baseBuildingFields,
  displayName: "Loyola Chapel",
  address: "7141 Sherbrooke St W",
  campusName: "loyola",
  services: ["Worship Services"],
  icons: [],
};

const buildingNoServices: Buildings = {
  ...baseBuildingFields,
  displayName: "EV Building",
  address: "1515 Ste-Catherine St W",
  campusName: "sgw",
  departments: ["Electrical Engineering"],
};

const buildingNoTabsNoIcons: Buildings = {
  ...baseBuildingFields,
  displayName: "Grey Nuns",
  address: "1190 Guy St",
  campusName: "sgw",
};

describe("BuildingInfoPopup", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Rendering basics ---

  it("returns null when building is null", () => {
    const { queryByText } = render(
      <BuildingInfoPopup building={null} onClose={onClose} />
    );
    expect(queryByText("Get Directions")).toBeNull();
  });

  it("renders building name, address, and campus", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);

    expect(screen.getByText("Hall Building")).toBeTruthy();
    expect(screen.getByText("1455 De Maisonneuve Blvd W")).toBeTruthy();
    expect(screen.getByText("SGW")).toBeTruthy();
  });

  it("always shows the Get Directions button", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);
    expect(screen.getByText("Get Directions")).toBeTruthy();
  });

  // --- Close button ---

  it("calls onClose when close button is pressed", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);
    fireEvent.press(screen.getByText("\u2715"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Icons ---

  it("renders BuildingIcons when icons exist", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);
    const iconsEl = screen.getByTestId("building-icons");
    expect(iconsEl).toBeTruthy();

    // verify the correct icons array is forwarded
    const passed = JSON.parse(iconsEl.children[0] as string);
    expect(passed.icons).toEqual(["wheelchair", "information"]);
  });

  it("does not render BuildingIcons when icons array is empty", () => {
    render(<BuildingInfoPopup building={buildingNoDepts} onClose={onClose} />);
    expect(screen.queryByTestId("building-icons")).toBeNull();
  });

  it("does not render BuildingIcons when icons is undefined", () => {
    render(
      <BuildingInfoPopup building={buildingNoTabsNoIcons} onClose={onClose} />
    );
    expect(screen.queryByTestId("building-icons")).toBeNull();
  });

  // --- Tabs: visibility ---

  it("renders both tabs when departments and services exist", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);
    expect(screen.getByText("Departments")).toBeTruthy();
    expect(screen.getByText("Services")).toBeTruthy();
  });

  it("renders only Services tab when building has no departments", () => {
    render(<BuildingInfoPopup building={buildingNoDepts} onClose={onClose} />);
    expect(screen.queryByText("Departments")).toBeNull();
    expect(screen.getByText("Services")).toBeTruthy();
  });

  it("renders only Departments tab when building has no services", () => {
    render(<BuildingInfoPopup building={buildingNoServices} onClose={onClose} />);
    expect(screen.getByText("Departments")).toBeTruthy();
    expect(screen.queryByText("Services")).toBeNull();
  });

  it("renders no tabs when building has neither departments nor services", () => {
    render(
      <BuildingInfoPopup building={buildingNoTabsNoIcons} onClose={onClose} />
    );
    expect(screen.queryByText("Departments")).toBeNull();
    expect(screen.queryByText("Services")).toBeNull();
  });

  // --- Tabs: content toggling ---

  it("shows department list when Departments tab is pressed", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);
    fireEvent.press(screen.getByText("Departments"));

    expect(screen.getByText("Computer Science")).toBeTruthy();
    expect(screen.getByText("Engineering")).toBeTruthy();
  });

  it("shows services list when Services tab is pressed", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);
    fireEvent.press(screen.getByText("Services"));

    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.getByText("IT Support")).toBeTruthy();
  });

  it("toggles tab off when the same tab is pressed again", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);

    fireEvent.press(screen.getByText("Departments"));
    expect(screen.getByText("Computer Science")).toBeTruthy();

    fireEvent.press(screen.getByText("Departments"));
    expect(screen.queryByText("Computer Science")).toBeNull();
  });

  it("switches from Departments to Services tab", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);

    fireEvent.press(screen.getByText("Departments"));
    expect(screen.getByText("Computer Science")).toBeTruthy();

    fireEvent.press(screen.getByText("Services"));
    expect(screen.getByText("Security")).toBeTruthy();
    expect(screen.queryByText("Computer Science")).toBeNull();
  });

  it("switches from Services to Departments tab", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);

    fireEvent.press(screen.getByText("Services"));
    expect(screen.getByText("IT Support")).toBeTruthy();

    fireEvent.press(screen.getByText("Departments"));
    expect(screen.getByText("Engineering")).toBeTruthy();
    expect(screen.queryByText("IT Support")).toBeNull();
  });

  // --- Tab content not visible before interaction ---

  it("does not show department or service items before a tab is pressed", () => {
    render(<BuildingInfoPopup building={fullBuilding} onClose={onClose} />);

    expect(screen.queryByText("Computer Science")).toBeNull();
    expect(screen.queryByText("Security")).toBeNull();
  });

  // --- Campus name is uppercased ---

  it("displays campus name in uppercase", () => {
    render(<BuildingInfoPopup building={buildingNoDepts} onClose={onClose} />);
    expect(screen.getByText("LOYOLA")).toBeTruthy();
  });

  // --- Building change resets active tab ---

  it("resets the active tab when building prop changes", () => {
    const { rerender } = render(
      <BuildingInfoPopup building={fullBuilding} onClose={onClose} />
    );

    // open departments
    fireEvent.press(screen.getByText("Departments"));
    expect(screen.getByText("Computer Science")).toBeTruthy();

    // switch to a different building
    rerender(
      <BuildingInfoPopup building={buildingNoServices} onClose={onClose} />
    );

    // the tab content should be gone - activeTab reset to null
    expect(screen.queryByText("Computer Science")).toBeNull();
    // the new building's departments are not auto-expanded
    expect(screen.queryByText("Electrical Engineering")).toBeNull();
  });
});
