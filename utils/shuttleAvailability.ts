import type { CampusKey } from "../constants/campuses";
import { shuttleSchedule } from "../constants/shuttle";

export type ScheduleKey = "monday-thursday" | "friday" | "weekend";

/** Get the schedule key for a given date (day of week). */
export function getScheduleKeyForDate(date: Date): ScheduleKey {
  const day = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return "weekend";
  if (day === 5) return "friday";
  return "monday-thursday";
}

/** First departure and last arrival (minutes) per schedule key. */
const OPERATING_WINDOW: Record<Exclude<ScheduleKey, "weekend">, { start: number; end: number }> = {
  "monday-thursday": { start: 9 * 60 + 15, end: 19 * 60 + 0 },
  friday: { start: 9 * 60 + 15, end: 18 * 60 + 45 },
};

function isWithinOperatingHours(scheduleKey: ScheduleKey, currentMinutes: number): boolean {
  if (scheduleKey === "weekend") return false;
  const { start, end } = OPERATING_WINDOW[scheduleKey];
  return currentMinutes >= start && currentMinutes <= end;
}

export interface ShuttleAvailabilityStatus {
  available: boolean;
  reason?: string;
  scheduleKey: ScheduleKey;
  /** Human-readable operating summary for UI */
  operatingSummary?: string;
}

/**
 * Time-aware: weekend or outside operating hours => not available.
 * Location-aware: shuttle is only relevant on Concordia campuses (sgw/loyola).
 */
export function getShuttleAvailabilityStatus(params: {
  date?: Date;
  campus?: CampusKey | null;
}): ShuttleAvailabilityStatus {
  const now = params.date ?? new Date();
  const campus = params.campus ?? null;

  const scheduleKey = getScheduleKeyForDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (scheduleKey === "weekend") {
    const info = shuttleSchedule.schedule.weekend.info;
    return {
      available: false,
      reason: info,
      scheduleKey,
      operatingSummary: "Mon–Fri only",
    };
  }

  if (!isWithinOperatingHours(scheduleKey, currentMinutes)) {
    const summary =
      scheduleKey === "friday"
        ? "Fri 9:15 AM – 6:45 PM"
        : "Mon–Thu 9:15 AM – 7:00 PM";
    return {
      available: false,
      reason: `Shuttle operates ${summary}.`,
      scheduleKey,
      operatingSummary: summary,
    };
  }

  // Location: only relevant when user is on a Concordia campus (sgw or loyola)
  const campusRelevant = campus === "sgw" || campus === "loyola";
  if (!campusRelevant && campus != null) {
    return {
      available: false,
      reason: "Shuttle is only available between SGW and Loyola campuses.",
      scheduleKey,
    };
  }

  return {
    available: true,
    scheduleKey,
    operatingSummary: scheduleKey === "friday" ? "Fri 9:15 AM – 6:45 PM" : "Mon–Thu 9:15 AM – 7:00 PM",
  };
}
