import {
    getScheduleKeyForDate,
    getShuttleAvailabilityStatus,
} from "../utils/shuttleAvailability"; // Adjust path if necessary

// Mock the shuttle schedule constant
jest.mock("../constants/shuttle", () => ({
  shuttleSchedule: {
    schedule: {
      weekend: {
        info: "No service on weekends.",
      },
    },
  },
}));

describe("Shuttle Availability Utils", () => {
  // Use known dates to avoid timezone/current-time test flakiness.
  // January 2026 calendar:
  // 4th: Sunday
  // 5th: Monday
  // 9th: Friday
  // 10th: Saturday
  
  const DATES = {
    SUNDAY: new Date(2026, 0, 4, 12, 0),
    MONDAY_EARLY: new Date(2026, 0, 5, 8, 0),
    MONDAY_START: new Date(2026, 0, 5, 9, 15),
    MONDAY_MID: new Date(2026, 0, 5, 12, 0),
    MONDAY_END: new Date(2026, 0, 5, 19, 0),
    MONDAY_LATE: new Date(2026, 0, 5, 19, 1),
    
    FRIDAY_MID: new Date(2026, 0, 9, 12, 0),
    FRIDAY_END: new Date(2026, 0, 9, 18, 45),
    FRIDAY_LATE: new Date(2026, 0, 9, 18, 46),
    
    SATURDAY: new Date(2026, 0, 10, 12, 0),
  };

  describe("getScheduleKeyForDate", () => {
    it("returns 'weekend' for Sunday and Saturday", () => {
      expect(getScheduleKeyForDate(DATES.SUNDAY)).toBe("weekend");
      expect(getScheduleKeyForDate(DATES.SATURDAY)).toBe("weekend");
    });

    it("returns 'monday-thursday' for Monday", () => {
      expect(getScheduleKeyForDate(DATES.MONDAY_MID)).toBe("monday-thursday");
    });

    it("returns 'friday' for Friday", () => {
      expect(getScheduleKeyForDate(DATES.FRIDAY_MID)).toBe("friday");
    });
  });

  describe("getShuttleAvailabilityStatus", () => {
    
    describe("Weekend Logic", () => {
      it("returns unavailable status with weekend info on weekends", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.SUNDAY, campus: "sgw" });
        
        expect(result.available).toBe(false);
        expect(result.scheduleKey).toBe("weekend");
        expect(result.reason).toBe("No service on weekends.");
        expect(result.operatingSummary).toBe("Mon–Fri only");
      });
    });

    describe("Operating Hours Logic", () => {
      it("returns unavailable if before operating hours (Mon-Thu)", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_EARLY });
        expect(result.available).toBe(false);
        expect(result.reason).toContain("Mon–Thu 9:15 AM – 7:00 PM");
      });

      it("returns unavailable if after operating hours (Mon-Thu)", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_LATE });
        expect(result.available).toBe(false);
      });

      it("returns unavailable if after operating hours (Friday)", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.FRIDAY_LATE });
        expect(result.available).toBe(false);
        expect(result.reason).toContain("Fri 9:15 AM – 6:45 PM");
      });

      it("returns available at exactly the start time (9:15 AM)", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_START });
        expect(result.available).toBe(true);
      });

      it("returns available at exactly the end time (Mon-Thu 7:00 PM)", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_END });
        expect(result.available).toBe(true);
      });

      it("returns available at exactly the end time (Friday 6:45 PM)", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.FRIDAY_END });
        expect(result.available).toBe(true);
      });
    });

    describe("Campus / Location Logic", () => {
      it("returns available if campus is SGW", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_MID, campus: "sgw" });
        expect(result.available).toBe(true);
      });

      it("returns available if campus is Loyola", () => {
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_MID, campus: "loyola" });
        expect(result.available).toBe(true);
      });

      it("returns available if campus is null/undefined", () => {
        // If we don't know the location, we default to showing true as long as time is valid
        const result = getShuttleAvailabilityStatus({ date: DATES.MONDAY_MID });
        expect(result.available).toBe(true);
      });

      it("returns unavailable if campus is outside the network", () => {
        // Force an invalid string into the campus parameter
        const result = getShuttleAvailabilityStatus({ 
          date: DATES.MONDAY_MID, 
          campus: "other_campus" as any 
        });
        
        expect(result.available).toBe(false);
        expect(result.reason).toBe("Shuttle is only available between SGW and Loyola campuses.");
      });
    });

    describe("Default Date Fallback", () => {
      it("executes without throwing if no arguments are provided", () => {
        // Since this relies on the actual current time when tests run, 
        // we just ensure it doesn't crash and returns a valid object structure.
        const result = getShuttleAvailabilityStatus({});
        expect(result).toHaveProperty("available");
        expect(result).toHaveProperty("scheduleKey");
      });
    });
  });
});