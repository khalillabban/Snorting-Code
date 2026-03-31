import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import NavigationBar from "../components/NavigationBar";

jest.mock("@expo/vector-icons", () => ({
  MaterialIcons: "MaterialIcons",
  MaterialCommunityIcons: "MaterialCommunityIcons",
}));

jest.mock("../services/GoogleDirectionsService", () => ({
  getOutdoorRouteWithSteps: jest.fn().mockResolvedValue({
    duration: "8 mins",
    distance: "500 m",
    coordinates: [],
    steps: [],
    segments: [],
  }),
}));

jest.mock("../constants/buildings", () => ({
  BUILDINGS: [
    {
      name: "H",
      campusName: "sgw",
      displayName: "Hall Building (H)",
      address: "1455 De Maisonneuve",
      coordinates: { latitude: 45.497, longitude: -73.579 },
      boundingBox: [
        { latitude: 45.496, longitude: -73.58 },
        { latitude: 45.497, longitude: -73.579 },
        { latitude: 45.498, longitude: -73.578 },
      ],
    },
  ],
}));

jest.mock("../utils/indoorAccess", () => ({
  getIndoorAccessState: jest.fn().mockReturnValue({
    buildingCode: "H",
    floors: [1, 2],
    hasIndoorMap: true,
    hasSearchableRooms: true,
  }),
}));

jest.mock("../utils/indoorBuildingPlan", () => ({
  getNormalizedBuildingPlan: jest.fn().mockReturnValue({
    rooms: [
      {
        id: "room-110",
        buildingCode: "H",
        floor: 1,
        label: "H-110",
        roomNumber: "110",
        roomName: "Computer Lab",
        aliases: [],
        x: 100,
        y: 100,
        accessible: true,
        searchTerms: ["H-110", "110", "Computer Lab"],
        searchKeys: ["H110", "110", "COMPUTERLAB"],
      },
      {
        id: "room-220",
        buildingCode: "H",
        floor: 2,
        label: "H-220",
        roomNumber: "220",
        roomName: "Lecture Hall",
        aliases: [],
        x: 120,
        y: 120,
        accessible: true,
        searchTerms: ["H-220", "220", "Lecture Hall"],
        searchKeys: ["H220", "220", "LECTUREHALL"],
      },
    ],
  }),
}));

describe("NavigationBar coverage branches", () => {
  it("renders room suggestion subtitle and applies start/end room badges", async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <NavigationBar
        visible={true}
        onClose={onClose}
        onConfirm={onConfirm}
        currentCampus="sgw"
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("From — building or room (e.g. H-110)"),
      "H-110",
    );

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-room-110")).toBeTruthy();
      expect(screen.getByText("H-110 — Computer Lab")).toBeTruthy();
      expect(screen.getByText("Hall Building (H) · Floor 1")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("suggestion-room-H-110"));

    await waitFor(() => {
      expect(screen.getByText("Room H-110")).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText("To — building or room (e.g. MB-1.210)"),
      "H-220",
    );

    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-room-220")).toBeTruthy();
      expect(screen.getByText("H-220 — Lecture Hall")).toBeTruthy();
      expect(screen.getByText("Hall Building (H) · Floor 2")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("suggestion-room-H-220"));

    await waitFor(() => {
      expect(screen.getByText("Room H-220")).toBeTruthy();
      expect(screen.getByTestId("get-directions-button")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("get-directions-button"));

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ name: "H" }),
      expect.objectContaining({ name: "H" }),
      expect.objectContaining({ mode: "walking" }),
      expect.objectContaining({ label: "H-110" }),
      expect.objectContaining({ label: "H-220" }),
      false,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 15000);

  it("re-queries suggestions on focus when start/dest already have values", async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <NavigationBar
        visible={true}
        onClose={onClose}
        onConfirm={onConfirm}
        currentCampus="sgw"
      />,
    );

    fireEvent.changeText(
      screen.getByPlaceholderText("From — building or room (e.g. H-110)"),
      "H-110",
    );
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-room-110")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("suggestion-room-H-110"));

    fireEvent.changeText(
      screen.getByPlaceholderText("To — building or room (e.g. MB-1.210)"),
      "H-220",
    );
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-room-220")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("suggestion-room-H-220"));

    fireEvent(screen.getByTestId("start-location-input"), "focus");
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-H-110")).toBeTruthy();
    });

    fireEvent(screen.getByTestId("dest-location-input"), "focus");
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-H-220")).toBeTruthy();
    });
  });

  it("clears start/end room badges and renders campus subtitle for building suggestions", async () => {
    const onClose = jest.fn();
    const onConfirm = jest.fn();

    render(
      <NavigationBar
        visible={true}
        onClose={onClose}
        onConfirm={onConfirm}
        currentCampus="sgw"
      />,
    );

    fireEvent.press(screen.getAllByLabelText("Pick from list")[0]);
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-H")).toBeTruthy();
      expect(screen.getByText("sgw")).toBeTruthy();
    });

    fireEvent.changeText(
      screen.getByPlaceholderText("From — building or room (e.g. H-110)"),
      "H-110",
    );
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-room-110")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("suggestion-room-H-110"));

    fireEvent.changeText(
      screen.getByPlaceholderText("To — building or room (e.g. MB-1.210)"),
      "H-220",
    );
    await waitFor(() => {
      expect(screen.getByTestId("suggestion-room-H-220")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("suggestion-room-H-220"));

    await waitFor(() => {
      expect(screen.getByText("Room H-110")).toBeTruthy();
      expect(screen.getByText("Room H-220")).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId("clear-start-room"));
    fireEvent.press(screen.getByTestId("clear-end-room"));

    await waitFor(() => {
      expect(screen.queryByText("Room H-110")).toBeNull();
      expect(screen.queryByText("Room H-220")).toBeNull();
    });
  });
});
