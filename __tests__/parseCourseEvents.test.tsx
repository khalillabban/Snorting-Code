import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ScheduleItem } from "../constants/type";
import type { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import {
    getNextClass,
    getNextClassFromItems,
    loadCachedSchedule,
    parseCourseEvents,
    saveSchedule,
} from "../utils/parseCourseEvents";

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  (global as any).__DEV__ = false;
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
      kind: "class",
      courseName: "COMP 123 LEC",
      location: "SGW - H 860",
      campus: "SGW",
      building: "H",
      room: "860",
      level: "8",
      start: new Date("2026-01-06T10:00:00Z"),
      end: new Date("2026-01-06T11:00:00Z"),
    });
  });

  it("classifies non-academic titles as events", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "career-fair",
        summary: "Career Fair",
        location: "SGW - H 110",
        start: { dateTime: "2026-01-08T10:00:00Z" },
        end: { dateTime: "2026-01-08T12:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res).toHaveLength(1);
    expect(res[0].kind).toBe("event");
    expect(res[0].courseName).toBe("Career Fair");
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

  it("parses noRoom campus format like 'SGW H-920'", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "no-room-branch",
        summary: "COMP 345 LAB",
        location: "SGW H-920",
        start: { dateTime: "2026-02-10T10:00:00Z" },
        end: { dateTime: "2026-02-10T12:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0]).toMatchObject({
      campus: "SGW",
      building: "H",
      room: "920",
      level: "9",
    });
  });

  it("parses campus/building when room is missing", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "building-only",
        summary: "COMP 353 LEC",
        location: "LOY - VL",
        start: { dateTime: "2026-02-11T10:00:00Z" },
        end: { dateTime: "2026-02-11T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0]).toMatchObject({
      campus: "LOY",
      building: "VL",
      room: "",
      level: "",
    });
  });

  it("parses compact campus-building format without separators", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "compact-campus-building",
        summary: "COMP 248 LEC",
        location: "SGW H",
        start: { dateTime: "2026-02-11T12:00:00Z" },
        end: { dateTime: "2026-02-11T13:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0]).toMatchObject({
      campus: "SGW",
      building: "H",
      room: "",
      level: "",
    });
  });

  it("falls back to unexpected-format handling when campus prefix has no remaining location", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "campus-only-empty-rest",
        summary: "COMP 249 LEC",
        location: "SGW -",
        start: { dateTime: "2026-02-11T12:00:00Z" },
        end: { dateTime: "2026-02-11T13:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0]).toMatchObject({
      campus: "",
      building: "SGW -",
      room: "",
      level: "",
    });
  });

  it("uses splitRoom default branch for non-numeric room values", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "default-room",
        summary: "COMP 472 LAB",
        location: "SGW - MB LAB",
        start: { dateTime: "2026-02-12T10:00:00Z" },
        end: { dateTime: "2026-02-12T11:00:00Z" },
      },
    ];

    const res = parseCourseEvents(events);

    expect(res[0]).toMatchObject({
      campus: "SGW",
      building: "MB",
      room: "LAB",
      level: "",
    });
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
    expect(res[0].building).toBe("Hall Building");
    expect(res[0].room).toBe("");
  });

  it("warns in __DEV__ when location format is unexpected", () => {
    (global as any).__DEV__ = true;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const events: GoogleCalendarEvent[] = [
      {
        id: "warn-location",
        summary: "MATH 200 LEC",
        location: "Hall Building",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    parseCourseEvents(events);

    expect(warnSpy).toHaveBeenCalledWith(
      "parseLocation: unexpected format:",
      "Hall Building",
    );
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

  it("filters events with invalid end date", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "bad",
        summary: "Invalid",
        start: { dateTime: "2026-01-01T09:00:00Z" },
        end: { dateTime: "not-a-date" },
      },
    ];

    expect(parseCourseEvents(events)).toHaveLength(0);
  });

  it("filters events when start has neither dateTime nor date", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "missing-start-raw",
        summary: "Invalid",
        start: {},
        end: { dateTime: "2026-01-01T11:00:00Z" },
      },
    ];

    expect(parseCourseEvents(events)).toHaveLength(0);
  });

  it("filters events when end has neither dateTime nor date", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "missing-end-raw",
        summary: "Invalid",
        start: { dateTime: "2026-01-01T10:00:00Z" },
        end: {},
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

  it("uses fallback course name when summary is only whitespace", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "5b",
        summary: "   ",
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

  it("uses fallback location when location is only whitespace", () => {
    const events: GoogleCalendarEvent[] = [
      {
        id: "6b",
        summary: "COMP 999 LEC",
        location: "   ",
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
    expect(res[0].building).toBe("EV");
    expect(res[0].room).toBe("2.260");
    expect(res[0].level).toBe("2");
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
        kind: "class",
        courseName: "COMP 101 LEC",
        start: new Date("2026-03-10T10:00:00Z"),
        end: new Date("2026-03-10T11:00:00Z"),
        location: "SGW - H 920",
        campus: "SGW",
        building: "H",
        room: "920",
        level: "9",
      },
    ];

    await saveSchedule(items);

    const stored = await AsyncStorage.getItem("scheduleItems");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("a");
    expect(parsed[0].kind).toBe("class");
    expect(parsed[0].courseName).toBe("COMP 101 LEC");
  });

  it("persists an empty array without throwing", async () => {
    await expect(saveSchedule([])).resolves.toBeUndefined();
    const stored = await AsyncStorage.getItem("scheduleItems");
    expect(JSON.parse(stored!)).toEqual([]);
  });

  it("logs in __DEV__ after saving", async () => {
    (global as any).__DEV__ = true;
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    await saveSchedule([]);

    expect(logSpy).toHaveBeenCalledWith("Saved 0 items to AsyncStorage");
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
        kind: "class",
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
    expect(items![0].kind).toBe("class");
    expect(items![0].start.toISOString()).toBe("2026-04-01T09:00:00.000Z");
  });

  it("backfills kind for legacy cached items", async () => {
    const raw = JSON.stringify([
      {
        id: "legacy-class",
        courseName: "COMP 346 LEC",
        start: "2026-04-01T09:00:00.000Z",
        end: "2026-04-01T10:00:00.000Z",
        location: "SGW - H 920",
        campus: "SGW",
        building: "H",
        room: "920",
      },
      {
        id: "legacy-event",
        courseName: "Career Fair",
        start: "2026-04-02T09:00:00.000Z",
        end: "2026-04-02T10:00:00.000Z",
        location: "SGW - EV Atrium",
        campus: "SGW",
        building: "EV",
        room: "Atrium",
      },
    ]);

    await AsyncStorage.setItem("scheduleItems", raw);

    const items = await loadCachedSchedule();

    expect(items).toHaveLength(2);
    expect(items![0].kind).toBe("class");
    expect(items![1].kind).toBe("event");
  });

  it("returns multiple items with correct shape", async () => {
    const data = [
      {
        id: "1",
        courseName: "A LEC",
        start: "2026-01-01T08:00:00Z",
        end: "2026-01-01T09:00:00Z",
        location: "",
        campus: "",
        building: "",
        room: "",
      },
      {
        id: "2",
        courseName: "B TUT",
        start: "2026-01-02T08:00:00Z",
        end: "2026-01-02T09:00:00Z",
        location: "",
        campus: "",
        building: "",
        room: "",
      },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const items = await loadCachedSchedule();
    expect(items).toHaveLength(2);
    expect(items![0].id).toBe("1");
    expect(items![1].id).toBe("2");
  });

  it("clears cache and returns null when AsyncStorage.getItem throws", async () => {
    const getItemSpy = jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("boom"));
    const removeSpy = jest.spyOn(AsyncStorage, "removeItem");

    await expect(loadCachedSchedule()).resolves.toBeNull();

    expect(getItemSpy).toHaveBeenCalledWith("scheduleItems");
    expect(removeSpy).toHaveBeenCalledWith("scheduleItems");
  });

  it("warns in __DEV__ when cache loading fails", async () => {
    (global as any).__DEV__ = true;
    const err = new Error("boom");
    jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(err);
    jest.spyOn(AsyncStorage, "removeItem").mockResolvedValueOnce();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await loadCachedSchedule();

    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to load cached schedule, clearing cache:",
      err,
    );
  });
});

// ---------------------------------------------------------------------------
// getNextClass
// ---------------------------------------------------------------------------

describe("getNextClass", () => {
  it("returns null when no schedule is cached", async () => {
    await expect(getNextClass()).resolves.toBeNull();
  });

  it("returns null when cached schedule is empty", async () => {
    await AsyncStorage.setItem("scheduleItems", JSON.stringify([]));
    await expect(getNextClass()).resolves.toBeNull();
  });

  it("wraps around to earliest class when all events are in the past", async () => {
    const data = [
      {
        id: "old1",
        courseName: "HIST LEC",
        start: "2020-01-01T10:00:00Z",
        end: "2020-01-01T11:00:00Z",
        location: "",
        campus: "",
        building: "",
        room: "",
      },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();
    expect(next).not.toBeNull();
    expect(next!.id).toBe("old1");
  });

  it("returns the soonest future class", async () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    const later = new Date(Date.now() + 3_600_000).toISOString();

    const data = [
      {
        id: "soon",
        courseName: "COMP 001 LEC",
        start: soon,
        end: soon,
        location: "",
        campus: "SGW",
        building: "H",
        room: "200",
      },
      {
        id: "later",
        courseName: "COMP 999 LEC",
        start: later,
        end: later,
        location: "",
        campus: "SGW",
        building: "H",
        room: "100",
      },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();
    expect(next).not.toBeNull();
    expect(next!.id).toBe("soon");
  });

  it("returns null when cached schedule has only events", async () => {
    const data = [
      {
        id: "event-only",
        kind: "event",
        courseName: "Career Fair",
        start: new Date(Date.now() + 60_000).toISOString(),
        end: new Date(Date.now() + 120_000).toISOString(),
        location: "SGW - EV Atrium",
        campus: "SGW",
        building: "EV",
        room: "Atrium",
      },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    await expect(getNextClass()).resolves.toBeNull();
  });

  it("ignores earlier events and returns the next class", async () => {
    const eventSoon = new Date(Date.now() + 60_000).toISOString();
    const classLater = new Date(Date.now() + 3_600_000).toISOString();

    const data = [
      {
        id: "event-soon",
        kind: "event",
        courseName: "Career Fair",
        start: eventSoon,
        end: eventSoon,
        location: "SGW - EV Atrium",
        campus: "SGW",
        building: "EV",
        room: "Atrium",
      },
      {
        id: "class-later",
        kind: "class",
        courseName: "COMP 248 LEC",
        start: classLater,
        end: classLater,
        location: "SGW - H 820",
        campus: "SGW",
        building: "H",
        room: "820",
      },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();

    expect(next).not.toBeNull();
    expect(next!.id).toBe("class-later");
  });

  it("returns the earliest upcoming class even when cached future items are out of order", async () => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    const soon = new Date(Date.now() + 60_000).toISOString();
    const middle = new Date(Date.now() + 1_800_000).toISOString();

    const data = [
      {
        id: "later",
        courseName: "COMP 999 LEC",
        start: later,
        end: later,
        location: "",
        campus: "SGW",
        building: "H",
        room: "100",
      },
      {
        id: "soon",
        courseName: "COMP 001 LEC",
        start: soon,
        end: soon,
        location: "",
        campus: "SGW",
        building: "H",
        room: "200",
      },
      {
        id: "middle",
        courseName: "COMP 500 LEC",
        start: middle,
        end: middle,
        location: "",
        campus: "SGW",
        building: "EV",
        room: "101",
      },
    ];

    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();
    expect(next).not.toBeNull();
    expect(next!.id).toBe("soon");
  });

  it("returns the only future class when mixed with past classes", async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const data = [
      {
        id: "past",
        courseName: "OLD LEC",
        start: "2020-01-01T10:00:00Z",
        end: "2020-01-01T11:00:00Z",
        location: "",
        campus: "",
        building: "",
        room: "",
      },
      {
        id: "future",
        courseName: "NEXT LEC",
        start: future,
        end: future,
        location: "",
        campus: "SGW",
        building: "EV",
        room: "101",
      },
    ];
    await AsyncStorage.setItem("scheduleItems", JSON.stringify(data));

    const next = await getNextClass();
    expect(next!.id).toBe("future");
    expect(next!.building).toBe("EV");
  });
});

// ---------------------------------------------------------------------------
// getNextClassFromItems (synchronous version)
// ---------------------------------------------------------------------------

describe("getNextClassFromItems", () => {
  it("returns null for empty array", () => {
    expect(getNextClassFromItems([])).toBeNull();
  });

  it("returns the soonest future class", () => {
    const soon = new Date(Date.now() + 60_000);
    const later = new Date(Date.now() + 3_600_000);

    const items: ScheduleItem[] = [
      {
        id: "later",
        kind: "class",
        courseName: "COMP 999",
        start: later,
        end: later,
        location: "SGW H 100",
        campus: "SGW",
        building: "H",
        room: "100",
        level: "1",
      },
      {
        id: "soon",
        kind: "class",
        courseName: "COMP 001",
        start: soon,
        end: soon,
        location: "SGW EV 200",
        campus: "SGW",
        building: "EV",
        room: "200",
        level: "2",
      },
    ];

    const next = getNextClassFromItems(items);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("soon");
  });

  it("returns null when items contain only events", () => {
    const items: ScheduleItem[] = [
      {
        id: "event-only",
        kind: "event",
        courseName: "Career Fair",
        start: new Date(Date.now() + 60_000),
        end: new Date(Date.now() + 120_000),
        location: "SGW EV Atrium",
        campus: "SGW",
        building: "EV",
        room: "Atrium",
        level: "",
      },
    ];

    expect(getNextClassFromItems(items)).toBeNull();
  });

  it("ignores earlier events and returns the next class from items", () => {
    const items: ScheduleItem[] = [
      {
        id: "event-soon",
        kind: "event",
        courseName: "Career Fair",
        start: new Date(Date.now() + 60_000),
        end: new Date(Date.now() + 120_000),
        location: "SGW EV Atrium",
        campus: "SGW",
        building: "EV",
        room: "Atrium",
        level: "",
      },
      {
        id: "class-later",
        kind: "class",
        courseName: "COMP 248",
        start: new Date(Date.now() + 3_600_000),
        end: new Date(Date.now() + 7_200_000),
        location: "SGW H 820",
        campus: "SGW",
        building: "H",
        room: "820",
        level: "8",
      },
    ];

    const next = getNextClassFromItems(items);

    expect(next).not.toBeNull();
    expect(next!.id).toBe("class-later");
  });

  it("falls back to title-based classification for legacy items without kind", () => {
    const items = [
      {
        id: "event-soon",
        courseName: "Family Day",
        start: new Date(Date.now() + 60_000),
        end: new Date(Date.now() + 120_000),
        location: "Canada",
        campus: "",
        building: "",
        room: "",
        level: "",
      },
      {
        id: "class-later",
        courseName: "COMP 248 LEC",
        start: new Date(Date.now() + 3_600_000),
        end: new Date(Date.now() + 7_200_000),
        location: "SGW H 820",
        campus: "SGW",
        building: "H",
        room: "820",
        level: "8",
      },
    ] as ScheduleItem[];

    const next = getNextClassFromItems(items);

    expect(next).not.toBeNull();
    expect(next!.id).toBe("class-later");
  });

  it("wraps around to earliest class when all are in the past", () => {
    const old1 = new Date("2020-01-01T10:00:00Z");
    const old2 = new Date("2020-06-01T10:00:00Z");

    const items: ScheduleItem[] = [
      {
        id: "old2",
        kind: "class",
        courseName: "COMP 200",
        start: old2,
        end: old2,
        location: "SGW MB 100",
        campus: "SGW",
        building: "MB",
        room: "100",
        level: "1",
      },
      {
        id: "old1",
        kind: "class",
        courseName: "COMP 100",
        start: old1,
        end: old1,
        location: "SGW H 200",
        campus: "SGW",
        building: "H",
        room: "200",
        level: "2",
      },
    ];

    const next = getNextClassFromItems(items);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("old1"); // earliest in schedule
  });

  it("still returns next upcoming class during an overlapping class", () => {
    const now = Date.now();
    // Class currently in progress
    const currentStart = new Date(now - 30 * 60_000);
    const currentEnd = new Date(now + 30 * 60_000);
    // Next class starting soon
    const nextStart = new Date(now + 10 * 60_000);
    const nextEnd = new Date(now + 70 * 60_000);

    const items: ScheduleItem[] = [
      {
        id: "current",
        kind: "class",
        courseName: "COMP 100",
        start: currentStart,
        end: currentEnd,
        location: "SGW H 200",
        campus: "SGW",
        building: "H",
        room: "200",
        level: "2",
      },
      {
        id: "next",
        kind: "class",
        courseName: "COMP 200",
        start: nextStart,
        end: nextEnd,
        location: "SGW MB 100",
        campus: "SGW",
        building: "MB",
        room: "100",
        level: "1",
      },
    ];

    const next = getNextClassFromItems(items);
    expect(next).not.toBeNull();
    expect(next!.id).toBe("next");
  });
});
