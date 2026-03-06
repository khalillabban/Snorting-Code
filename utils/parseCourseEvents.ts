// utils/parseCourseEvents.ts
import type { GoogleCalendarEvent } from "../services/GoogleCalendarService";

export interface ScheduleItem {
  id: string;
  courseName: string;
  start: Date;
  end: Date;
  location: string; // always non-empty (fallback)
}

function parseGoogleDateTime(ev: GoogleCalendarEvent, which: "start" | "end") {
  const obj = which === "start" ? ev.start : ev.end;
  const raw = obj?.dateTime ?? obj?.date;
  if (!raw) return null;

  // dateTime is ISO; date is YYYY-MM-DD (all-day). We treat all-day as midnight local.
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function parseCourseEvents(events: GoogleCalendarEvent[]): ScheduleItem[] {
  return events
    .map((ev) => {
      const start = parseGoogleDateTime(ev, "start");
      const end = parseGoogleDateTime(ev, "end");

      if (!ev.id || !start || !end) return null;

      const courseName = (ev.summary ?? "").trim() || "Untitled class";
      const location = (ev.location ?? "").trim() || "Location not provided";

      return {
        id: ev.id,
        courseName,
        start,
        end,
        location,
      };
    })
    .filter((x): x is ScheduleItem => Boolean(x))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}