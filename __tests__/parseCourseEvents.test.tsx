// __tests__/parseCourseEvents.test.ts
import type { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import { parseCourseEvents } from "../utils/parseCourseEvents";

describe("parseCourseEvents", () => {
  it("parses valid dateTime events", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "1",
        summary: "COMP 123",
        location: "Hall Building",
        start: { dateTime: "2026-01-06T10:00:00Z" },
        end: { dateTime: "2026-01-06T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      id: "1",
      courseName: "COMP 123",
      location: "Hall Building",
      start: new Date("2026-01-06T10:00:00Z"),
      end: new Date("2026-01-06T11:00:00Z"),
    });
  });

  it("supports all-day events using date", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "2",
        summary: "MATH 200",
        location: "Library",
        start: { date: "2026-02-01" },
        end: { date: "2026-02-01" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0].start).toEqual(new Date("2026-02-01"));
    expect(res[0].end).toEqual(new Date("2026-02-01"));
  });

  it("filters events missing id", () => {
    const events: GoogleCalendarEvent[] = [
      {
        summary: "No ID",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res).toHaveLength(0);
  });

  it("filters events with invalid dates", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "bad",
        summary: "Invalid",
        start: { dateTime: "not-a-date" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res).toHaveLength(0);
  });

  it("uses fallback course name when summary missing", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "3",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res[0].courseName).toBe("Untitled class");
  });

  it("uses fallback location when missing", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "4",
        summary: "COMP 999",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res[0].location).toBe("Location not provided");
  });

  it("trims whitespace in summary and location", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "5",
        summary: "  SOEN 321  ",
        location: "  EV Building  ",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0].courseName).toBe("SOEN 321");
    expect(res[0].location).toBe("EV Building");
  });

  it("filters null results and sorts by start time", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "late",
        summary: "Late",
        start: { dateTime: "2026-01-01T12:00:00Z" },
        end: { dateTime: "2026-01-01T13:00:00Z" },
      },
      {
        id: "early",
        summary: "Early",
        start: { dateTime: "2026-01-01T08:00:00Z" },
        end: { dateTime: "2026-01-01T09:00:00Z" },
      },
      {
        // invalid event should be removed
        id: "bad",
        start: { dateTime: "invalid" },
        end: { dateTime: "2026-01-01T09:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("early");
    expect(res[1].id).toBe("late");
  });
});