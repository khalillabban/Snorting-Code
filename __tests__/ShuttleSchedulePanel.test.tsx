import React from "react";
import { render, fireEvent, act, cleanup } from "@testing-library/react-native";
import { ShuttleSchedulePanel } from "../components/ShuttleSchedulePanel";

// 1. Mutable data source for the mock to allow dynamic updates without re-requiring
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

// Mock the constant to return the mutable variable via a getter
jest.mock("../constants/shuttle", () => ({
  get shuttleSchedule() {
    return mockShuttleData;
  },
}));

describe("ShuttleSchedulePanel", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetScheduleKeyForDate.mockReturnValue("weekday");
    
    // Reset data to default state
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

  const setFixedTime = (hours: number, minutes: number) => {
    const date = new Date(2026, 1, 27, hours, minutes, 0); 
    jest.setSystemTime(date);
    return date;
  };

  it("renders weekend message when scheduleKey is weekend", () => {
    mockGetScheduleKeyForDate.mockReturnValue("weekend");
    setFixedTime(12, 0);

    const { getByText, queryByLabelText } = render(
      <ShuttleSchedulePanel onClose={jest.fn()} />
    );

    expect(getByText(/No shuttles on weekends/i)).toBeTruthy();
    expect(queryByLabelText("SGW to Loyola")).toBeNull();
  });

  it("calls onClose when pressing backdrop or close button", () => {
    setFixedTime(10, 0);
    const onClose = jest.fn();
    const { getByLabelText } = render(<ShuttleSchedulePanel onClose={onClose} />);

    fireEvent.press(getByLabelText("Dismiss schedule"));
    fireEvent.press(getByLabelText("Close schedule"));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("weekday: direction tabs switch schedules", () => {
    setFixedTime(8, 0);
    const { getByLabelText, getAllByText } = render(
      <ShuttleSchedulePanel onClose={() => { }} />
    );

    fireEvent.press(getByLabelText("Loyola to SGW"));
    // Using regex to handle AM/PM and a.m./p.m. variations
    expect(getAllByText(/9:15/).length).toBeGreaterThan(0);
  });

  it("weekday: highlights a trip happening now across midnight", () => {
    // 11:55 PM (23:55) falls within the 23:50 -> 00:10 trip window
    setFixedTime(23, 55);

    const { getAllByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);
    expect(getAllByText(/Now/i).length).toBeGreaterThan(0);
  });

  it("shows 'No departures found' when there are no trips", () => {
    mockShuttleData.schedule.weekday.SGW_to_Loyola = [];
    mockShuttleData.schedule.weekday.Loyola_to_SGW = [];

    const { getByText, queryByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);

    expect(getByText(/No departures found/i)).toBeTruthy();
    expect(queryByText("in")).toBeNull();
  });

  it("interval tick updates time", () => {
    setFixedTime(10, 0);
    const { getByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);

    expect(getByText(/10:00/)).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(getByText(/10:01/)).toBeTruthy();
  });

  it("groups sections when switching to All Times", () => {
    setFixedTime(10, 0);
    const { getByLabelText, getByText } = render(
      <ShuttleSchedulePanel onClose={() => { }} />
    );

    fireEvent.press(getByLabelText("Show all departures"));
    // Verifies the SectionList grouping logic
    expect(getByText(/12 PM/)).toBeTruthy();
  });

  it("handles ETA math for different day periods", () => {
    // Set time to 2:00 PM (14:00) so we are past the 12:00 PM trip
    setFixedTime(14, 0);
    const { getAllByText } = render(<ShuttleSchedulePanel onClose={() => { }} />);
    
    expect(getAllByText(/Next departure/i).length).toBeGreaterThan(0);
  });
});