import { render, screen } from "@testing-library/react-native";
import React from "react";
// Adjust this import path to point to your actual ShuttleBus file
import ShuttleBus, {
    calculateAdjustedDepartureTime,
    getNextShuttleDepartures,
} from "../components/ShuttleBus";
import { getScheduleKeyForDate } from "../utils/shuttleAvailability";

// 1. Mock the Shuttle Schedule Data
jest.mock("../constants/shuttle", () => ({
  shuttleSchedule: {
    schedule: {
      "monday-thursday": {
        SGW_to_Loyola: [
          { departureTime: "09:00", arrivalTime: "09:30" },
          { departureTime: "10:00", arrivalTime: "10:30" },
          { departureTime: "11:00", arrivalTime: "11:30" },
          { departureTime: "12:00", arrivalTime: "12:30" },
        ],
        Loyola_to_SGW: [
          { departureTime: "09:15", arrivalTime: "09:45" },
        ],
      },
      weekend: {},
    },
  },
}));

// 2. Mock the Schedule Key Utility
jest.mock("../utils/shuttleAvailability", () => ({
  getScheduleKeyForDate: jest.fn(),
}));

describe("ShuttleBus Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Utility: getNextShuttleDepartures ---
  describe("getNextShuttleDepartures", () => {
    it("returns empty array on weekends", () => {
      (getScheduleKeyForDate as jest.Mock).mockReturnValue("weekend");
      const departures = getNextShuttleDepartures("SGW", "Loyola");
      expect(departures).toEqual([]);
    });

    it("filters out past departures and limits results", () => {
      (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
      
      // Freeze time at 10:15 AM
      jest.setSystemTime(new Date("2026-02-05T10:15:00"));

      const departures = getNextShuttleDepartures("SGW", "Loyola", 2);
      
      // Should filter out 09:00 and 10:00, leaving 11:00 and 12:00
      expect(departures).toHaveLength(2);
      expect(departures[0].departureTime).toBe("11:00");
      expect(departures[1].departureTime).toBe("12:00");
    });

    it("returns empty array if no more shuttles are scheduled for today", () => {
      (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
      
      // Freeze time at 1:00 PM (after the last 12:00 shuttle)
      jest.setSystemTime(new Date("2026-02-05T13:00:00"));

      const departures = getNextShuttleDepartures("SGW", "Loyola");
      expect(departures).toEqual([]);
    });

    it("returns empty array when the requested same-campus direction has no schedule", () => {
      (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");

      const departures = getNextShuttleDepartures("SGW", "SGW");
      expect(departures).toEqual([]);
    });
  });

  // --- Utility: calculateAdjustedDepartureTime ---
  describe("calculateAdjustedDepartureTime", () => {
    beforeEach(() => {
      (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    });

    it("returns the exact same departure time if user has > 5 mins to walk", () => {
      // Freeze time at 09:50 AM
      jest.setSystemTime(new Date("2026-02-05T09:50:00"));
      
      // Target shuttle is 10:00 (10 mins away, > 5 mins walk time)
      const adjusted = calculateAdjustedDepartureTime("10:00", "SGW", "Loyola");
      
      expect(adjusted).toBe("10:00");
    });

    it("bumps to the NEXT shuttle if user has <= 5 mins to walk", () => {
      // Freeze time at 09:57 AM
      jest.setSystemTime(new Date("2026-02-05T09:57:00"));
      
      // Target shuttle is 10:00 (3 mins away, which is <= 5 mins walk time)
      // It should query getNextShuttleDepartures and pick the 2nd one (11:00)
      const adjusted = calculateAdjustedDepartureTime("10:00", "SGW", "Loyola");
      
      expect(adjusted).toBe("11:00");
    });

    it("returns the original time if user misses it but there are no more shuttles", () => {
      // Freeze time at 11:58 AM
      jest.setSystemTime(new Date("2026-02-05T11:58:00"));
      
      // Target shuttle is 12:00 (last shuttle of the day)
      // Because there is no "next" shuttle to bump to, it defaults back to the original
      const adjusted = calculateAdjustedDepartureTime("12:00", "SGW", "Loyola");
      
      expect(adjusted).toBe("12:00");
    });
  });

  // --- Component: <ShuttleBus /> ---
  describe("ShuttleBus Component", () => {
    beforeEach(() => {
      (getScheduleKeyForDate as jest.Mock).mockReturnValue("monday-thursday");
    });

    it("renders nothing (returns null) when start and end locations are the same", () => {
      render(<ShuttleBus startLocation="SGW" endLocation="SGW" />);
      
      // Querying the title should return null because the component didn't render
      expect(screen.queryByText("Next Shuttle Departures")).toBeNull();
    });

    it("renders upcoming departures correctly", () => {
      // Freeze time at 09:30 AM
      jest.setSystemTime(new Date("2026-02-05T09:30:00"));

      render(<ShuttleBus startLocation="SGW" endLocation="Loyola" />);

      // Verify the title exists
      expect(screen.getByText("Next Shuttle Departures")).toBeTruthy();

      // Verify the next two shuttles render (10:00 and 11:00)
      expect(screen.getByText("10:00")).toBeTruthy();
      expect(screen.getByText("10:30")).toBeTruthy(); // Arrival time
      expect(screen.getByText("11:00")).toBeTruthy();
      expect(screen.getByText("11:30")).toBeTruthy(); // Arrival time
    });

    it("renders 'No upcoming shuttles' message when list is empty", () => {
      // Freeze time at 1:00 PM (after the last 12:00 shuttle)
      jest.setSystemTime(new Date("2026-02-05T13:00:00"));

      render(<ShuttleBus startLocation="SGW" endLocation="Loyola" />);

      // Verify the fallback message renders
      expect(screen.getByText("No upcoming shuttles for today.")).toBeTruthy();
    });

    it("renders shuttle departures for Loyola to SGW direction", () => {
      // Freeze time before the only Loyola -> SGW mocked departure at 09:15
      jest.setSystemTime(new Date("2026-02-05T09:00:00"));

      render(<ShuttleBus startLocation="Loyola" endLocation="SGW" />);

      expect(screen.getByText("Next Shuttle Departures")).toBeTruthy();
      expect(screen.getByText("09:15")).toBeTruthy();
      expect(screen.getByText("09:45")).toBeTruthy();
    });
  });
});