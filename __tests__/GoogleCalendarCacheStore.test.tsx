import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearGoogleCalendarCache,
  filterVisibleCachedCalendars,
  isGoogleCalendarEventsCacheStale,
  isGoogleCalendarListCacheStale,
  loadCachedGoogleCalendarEvents,
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
});
