import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { AppState } from "react-native";
import ScheduleScreen from "../app/schedule";
import { GoogleCalendarApiError } from "../services/GoogleCalendarService";

const mockUseGoogleCalendarAuth = jest.fn();
jest.mock("../services/GoogleAuthService", () => ({
  useGoogleCalendarAuth: (...args: any[]) => mockUseGoogleCalendarAuth(...args),
}));

const mockGetGoogleAccessToken = jest.fn();
const mockSaveGoogleAccessToken = jest.fn();
const mockDeleteGoogleAccessToken = jest.fn();
const mockIsTokenLikelyExpired = jest.fn();
jest.mock("../services/TokenStore", () => ({
  getGoogleAccessToken: (...args: any[]) => mockGetGoogleAccessToken(...args),
  saveGoogleAccessToken: (...args: any[]) => mockSaveGoogleAccessToken(...args),
  deleteGoogleAccessToken: (...args: any[]) => mockDeleteGoogleAccessToken(...args),
  isTokenLikelyExpired: (...args: any[]) => mockIsTokenLikelyExpired(...args),
}));

const mockGetSelectedCalendarIds = jest.fn();
const mockSaveSelectedCalendarIds = jest.fn();
const mockClearSelectedCalendarIds = jest.fn();
jest.mock("../services/SelectedCalendarsStore", () => ({
  getSelectedCalendarIds: (...args: any[]) => mockGetSelectedCalendarIds(...args),
  saveSelectedCalendarIds: (...args: any[]) => mockSaveSelectedCalendarIds(...args),
  clearSelectedCalendarIds: (...args: any[]) => mockClearSelectedCalendarIds(...args),
}));

const mockSyncCalendarList = jest.fn();
const mockSyncCalendarEvents = jest.fn();
jest.mock("../services/GoogleCalendarService", () => {
  const actual = jest.requireActual("../services/GoogleCalendarService");

  return {
    ...actual,
    syncCalendarList: (...args: any[]) => mockSyncCalendarList(...args),
    syncCalendarEvents: (...args: any[]) => mockSyncCalendarEvents(...args),
  };
});

const mockParseCourseEvents = jest.fn();
const mockLoadCachedSchedule = jest.fn();
const mockSaveSchedule = jest.fn();
const mockGetNextClass = jest.fn();
jest.mock("../utils/parseCourseEvents", () => ({
  parseCourseEvents: (...args: any[]) => mockParseCourseEvents(...args),
  loadCachedSchedule: (...args: any[]) => mockLoadCachedSchedule(...args),
  saveSchedule: (...args: any[]) => mockSaveSchedule(...args),
  getNextClass: (...args: any[]) => mockGetNextClass(...args),
}));

let cachedCalendarList: any = null;
let cachedEventsByCalendar: Record<string, any> = {};

const mockLoadCachedGoogleCalendarList = jest.fn();
const mockSaveCachedGoogleCalendarList = jest.fn();
const mockLoadCachedGoogleCalendarEvents = jest.fn();
const mockLoadCachedGoogleCalendarEventsForIds = jest.fn();
const mockSaveCachedGoogleCalendarEvents = jest.fn();
const mockClearCachedGoogleCalendarEvents = jest.fn();
const mockClearGoogleCalendarCache = jest.fn();
const mockIsGoogleCalendarEventsCacheStale = jest.fn();
const mockIsGoogleCalendarListCacheStale = jest.fn();
const mockFilterVisibleCachedCalendars = jest.fn();
const mockMergeCachedCalendarEvents = jest.fn();
const mockMergeCachedCalendarListItems = jest.fn();

jest.mock("../services/GoogleCalendarCacheStore", () => ({
  loadCachedGoogleCalendarList: (...args: any[]) =>
    mockLoadCachedGoogleCalendarList(...args),
  saveCachedGoogleCalendarList: (...args: any[]) =>
    mockSaveCachedGoogleCalendarList(...args),
  loadCachedGoogleCalendarEvents: (...args: any[]) =>
    mockLoadCachedGoogleCalendarEvents(...args),
  loadCachedGoogleCalendarEventsForIds: (...args: any[]) =>
    mockLoadCachedGoogleCalendarEventsForIds(...args),
  saveCachedGoogleCalendarEvents: (...args: any[]) =>
    mockSaveCachedGoogleCalendarEvents(...args),
  clearCachedGoogleCalendarEvents: (...args: any[]) =>
    mockClearCachedGoogleCalendarEvents(...args),
  clearGoogleCalendarCache: (...args: any[]) => mockClearGoogleCalendarCache(...args),
  isGoogleCalendarEventsCacheStale: (...args: any[]) =>
    mockIsGoogleCalendarEventsCacheStale(...args),
  isGoogleCalendarListCacheStale: (...args: any[]) =>
    mockIsGoogleCalendarListCacheStale(...args),
  filterVisibleCachedCalendars: (...args: any[]) =>
    mockFilterVisibleCachedCalendars(...args),
  mergeCachedCalendarEvents: (...args: any[]) =>
    mockMergeCachedCalendarEvents(...args),
  mergeCachedCalendarListItems: (...args: any[]) =>
    mockMergeCachedCalendarListItems(...args),
}));

jest.mock("../components/ScheduleCalendar", () => {
  const React = require("react");
  const { View, Text } = require("react-native");

  return function MockScheduleCalendar(props: any) {
    return (
      <View testID="schedule-calendar">
        <Text testID="calendar-items-count">{props.items?.length ?? 0}</Text>
      </View>
    );
  };
});

jest.mock("../constants/theme", () => ({
  colors: {
    white: "#fff",
    primaryDark: "#000",
    gray700: "#777",
    gray300: "#ccc",
    error: "#f00",
  },
  spacing: { lg: 16, md: 12 },
  typography: { title: {}, button: {} },
}));

const mockMaybeCompleteAuthSession = jest.fn();
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: (...args: any[]) =>
    mockMaybeCompleteAuthSession(...args),
}));

const mockAddEventListener = jest.fn();
const mockGetInitialURL = jest.fn();
jest.mock("expo-linking", () => ({
  addEventListener: (...args: any[]) => mockAddEventListener(...args),
  getInitialURL: (...args: any[]) => mockGetInitialURL(...args),
}));

let appStateChangeHandler: ((nextState: string) => void) | null = null;

function defer<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function makeEvent(
  id: string,
  summary: string,
  start = "2026-01-06T09:00:00.000Z",
  end = "2026-01-06T10:00:00.000Z",
) {
  return {
    id,
    summary,
    start: { dateTime: start },
    end: { dateTime: end },
    location: "SGW - H 920",
  };
}

function makeCalendarCache(calendarId: string, events: any[], overrides: Partial<any> = {}) {
  return {
    calendarId,
    events: events.map((event) => ({
      ...event,
      sourceCalendarId: calendarId,
    })),
    lastSyncedAt: Date.now(),
    syncToken: `${calendarId}-sync`,
    windowStart: "2026-01-01T00:00:00.000Z",
    windowEnd: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function dedupeKey(event: any) {
  const occurrenceKey =
    event.originalStartTime?.dateTime ??
    event.originalStartTime?.date ??
    event.start?.dateTime ??
    event.start?.date ??
    "";
  return occurrenceKey ? `${event.id}::${occurrenceKey}` : event.id;
}

function makeScheduleItem(overrides: Partial<any> = {}) {
  return {
    id: "item-1",
    kind: "class",
    courseName: "COMP 346 LEC",
    start: new Date("2026-01-06T09:00:00.000Z"),
    end: new Date("2026-01-06T10:00:00.000Z"),
    location: "SGW - H 920",
    campus: "SGW",
    building: "H",
    room: "920",
    level: "9",
    ...overrides,
  };
}

describe("ScheduleScreen caching flow", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    cachedCalendarList = null;
    cachedEventsByCalendar = {};
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    appStateChangeHandler = null;

    (AppState as any).currentState = "active";
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event: any, handler: any) => {
        appStateChangeHandler = handler;
        return { remove: jest.fn() } as any;
      });

    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn().mockResolvedValue(undefined),
      getResultFromResponse: jest.fn().mockReturnValue(null),
      response: null,
    });

    mockGetGoogleAccessToken.mockResolvedValue({
      accessToken: "TOKEN",
      meta: { issuedAt: 10, expiresIn: 3600 },
    });
    mockIsTokenLikelyExpired.mockReturnValue(false);
    mockSaveGoogleAccessToken.mockResolvedValue(undefined);
    mockDeleteGoogleAccessToken.mockResolvedValue(undefined);

    mockGetSelectedCalendarIds.mockResolvedValue(["primary"]);
    mockSaveSelectedCalendarIds.mockResolvedValue(undefined);
    mockClearSelectedCalendarIds.mockResolvedValue(undefined);

    mockLoadCachedSchedule.mockResolvedValue(null);
    mockSaveSchedule.mockResolvedValue(undefined);
    mockGetNextClass.mockResolvedValue(null);
    mockParseCourseEvents.mockImplementation((events: any[]) =>
      events.map((event, index) => ({
        id: event.id ?? `item-${index}`,
        kind: /\b(LEC|TUT|LAB)\b/i.test(event.summary ?? "") ? "class" : "event",
        courseName: event.summary ?? "Untitled",
        start: new Date(event.start?.dateTime ?? event.start?.date ?? "2026-01-01T00:00:00.000Z"),
        end: new Date(event.end?.dateTime ?? event.end?.date ?? "2026-01-01T01:00:00.000Z"),
        location: event.location ?? "",
        campus: "SGW",
        building: "H",
        room: "920",
        level: "9",
      })),
    );

    mockLoadCachedGoogleCalendarList.mockImplementation(async () => cachedCalendarList);
    mockSaveCachedGoogleCalendarList.mockImplementation(async (cache) => {
      cachedCalendarList = cache;
    });
    mockLoadCachedGoogleCalendarEvents.mockImplementation(
      async (calendarId: string) => cachedEventsByCalendar[calendarId] ?? null,
    );
    mockLoadCachedGoogleCalendarEventsForIds.mockImplementation(
      async (calendarIds: string[]) =>
        calendarIds
          .map((calendarId) => cachedEventsByCalendar[calendarId] ?? null)
          .filter(Boolean),
    );
    mockSaveCachedGoogleCalendarEvents.mockImplementation(async (cache) => {
      cachedEventsByCalendar[cache.calendarId] = cache;
    });
    mockClearCachedGoogleCalendarEvents.mockImplementation(async (calendarId: string) => {
      delete cachedEventsByCalendar[calendarId];
    });
    mockClearGoogleCalendarCache.mockImplementation(async () => {
      cachedCalendarList = null;
      cachedEventsByCalendar = {};
    });
    mockIsGoogleCalendarEventsCacheStale.mockImplementation(
      (entry: any) => !entry || entry.lastSyncedAt === 0,
    );
    mockIsGoogleCalendarListCacheStale.mockImplementation(
      (entry: any) => !entry || entry.lastSyncedAt === 0,
    );
    mockFilterVisibleCachedCalendars.mockImplementation((items: any[]) =>
      items.filter((item) => !item.deleted),
    );
    mockMergeCachedCalendarEvents.mockImplementation(
      (existing: any[], incoming: any[], calendarId: string) => {
        const merged = new Map(existing.map((event) => [dedupeKey(event), event]));

        for (const event of incoming) {
          const key = dedupeKey(event);
          if (!key) continue;

          if (event.status === "cancelled") {
            merged.delete(key);
            continue;
          }

          merged.set(key, {
            ...event,
            sourceCalendarId: calendarId,
          });
        }

        return Array.from(merged.values());
      },
    );
    mockMergeCachedCalendarListItems.mockImplementation(
      (existing: any[], incoming: any[]) => {
        const merged = new Map(existing.map((item) => [item.id, item]));

        for (const item of incoming) {
          if (item.deleted) {
            merged.delete(item.id);
            continue;
          }

          merged.set(item.id, item);
        }

        return Array.from(merged.values());
      },
    );

    mockSyncCalendarList.mockResolvedValue({
      items: [],
      nextSyncToken: "calendar-list-sync",
    });
    mockSyncCalendarEvents.mockResolvedValue({
      items: [],
      nextSyncToken: "events-sync",
    });

    mockAddEventListener.mockReturnValue({ remove: jest.fn() });
    mockGetInitialURL.mockResolvedValue(null);
  });

  it("renders from warm cached calendars without hitting the events API", async () => {
    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("event-1", "COMP 346 LEC"),
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });

    expect(mockSyncCalendarEvents).not.toHaveBeenCalled();
    expect(screen.getByText("Disconnect")).toBeTruthy();
  });

  it("filters cached events with invalid dates before building the schedule", async () => {
    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("event-1", "COMP 346 LEC"),
      {
        ...makeEvent("event-invalid", "Broken Event"),
        start: { dateTime: "not-a-date" },
      },
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });
  });

  it("auto-selects the first available calendar when no primary calendar exists", async () => {
    mockGetSelectedCalendarIds.mockResolvedValueOnce([]);
    cachedCalendarList = {
      items: [
        { id: "holidays", summary: "Holidays in Canada" },
        { id: "shared", summary: "Shared Calendar" },
      ],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.holidays = makeCalendarCache("holidays", [
      makeEvent("holiday-1", "Family Day"),
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockSaveSelectedCalendarIds).toHaveBeenCalledWith(["holidays"]);
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });
  });

  it("trims stale selected calendars when the synced list removes them", async () => {
    mockGetSelectedCalendarIds.mockResolvedValueOnce(["primary", "missing"]);
    cachedCalendarList = {
      items: [
        { id: "primary", summary: "Primary", primary: true },
        { id: "missing", summary: "Removed Calendar" },
      ],
      lastSyncedAt: 0,
      syncToken: null,
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);
    mockSyncCalendarList.mockResolvedValueOnce({
      items: [{ id: "primary", summary: "Primary", primary: true }],
      nextSyncToken: "calendar-list-sync-2",
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockSaveSelectedCalendarIds).toHaveBeenCalledWith(["primary"]);
    });
  });

  it("keeps hidden holiday calendars available in the selector", async () => {
    cachedCalendarList = {
      items: [
        { id: "primary", summary: "Primary", primary: true },
        { id: "holidays", summary: "Holidays in Canada", hidden: true },
      ],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);
    cachedEventsByCalendar.holidays = makeCalendarCache("holidays", [
      makeEvent("holiday-1", "Family Day"),
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Holidays in Canada")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Holidays in Canada"));

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    });
  });

  it("switches between already-cached calendars without refetching", async () => {
    cachedCalendarList = {
      items: [
        { id: "primary", summary: "Primary", primary: true },
        { id: "holidays", summary: "Holidays in Canada" },
      ],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);
    cachedEventsByCalendar.holidays = makeCalendarCache("holidays", [
      makeEvent("holiday-1", "Family Day"),
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });

    fireEvent.press(screen.getByText("Holidays in Canada"));

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    });

    expect(mockSyncCalendarEvents).not.toHaveBeenCalled();
  });

  it("shows loading and then an error when the first schedule sync fails without cache", async () => {
    const sync = defer<{ items: any[]; nextSyncToken: string }>();
    void sync.promise.catch(() => {});

    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    mockSyncCalendarEvents.mockReturnValueOnce(sync.promise);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Loading your schedule...")).toBeTruthy();
    });

    await act(async () => {
      sync.reject(new Error("Network boom"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Network boom")).toBeTruthy();
      expect(screen.getByText("Try Again")).toBeTruthy();
    });
  });

  it("fetches an uncached calendar once and then reuses its cache on later toggles", async () => {
    cachedCalendarList = {
      items: [
        { id: "primary", summary: "Primary", primary: true },
        { id: "holidays", summary: "Holidays in Canada" },
      ],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);
    mockSyncCalendarEvents.mockResolvedValueOnce({
      items: [makeEvent("holiday-1", "Family Day")],
      nextSyncToken: "holidays-sync",
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });

    fireEvent.press(screen.getByText("Holidays in Canada"));

    await waitFor(() => {
      expect(mockSyncCalendarEvents).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    });

    fireEvent.press(screen.getByText("Holidays in Canada"));
    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });

    fireEvent.press(screen.getByText("Holidays in Canada"));
    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    });

    expect(mockSyncCalendarEvents).toHaveBeenCalledTimes(1);
  });

  it("renders the empty state when all calendars are deselected", async () => {
    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });

    fireEvent.press(screen.getByText("Primary"));

    await waitFor(() => {
      expect(screen.getByText("No events found in this semester window.")).toBeTruthy();
    });

    expect(mockSaveSchedule).toHaveBeenCalledWith([]);
  });

  it("shows stale cached data first and then updates after background refresh", async () => {
    const sync = defer<{ items: any[]; nextSyncToken: string }>();

    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache(
      "primary",
      [makeEvent("class-1", "Old Course LEC")],
      { lastSyncedAt: 0 },
    );
    mockSyncCalendarEvents.mockReturnValueOnce(sync.promise);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });
    expect(mockSyncCalendarEvents).toHaveBeenCalledTimes(1);

    await act(async () => {
      sync.resolve({
        items: [
          makeEvent("class-1", "Old Course LEC"),
          makeEvent("class-2", "New Event"),
        ],
        nextSyncToken: "primary-sync-2",
      });
      await sync.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    });
  });

  it("revalidates calendars and schedule when the app returns to the foreground", async () => {
    (AppState as any).currentState = "background";

    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });

    cachedCalendarList.lastSyncedAt = 0;
    cachedEventsByCalendar.primary.lastSyncedAt = 0;
    mockSyncCalendarList.mockResolvedValueOnce({
      items: [{ id: "primary", summary: "Primary", primary: true }],
      nextSyncToken: "calendar-list-sync-2",
    });
    mockSyncCalendarEvents.mockResolvedValueOnce({
      items: [
        makeEvent("class-1", "COMP 346 LEC"),
        makeEvent("class-2", "COMP 445 LEC"),
      ],
      nextSyncToken: "events-sync-2",
    });

    await act(async () => {
      appStateChangeHandler?.("active");
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockSyncCalendarList).toHaveBeenCalledTimes(1);
      expect(mockSyncCalendarEvents).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    });
  });

  it("falls back to a full sync when Google rejects the incremental sync token", async () => {
    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache(
      "primary",
      [makeEvent("class-1", "COMP 346 LEC")],
      { lastSyncedAt: 0, syncToken: "bad-sync-token" },
    );

    mockSyncCalendarEvents
      .mockRejectedValueOnce(
        new GoogleCalendarApiError("Events sync failed (410): Gone", 410),
      )
      .mockResolvedValueOnce({
        items: [makeEvent("class-2", "COMP 445 LEC")],
        nextSyncToken: "primary-sync-2",
      });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockClearCachedGoogleCalendarEvents).toHaveBeenCalledWith("primary");
      expect(mockSyncCalendarEvents).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
  });

  it("stays idle when there is no saved token and no cached schedule", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: null,
      meta: null,
    });
    mockLoadCachedSchedule.mockResolvedValueOnce(null);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
    });
  });

  it("deletes expired saved tokens during initialization", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "EXPIRED_TOKEN",
      meta: { issuedAt: 0, expiresIn: 1 },
    });
    mockIsTokenLikelyExpired.mockReturnValueOnce(true);
    mockLoadCachedSchedule.mockResolvedValueOnce(null);

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockDeleteGoogleAccessToken).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
    });
  });

  it("shows an initialization error if bootstrapping schedule state fails", async () => {
    mockLoadCachedSchedule.mockRejectedValueOnce(new Error("Init failed"));

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Init failed")).toBeTruthy();
    });
  });

  it("keeps the ready state when OAuth is cancelled after cached data is shown", async () => {
    mockLoadCachedSchedule.mockResolvedValueOnce([makeScheduleItem()]);
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: null,
      meta: null,
    });
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn().mockResolvedValue(undefined),
      getResultFromResponse: jest.fn().mockReturnValue({
        ok: false,
        reason: "cancelled",
      }),
      response: { type: "cancel" },
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });
  });

  it("shows an OAuth error message when auth response fails", async () => {
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn().mockResolvedValue(undefined),
      getResultFromResponse: jest.fn().mockReturnValue({
        ok: false,
        message: "Login exploded",
      }),
      response: { type: "error" },
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Login exploded")).toBeTruthy();
    });
  });

  it("persists the access token when OAuth succeeds", async () => {
    cachedCalendarList = {
      items: [{ id: "primary", summary: "Primary", primary: true }],
      lastSyncedAt: Date.now(),
      syncToken: "calendar-list-sync",
    };
    cachedEventsByCalendar.primary = makeCalendarCache("primary", [
      makeEvent("class-1", "COMP 346 LEC"),
    ]);
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn().mockResolvedValue(undefined),
      getResultFromResponse: jest.fn().mockReturnValue({
        ok: true,
        accessToken: "NEW_TOKEN",
        issuedAt: 123,
        expiresIn: 3600,
      }),
      response: { type: "success" },
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockSaveGoogleAccessToken).toHaveBeenCalledWith("NEW_TOKEN", {
        issuedAt: 123,
        expiresIn: 3600,
      });
    });
  });

  it("shows a connect error when promptAsync throws without a message", async () => {
    const promptAsync = jest.fn().mockRejectedValueOnce({});
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: null,
      meta: null,
    });
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync,
      getResultFromResponse: jest.fn().mockReturnValue({
        ok: false,
        message: "Auth blew up",
      }),
      response: { type: "error" },
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Auth blew up")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Connect Google Calendar"));

    await waitFor(() => {
      expect(promptAsync).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Could not start login.")).toBeTruthy();
    });
  });

  it("uses the connect path when refresh is pressed without an access token", async () => {
    const promptAsync = jest.fn().mockResolvedValue(undefined);
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: null,
      meta: null,
    });
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync,
      getResultFromResponse: jest.fn().mockReturnValue({
        ok: false,
        message: "Login exploded",
      }),
      response: { type: "error" },
    });

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Login exploded")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Connect Google Calendar"));

    await waitFor(() => {
      expect(promptAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("disconnect clears token, schedule cache, selection cache, and Google cache", async () => {
    const removeItemSpy = jest
      .spyOn(AsyncStorage, "removeItem")
      .mockResolvedValue(undefined);

    try {
      cachedCalendarList = {
        items: [{ id: "primary", summary: "Primary", primary: true }],
        lastSyncedAt: Date.now(),
        syncToken: "calendar-list-sync",
      };
      cachedEventsByCalendar.primary = makeCalendarCache("primary", [
        makeEvent("class-1", "COMP 346 LEC"),
      ]);

      render(<ScheduleScreen />);

      await waitFor(() => {
        expect(screen.getByText("Disconnect")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Disconnect"));

      await waitFor(() => {
        expect(mockDeleteGoogleAccessToken).toHaveBeenCalledTimes(1);
        expect(mockClearSelectedCalendarIds).toHaveBeenCalledTimes(1);
        expect(mockClearGoogleCalendarCache).toHaveBeenCalledTimes(1);
        expect(removeItemSpy).toHaveBeenCalledWith("scheduleItems");
        expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
      });
    } finally {
      removeItemSpy.mockRestore();
    }
  });
});
