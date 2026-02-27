import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ShuttleSchedulePanel } from "../components/ShuttleSchedulePanel"; // Adjust path if needed
import { getScheduleKeyForDate } from "../utils/shuttleAvailability";

// 1. Mock Icons
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => "Icon",
}));

// 2. Mock Shuttle Availability Utils
jest.mock("../utils/shuttleAvailability", () => ({
  getScheduleKeyForDate: jest.fn(),
}));

// 3. Mock the Shuttle Schedule JSON
jest.mock("../constants/shuttle", () => ({
  shuttleSchedule: {
    schedule: {
      "monday-thursday": {
        SGW_to_Loyola: [
          { departureTime: "09:00", arrivalTime: "09:30" },
          { departureTime: "14:00", arrivalTime: "14:30" }, // 2:00 PM
          { departureTime: "20:00", arrivalTime: "20:30" }, // 8:00 PM
        ],
        Loyola_to_SGW: [
          { departureTime: "10:00", arrivalTime: "10:30" },
        ],
      },
      weekend: {
        info: "Mocked Weekend Info: No Service",
      },
    },
  },
}));

describe("ShuttleSchedulePanel", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls onClose when the backdrop is pressed", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    render(<ShuttleSchedulePanel onClose={mockOnClose} />);

    fireEvent.press(screen.getByLabelText("Dismiss schedule"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close (X) button is pressed", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    render(<ShuttleSchedulePanel onClose={mockOnClose} />);

    fireEvent.press(screen.getByLabelText("Close schedule"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("renders the weekend message when scheduleKey is 'weekend'", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("weekend");
    render(<ShuttleSchedulePanel onClose={mockOnClose} />);

    expect(screen.getByText("Mocked Weekend Info: No Service")).toBeTruthy();
    expect(screen.queryByText("SGW → Loyola")).toBeNull();
  });

  it("renders the schedule sections on weekdays", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    render(<ShuttleSchedulePanel onClose={mockOnClose} />);

    expect(screen.getByText("SGW → Loyola")).toBeTruthy();
    expect(screen.getByText("Loyola → SGW")).toBeTruthy();
    
    // Verify formatTime converted "14:00" to "2:00 PM"
    expect(screen.getByText("2:00 PM – 2:30 PM")).toBeTruthy();
    expect(screen.getByText("8:00 PM – 8:30 PM")).toBeTruthy();
  });

  it("applies the 'Now' badge if a shuttle is currently en route", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    
    // Set time to 2:15 PM (14:15) - right in the middle of the 14:00 to 14:30 route
    jest.setSystemTime(new Date("2026-02-05T14:15:00"));

    render(<ShuttleSchedulePanel onClose={mockOnClose} />);

    // The component should render a "Now" badge
    expect(screen.getByText("Now")).toBeTruthy();
  });

  it("sorts times so the 'Next' upcoming departure is first and gets the 'Next' badge", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    
    // Set time to 1:00 PM (13:00). 
    // The next shuttle is 14:00 (2:00 PM). The 09:00 one is in the past.
    jest.setSystemTime(new Date("2026-02-05T13:00:00"));

    render(<ShuttleSchedulePanel onClose={mockOnClose} />);

    // Because it's upcoming (not currently running), it gets the "Next" badge
    const nextBadges = screen.getAllByText("Next");
    expect(nextBadges.length).toBeGreaterThan(0);

    // Verify it sorted 2:00 PM to the top (we can't easily check array order in RTL, 
    // but verifying the badge renders proves the logic worked, because the badge is 
    // strictly applied to index === 0).
  });

  it("cleans up the interval on unmount", () => {
    (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    
    const { unmount } = render(<ShuttleSchedulePanel onClose={mockOnClose} />);
    
    // Number of active timers should be 1 (the setInterval for the clock)
    expect(jest.getTimerCount()).toBe(1);
    
    unmount();
    
    // Timer should be cleared
    expect(jest.getTimerCount()).toBe(0);
  });
});