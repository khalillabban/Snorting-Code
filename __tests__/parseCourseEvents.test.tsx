import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import {
  getNextClass,
  loadCachedSchedule,
  parseCourseEvents,
  saveSchedule,
} from "../utils/parseCourseEvents";
import type { ScheduleItem } from "../constants/type";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// parseCourseEvents
// ---------------------------------------------------------------------------

describe("parseCourseEvents", () => {
  it("parses valid dateTime events including campus/building/room", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "1",
        summary: "COMP 123 LEC",
        location: "SGW - H 860",
        start: { dateTime: "2026-01-06T10:00:00Z" },
        end: { dateTime: "2026-01-06T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res).toHaveLength(1);
    expect(res[0]).toEqual({
      id: "1",
      courseName: "COMP 123 LEC",
      location: "SGW - H 860",
      campus: "SGW",
      building: "H",
      room: "860",
      start: new Date("2026-01-06T10:00:00Z"),
      end: new Date("2026-01-06T11:00:00Z"),
    });
  });

  it("parses a multi-character building code correctly", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "2",
        summary: "ENGR 301 TUT",
        location: "LOY - VE 219",
        start: { dateTime: "2026-02-01T13:00:00Z" },
        end: { dateTime: "2026-02-01T14:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res[0].campus).toBe("LOY");
    expect(res[0].building).toBe("VE");
    expect(res[0].room).toBe("219");
  });

  it("leaves campus/building/room empty when location does not match pattern", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "3",
        summary: "MATH 200 LEC",
        location: "Hall Building",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res[0].campus).toBe("");
    expect(res[0].building).toBe("");
    expect(res[0].room).toBe("");
  });

  it("supports all-day events using date", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "4",
        summary: "MATH 200 LEC",
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

    expect(parseCourseEvents(events)).toHaveLength(0);
  });

  it("filters events with invalid start date", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "bad",
        summary: "Invalid",
        start: { dateTime: "not-a-date" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    expect(parseCourseEvents(events)).toHaveLength(0);
  });

  it("uses fallback course name when summary missing", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "5",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    expect(parseCourseEvents(events)[0].courseName).toBe("Untitled class");
  });

  it("uses fallback location when missing", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "6",
        summary: "COMP 999 LEC",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    expect(parseCourseEvents(events)[0].location).toBe("Location not provided");
  });

  it("trims whitespace in summary and location", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "7",
        summary: "  SOEN 321 LEC  ",
        location: "  SGW - EV 2.260  ",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);
    expect(res[0].courseName).toBe("SOEN 321 LEC");
    expect(res[0].location).toBe("SGW - EV 2.260");
  });

  it("filters invalid events and sorts remaining by start time", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "late",
        summary: "Late LEC",
        start: { dateTime: "2026-01-01T12:00:00Z" },
        end: { dateTime: "2026-01-01T13:00:00Z" },
      },
      {
        id: "early",
        summary: "Early LEC",
        start: { dateTime: "2026-01-01T08:00:00Z" },
        end: { dateTime: "2026-01-01T09:00:00Z" },
      },
      {
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

// ---------------------------------------------------------------------------
// saveSchedule
// ---------------------------------------------------------------------------

describe("saveSchedule", () => {
  it("serialises items to AsyncStorage under scheduleItems key", async () => {
    const items: ScheduleItem[] = [
      {
        id: "a",
        courseName: "COMP 101 LEC",
        start: new Date("2026-03-10T10:00:00Z"),
        end: new Date("2026-03-10T11:00:00Z"),
        location: "SGW - H 920",
        campus: "SGW",
        building: "H",
        room: "920",
      },
    ];

    await saveSchedule(items);

    const stored = await AsyncStorage.getItem("scheduleItems");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("a");
    expect(parsed[0].courseName).toBe("COMP 101 LEC");
  });

  it("persists an empty array without throwing", async () => {
    await expect(saveSchedule([])).resolves.toBeUndefined();
    const stored = await AsyncStorage.getItem("scheduleItems");
    expect(JSON.parse(stored!)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadCachedSchedule
// ---------------------------------------------------------------------------

describe("loadCachedSchedule", () => {
  it("returns null when AsyncStorage has no data", async () => {
    await expect(loadCachedSchedule()).resolves.toBeNull();
  });

  it("revives start and end as Date instances", async () => {
    const raw = JSON.stringify([
      {
        id: "x",
        courseName: "SOEN 341 LAB",
        start: "2026-04-01T09:00:00.000Z",
        end: "2026-04-01T10:00:00.000Z",
        location: "SGW - EV 3.309",
        campus: "SGW",
        building: "EV",
        room: "3.309",
      },
    ]);
    await AsyncStorage.setItem("scheduleItems", raw);

    const items = await loadCachedSchedule();
    expect(items).not.toBeNull();
    expect(items![0].start).toBeInstanceOf(Date);
    expect(items![0].end).toBeInstanceOf(Date);
    expect(items![0].start.toISOString()).toBe("2026-04-01T09:00:00.000Z");
  });

  it("returns multiple items with correct shape", async () => {
    const data = [
      { id: "1", courseName: "A LEC", start: "2026-01-01T08:00:00Z", end: "2026-01-01T09:00:00Z", location: "", campus: "", building: "", room: "" },
      { id: "2", courseName: "B TUT", start: "2026-01-02T08:00:00Z", end: "2026-01-02T09:00:00Z", location: "", campus: "", building: "", room: "" },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const items = await loadCachedSchedule();
    expect(items).toHaveLength(2);
    expect(items![0].id).toBe("1");
    expect(items![1].id).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// getNextClass
// ---------------------------------------------------------------------------

describe("getNextClass", () => {
  it("returns null when no schedule is cached", async () => {
    await expect(getNextClass()).resolves.toBeNull();
  });

  it("returns null when all cached items are in the past", async () => {
    const data = [
      { id: "old1", courseName: "HIST LEC", start: "2020-01-01T10:00:00Z", end: "2020-01-01T11:00:00Z", location: "", campus: "", building: "", room: "" },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    await expect(getNextClass()).resolves.toBeNull();
  });

  it("returns the soonest future class", async () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    const later = new Date(Date.now() + 3_600_000).toISOString();
    // Items must be stored sorted by start time (as parseCourseEvents always produces)
    const data = [
      { id: "soon",  courseName: "COMP 001 LEC", start: soon,  end: soon,  location: "", campus: "SGW", building: "H", room: "200" },
      { id: "later", courseName: "COMP 999 LEC", start: later, end: later, location: "", campus: "SGW", building: "H", room: "100" },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();
    expect(next).not.toBeNull();
    expect(next!.id).toBe("soon");
  });

  it("returns the only future class when mixed with past classes", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const data = [
      { id: "past",   courseName: "OLD LEC",  start: "2020-01-01T10:00:00Z", end: "2020-01-01T11:00:00Z", location: "", campus: "", building: "", room: "" },
      { id: "future", courseName: "NEXT LEC", start: future, end: future, location: "", campus: "SGW", building: "EV", room: "101" },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();
    expect(next!.id).toBe("future");
    expect(next!.building).toBe("EV");
  });
});
