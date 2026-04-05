import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    clearCachedGoogleCalendarEvents,
    clearGoogleCalendarCache,
    filterVisibleCachedCalendars,
    isGoogleCalendarEventsCacheStale,
    isGoogleCalendarListCacheStale,
    loadCachedGoogleCalendarEvents,
    loadCachedGoogleCalendarEventsForIds,
    loadCachedGoogleCalendarList,
    mergeCachedCalendarEvents,
    mergeCachedCalendarListItems,
    saveCachedGoogleCalendarEvents,
    saveCachedGoogleCalendarList,
} from "../services/GoogleCalendarCacheStore";

function makeEvent(
  id: string,
  summary: string,
  overrides: Record<string, any> = {},
) {
  return {
    id,
    summary,
    start: { dateTime: "2026-01-06T09:00:00.000Z" },
    end: { dateTime: "2026-01-06T10:00:00.000Z" },
    ...overrides,
  };
}

describe("services/GoogleCalendarCacheStore", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("round-trips cached list and event entries and clears them together", async () => {
    await saveCachedGoogleCalendarList({
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "list-sync",
    });
    await saveCachedGoogleCalendarEvents({
      calendarId: "primary",
      events: [
        {
          ...makeEvent("event-1", "COMP 346 LEC"),
          sourceCalendarId: "primary",
        },
      ],
      lastSyncedAt: Date.now(),
      syncToken: "events-sync",
      windowStart: "2026-01-01T00:00:00.000Z",
      windowEnd: "2026-05-01T00:00:00.000Z",
    });

    expect(await loadCachedGoogleCalendarList()).not.toBeNull();
    expect(await loadCachedGoogleCalendarEvents("primary")).not.toBeNull();

    await clearGoogleCalendarCache();

    await expect(loadCachedGoogleCalendarList()).resolves.toBeNull();
    await expect(loadCachedGoogleCalendarEvents("primary")).resolves.toBeNull();
  });

  it("merges incremental event updates and removes cancelled entries", () => {
    const existing = [
      {
        ...makeEvent("event-1", "COMP 346 LEC"),
        sourceCalendarId: "primary",
      },
      {
        ...makeEvent("event-2", "SOEN 341 LEC"),
        sourceCalendarId: "primary",
      },
    ];

    const merged = mergeCachedCalendarEvents(
      existing,
      [
        makeEvent("event-1", "COMP 346 LAB"),
        makeEvent("event-2", "SOEN 341 LEC", { status: "cancelled" }),
        makeEvent("event-3", "Family Day"),
      ],
      "primary",
    );

    expect(merged).toHaveLength(2);
    expect(merged.find((event) => event.id === "event-1")?.summary).toBe(
      "COMP 346 LAB",
    );
    expect(merged.find((event) => event.id === "event-2")).toBeUndefined();
    expect(merged.find((event) => event.id === "event-3")?.sourceCalendarId).toBe(
      "primary",
    );
  });

  it("merges calendar list updates, keeps hidden calendars visible, and reports staleness", () => {
    const merged = mergeCachedCalendarListItems(
      [
        { id: "primary", summary: "Primary", primary: true },
        { id: "holidays", summary: "Holidays in Canada" },
      ],
      [
        { id: "holidays", summary: "Holidays in Canada", hidden: true },
        { id: "shared", summary: "Shared Calendar" },
      ],
    );

    expect(filterVisibleCachedCalendars(merged)).toEqual([
      { id: "primary", summary: "Primary", primary: true },
      { id: "holidays", summary: "Holidays in Canada", hidden: true },
      { id: "shared", summary: "Shared Calendar" },
    ]);

    expect(
      isGoogleCalendarListCacheStale({
        items: [],
        lastSyncedAt: 0,
        syncToken: null,
      }),
    ).toBe(true);
    expect(
      isGoogleCalendarEventsCacheStale({
        calendarId: "primary",
        events: [],
        lastSyncedAt: 0,
        syncToken: null,
        windowStart: "",
        windowEnd: "",
      }),
    ).toBe(true);
  });

  it("merges list items that are missing ids without crashing", () => {
    expect(
      mergeCachedCalendarListItems(
        [{ id: "primary", summary: "Primary" }],
        [{ id: "primary", summary: "Primary" }, { summary: "Missing id" } as any],
      ),
    ).toEqual([{ id: "primary", summary: "Primary" }]);
  });

  it("filters deleted calendars from visible cached lists", () => {
    expect(
      filterVisibleCachedCalendars([
        { id: "primary", summary: "Primary" },
        { id: "deleted", summary: "Deleted", deleted: true },
      ]),
    ).toEqual([{ id: "primary", summary: "Primary" }]);
  });

  it("reports stale when cache object is null", () => {
    expect(isGoogleCalendarListCacheStale(null)).toBe(true);
    expect(isGoogleCalendarEventsCacheStale(null)).toBe(true);
  });

  it("reports fresh caches as non-stale when within TTL", () => {
    expect(
      isGoogleCalendarListCacheStale(
        {
          items: [],
          lastSyncedAt: 10_000,
          syncToken: null,
        },
        10_001,
      ),
    ).toBe(false);

    expect(
      isGoogleCalendarEventsCacheStale(
        {
          calendarId: "primary",
          events: [],
          lastSyncedAt: 10_000,
          syncToken: null,
          windowStart: "",
          windowEnd: "",
        },
        10_001,
      ),
    ).toBe(false);
  });

  it("removes corrupt list payloads and returns null", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:list:v1",
      JSON.stringify({ items: "not-an-array", lastSyncedAt: "bad" }),
    );

    await expect(loadCachedGoogleCalendarList()).resolves.toBeNull();
    await expect(AsyncStorage.getItem("googleCalendarCache:list:v1")).resolves.toBeNull();
  });

  it("removes the list cache when reading it throws", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error("list failed"),
    );

    await expect(loadCachedGoogleCalendarList()).resolves.toBeNull();
    await expect(AsyncStorage.getItem("googleCalendarCache:list:v1")).resolves.toBeNull();
  });

  it("normalizes missing list syncToken to null", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:list:v1",
      JSON.stringify({ items: [{ id: "primary", summary: "Primary" }], lastSyncedAt: 1 }),
    );

    await expect(loadCachedGoogleCalendarList()).resolves.toEqual(
      expect.objectContaining({ syncToken: null }),
    );
  });

  it("removes corrupt event payloads and returns null", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:events:v1:primary",
      JSON.stringify({ calendarId: "primary", events: "bad", lastSyncedAt: "bad" }),
    );

    await expect(loadCachedGoogleCalendarEvents("primary")).resolves.toBeNull();
    await expect(AsyncStorage.getItem("googleCalendarCache:events:v1:primary")).resolves.toBeNull();
  });

  it("normalizes missing event fields and keeps fallback calendarId", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:events:v1:primary",
      JSON.stringify({
        events: [],
        lastSyncedAt: 10,
      }),
    );

    await expect(loadCachedGoogleCalendarEvents("primary")).resolves.toEqual(
      expect.objectContaining({
        calendarId: "primary",
        syncToken: null,
        windowStart: "",
        windowEnd: "",
      }),
    );
  });

  it("tolerates a corrupt calendar id index when saving events", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:calendarIds:v1",
      JSON.stringify("not-an-array"),
    );

    await saveCachedGoogleCalendarEvents({
      calendarId: "primary",
      events: [{ ...makeEvent("e-1", "Class"), sourceCalendarId: "primary" }],
      lastSyncedAt: Date.now(),
      syncToken: null,
      windowStart: "",
      windowEnd: "",
    });

    await expect(loadCachedGoogleCalendarEventsForIds(["primary"])).resolves.toHaveLength(1);
  });

  it("reuses the list cache cleanup path when loading the list throws", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error("list failed"),
    );

    await expect(loadCachedGoogleCalendarList()).resolves.toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("googleCalendarCache:list:v1");
    expect(AsyncStorage.getItem).toHaveBeenCalled();
  });

  it("recovers when the calendar id index cannot be read", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error("index failed"),
    );

    await expect(
      saveCachedGoogleCalendarEvents({
        calendarId: "fallback",
        events: [{ ...makeEvent("e-2", "Class"), sourceCalendarId: "fallback" }],
        lastSyncedAt: Date.now(),
        syncToken: null,
        windowStart: "",
        windowEnd: "",
      }),
    ).resolves.toBeUndefined();

    expect(AsyncStorage.getItem).toHaveBeenCalled();
  });

  it("removes a corrupted event cache when loading throws", async () => {
    (AsyncStorage.getItem as jest.Mock)
      .mockImplementationOnce(async () => {
        throw new Error("boom");
      })
      .mockResolvedValueOnce(null);
    await expect(loadCachedGoogleCalendarEvents("primary")).resolves.toBeNull();
    expect(AsyncStorage.getItem).toHaveBeenCalled();
    await expect(AsyncStorage.getItem("googleCalendarCache:events:v1:primary")).resolves.toBeNull();
  });

  it("loads cached events only for ids that exist", async () => {
    await saveCachedGoogleCalendarEvents({
      calendarId: "primary",
      events: [{ ...makeEvent("e-1", "Class"), sourceCalendarId: "primary" }],
      lastSyncedAt: Date.now(),
      syncToken: null,
      windowStart: "",
      windowEnd: "",
    });

    await expect(
      loadCachedGoogleCalendarEventsForIds(["primary", "missing"]),
    ).resolves.toHaveLength(1);
  });

  it("clears a single calendar cache and updates the index", async () => {
    await saveCachedGoogleCalendarEvents({
      calendarId: "primary",
      events: [{ ...makeEvent("e-1", "Class"), sourceCalendarId: "primary" }],
      lastSyncedAt: Date.now(),
      syncToken: null,
      windowStart: "",
      windowEnd: "",
    });
    await saveCachedGoogleCalendarEvents({
      calendarId: "work",
      events: [{ ...makeEvent("e-2", "Work"), sourceCalendarId: "work" }],
      lastSyncedAt: Date.now(),
      syncToken: null,
      windowStart: "",
      windowEnd: "",
    });

    await clearCachedGoogleCalendarEvents("primary");

    await expect(loadCachedGoogleCalendarEvents("primary")).resolves.toBeNull();
    await expect(loadCachedGoogleCalendarEvents("work")).resolves.not.toBeNull();
  });

  it("ignores events without id when merging incremental events", () => {
    const merged = mergeCachedCalendarEvents(
      [{ ...makeEvent("e-1", "Existing"), sourceCalendarId: "primary" }],
      [{ ...makeEvent("", "No id") }],
      "primary",
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("e-1");
  });

  it("uses originalStartTime and all-day start dates in event cache identities", () => {
    const merged = mergeCachedCalendarEvents(
      [],
      [
        {
          id: "recurring",
          summary: "Instance by originalStartTime date",
          originalStartTime: { date: "2026-01-06" },
          start: { date: "2026-01-06" },
          end: { date: "2026-01-07" },
        } as any,
        {
          id: "all-day",
          summary: "All day",
          start: { date: "2026-02-10" },
          end: { date: "2026-02-11" },
        } as any,
      ],
      "primary",
    );

    expect(merged).toHaveLength(2);
    expect(merged.map((event) => event.id)).toEqual(["recurring", "all-day"]);
    expect(merged.every((event) => event.sourceCalendarId === "primary")).toBe(true);
  });

  it("uses originalStartTime.dateTime and id-only identity fallback", () => {
    const merged = mergeCachedCalendarEvents(
      [{ ...makeEvent("standalone", "Old"), sourceCalendarId: "primary", start: undefined } as any],
      [
        {
          id: "recurring-dt",
          summary: "DateTime instance",
          originalStartTime: { dateTime: "2026-01-06T09:00:00.000Z" },
          start: { dateTime: "2026-01-06T09:00:00.000Z" },
          end: { dateTime: "2026-01-06T10:00:00.000Z" },
        } as any,
        {
          id: "standalone",
          summary: "Updated without occurrence key",
          start: undefined,
          end: undefined,
        } as any,
      ],
      "primary",
    );

    expect(merged.find((event) => event.id === "recurring-dt")?.sourceCalendarId).toBe(
      "primary",
    );
    expect(merged.find((event) => event.id === "standalone")?.summary).toBe(
      "Updated without occurrence key",
    );
  });

  it("does not duplicate calendar ids when saving an already-indexed cache", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:calendarIds:v1",
      JSON.stringify(["primary"]),
    );

    await saveCachedGoogleCalendarEvents({
      calendarId: "primary",
      events: [{ ...makeEvent("e-1", "Class"), sourceCalendarId: "primary" }],
      lastSyncedAt: Date.now(),
      syncToken: null,
      windowStart: "",
      windowEnd: "",
    });

    await expect(AsyncStorage.getItem("googleCalendarCache:calendarIds:v1")).resolves.toBe(
      JSON.stringify(["primary"]),
    );
  });

  it("keeps the calendar id index unchanged when clearing a non-indexed calendar", async () => {
    await AsyncStorage.setItem(
      "googleCalendarCache:calendarIds:v1",
      JSON.stringify(["work"]),
    );

    await clearCachedGoogleCalendarEvents("primary");

    await expect(AsyncStorage.getItem("googleCalendarCache:calendarIds:v1")).resolves.toBe(
      JSON.stringify(["work"]),
    );
  });

  it("drops deleted calendars during list merge", () => {
    const merged = mergeCachedCalendarListItems(
      [{ id: "primary", summary: "Primary" }],
      [{ id: "primary", summary: "Primary", deleted: true }],
    );

    expect(merged).toEqual([]);
  });
});
