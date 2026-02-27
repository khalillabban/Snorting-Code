import React from "react";
import { render, fireEvent, act, cleanup } from "@testing-library/react-native";
import { ShuttleSchedulePanel } from "../components/ShuttleSchedulePanel";

// 1. Mutable data source for the mock
let mockShuttleData = {
  schedule: {
    weekend: { info: "No shuttles on weekends." },
    weekday: {
      SGW_to_Loyola: [
        { departureTime: "00:05", arrivalTime: "00:25" },
        { departureTime: "12:00", arrivalTime: "12:20" },
        { departureTime: "13:07", arrivalTime: "13:27" },
        { departureTime: "23:50", arrivalTime: "00:10" },
      ],
      Loyola_to_SGW: [
        { departureTime: "09:15", arrivalTime: "09:35" },
      ],
    },
  },
};

// --- Mocks ---

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));

jest.mock("../constants/theme", () => ({
  colors: {
    primary: "#0a0",
    primaryDark: "#070",
    primaryTransparent: "rgba(0,255,0,0.1)",
    primaryBarelyTransparent: "rgba(0,255,0,0.05)",
    white: "#fff",
    gray100: "#eee",
    gray500: "#999",
    gray700: "#555",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  typography: { heading: { fontSize: 20, fontWeight: "700" }, body: { fontSize: 14 } },
}));

const mockGetScheduleKeyForDate = jest.fn();
jest.mock("../utils/shuttleAvailability", () => ({
  getScheduleKeyForDate: (d: Date) => mockGetScheduleKeyForDate(d),
}));

// Use a getter so the component always sees the latest state of mockShuttleData
jest.mock("../constants/shuttle", () => ({
  get shuttleSchedule() {
    return mockShuttleData;
  },
}));

describe("ShuttleSchedulePanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Default mock behavior
    mockGetScheduleKeyForDate.mockReturnValue("weekday");

    // Reset data to original state
    mockShuttleData.schedule.weekday.SGW_to_Loyola = [
      { departureTime: "00:05", arrivalTime: "00:25" },
      { departureTime: "12:00", arrivalTime: "12:20" },
      { departureTime: "13:07", arrivalTime: "13:27" },
      { departureTime: "23:50", arrivalTime: "00:10" },
    ];
  });

  afterEach(() => {
    jest.useRealTimers();
    cleanup();
  });

  it("renders weekend message when scheduleKey is weekend", () => {
    mockGetScheduleKeyForDate.mockReturnValue("weekend");
    jest.setSystemTime(new Date("2026-02-28T12:00:00Z"));

    const { getByText, queryByLabelText } = render(
      <ShuttleSchedulePanel onClose={jest.fn()} />
    );

    expect(getByText("No shuttles on weekends.")).toBeTruthy();
    expect(queryByLabelText("SGW to Loyola")).toBeNull();
  });

  it("calls onClose when pressing backdrop or close button", () => {
    jest.setSystemTime(new Date("2026-02-27T10:00:00Z"));

    const onClose = jest.fn();
    const { getByLabelText } = render(<ShuttleSchedulePanel onClose={onClose} />);

    fireEvent.press(getByLabelText("Dismiss schedule"));
    fireEvent.press(getByLabelText("Close schedule"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("shows current time badge text", () => {
    jest.setSystemTime(new Date("2026-02-27T13:07:00.000-05:00"));

    const { getAllByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);
    // regex matches "1:07" or "13:07" regardless of AM/PM formatting
    expect(getAllByText(/1:07/).length).toBeGreaterThan(0);
  });

  it("weekday: direction tabs switch schedules", () => {
    jest.setSystemTime(new Date("2026-02-27T08:00:00Z"));

    const { getByLabelText, getAllByText } = render(
      <ShuttleSchedulePanel onClose={() => { }} />
    );

    fireEvent.press(getByLabelText("Loyola to SGW"));

    // Found in both Next Card and the list
    expect(getAllByText(/9:15/).length).toBeGreaterThan(0);
  });

  it("weekday: upcoming mode shows ETA badges", () => {
    jest.setSystemTime(new Date("2026-02-27T12:00:00.000-05:00"));

    const { getByText, getAllByText } = render(
      <ShuttleSchedulePanel onClose={() => { }} />
    );

    expect(getByText("Next departure")).toBeTruthy();
    // Matches "in 0m" or just "0m" badges
    expect(getAllByText(/0m/).length).toBeGreaterThan(0);
  });

  it("weekday: highlights a trip happening now across midnight", () => {
    // Set time to during the 23:50 trip
    jest.setSystemTime(new Date("2026-02-27T23:55:00.000-05:00"));

    const { getAllByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);
    expect(getAllByText("Now").length).toBeGreaterThan(0);
  });

  it("shows 'No departures found' when there are no trips", () => {
    // Directly mutate the mocked object
    mockShuttleData.schedule.weekday.SGW_to_Loyola = [];
    mockShuttleData.schedule.weekday.Loyola_to_SGW = [];

    const { getByText, queryByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);

    expect(getByText("No departures found")).toBeTruthy();
    expect(queryByText("in")).toBeNull();
  });

  it("interval tick updates time", () => {
    jest.setSystemTime(new Date("2026-02-27T10:00:00.000-05:00"));

    const { getByText, queryByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);

    expect(getByText(/10:00/)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(getByText(/10:01/)).toBeTruthy();
  });

  it("weekday: renders hour sections in 'All times' mode", () => {
    mockGetScheduleKeyForDate.mockReturnValue("weekday");
    jest.setSystemTime(new Date("2026-02-27T09:00:00Z"));

    const { getByLabelText, getByText } = render(
      <ShuttleSchedulePanel onClose={() => { }} />
    );

    // Switch to All Times
    fireEvent.press(getByLabelText("Show all departures"));

    // These assertions force the component to run the grouping logic (lines 288-307)
    expect(getByText("12 AM")).toBeTruthy();
    expect(getByText("12 PM")).toBeTruthy();
    expect(getByText("1 PM")).toBeTruthy();
  });
});