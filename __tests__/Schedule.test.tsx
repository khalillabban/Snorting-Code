import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import ScheduleScreen from "../app/schedule";

// -------------------- Mocks --------------------
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

const mockFetchCalendarEventsInRange = jest.fn();
jest.mock("../services/GoogleCalendarService", () => ({
  fetchCalendarEventsInRange: (...args: any[]) =>
    mockFetchCalendarEventsInRange(...args),
}));

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

// ScheduleCalendar component mock
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

// Theme constants mock
jest.mock("../constants/theme", () => ({
  colors: {
    white: "#fff",
    primaryDark: "#000",
    primaryDark2: "#111",
    gray700: "#777",
    error: "#f00",
  },
  spacing: { lg: 16, md: 12 },
  typography: { title: {}, button: {} },
}));

// expo-web-browser mock
const mockMaybeCompleteAuthSession = jest.fn();
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: (...args: any[]) =>
    mockMaybeCompleteAuthSession(...args),
}));

// expo-linking mock
const mockAddEventListener = jest.fn();
const mockGetInitialURL = jest.fn();

let urlHandler: ((e: { url: string }) => void) | null = null;
const removeSpy = jest.fn();

jest.mock("expo-linking", () => ({
  addEventListener: (...args: any[]) => mockAddEventListener(...args),
  getInitialURL: (...args: any[]) => mockGetInitialURL(...args),
}));

function defer<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ScheduleScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    urlHandler = null;
    removeSpy.mockClear();

    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn().mockResolvedValue(undefined),
      getResultFromResponse: jest.fn().mockReturnValue(null),
      response: null,
    });

    mockGetGoogleAccessToken.mockResolvedValue({ accessToken: null, meta: null });
    mockIsTokenLikelyExpired.mockReturnValue(false);

    mockFetchCalendarEventsInRange.mockResolvedValue([]);
    mockParseCourseEvents.mockReturnValue([]);
    mockLoadCachedSchedule.mockResolvedValue(null);
    mockSaveSchedule.mockResolvedValue(undefined);
    mockGetNextClass.mockResolvedValue(null);

    mockSaveGoogleAccessToken.mockResolvedValue(undefined);

    mockAddEventListener.mockImplementation((_evt: string, handler: any) => {
      urlHandler = handler;
      return { remove: removeSpy };
    });

    mockGetInitialURL.mockResolvedValue(null);
  });

  it("renders idle state with connect button when request exists", () => {
    const screen = render(<ScheduleScreen />);
    expect(screen.getByText("My Schedule")).toBeTruthy();
    expect(
      screen.getByText(
        "Connect Google Calendar to import your course schedule (exported from Concordia Schedule Builder).",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
  });

  it("connect button is disabled when request is null", () => {
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: null,
      promptAsync: jest.fn(),
      getResultFromResponse: jest.fn().mockReturnValue(null),
      response: null,
    });

    const screen = render(<ScheduleScreen />);
    const btn = screen.getByText("Connect Google Calendar").parent as any;

    // Pressing should do nothing because disabled=true
    fireEvent.press(btn);
    expect(mockUseGoogleCalendarAuth().promptAsync).not.toHaveBeenCalled();
  });

  it("pressing connect sets connecting UI and calls promptAsync", async () => {
    const promptAsync = jest.fn().mockResolvedValue(undefined);
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync,
      getResultFromResponse: jest.fn().mockReturnValue(null),
      response: null,
    });

    const screen = render(<ScheduleScreen />);
    fireEvent.press(screen.getByText("Connect Google Calendar"));

    expect(promptAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Connecting…")).toBeTruthy();
  });

  it("connect() error uses fallback message when error has no message", async () => {
    const promptAsync = jest.fn().mockRejectedValueOnce({});
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync,
      getResultFromResponse: jest.fn().mockReturnValue(null),
      response: null,
    });

    const screen = render(<ScheduleScreen />);
    fireEvent.press(screen.getByText("Connect Google Calendar"));

    await waitFor(() => {
      expect(screen.getByText("Could not start login.")).toBeTruthy();
    });
  });

  it("handles deep link event for oauthredirect by completing auth session", async () => {
    render(<ScheduleScreen />);
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);
    expect(typeof urlHandler).toBe("function");

    act(() => {
      urlHandler?.({ url: "myapp://oauthredirect?code=123" });
    });

    expect(mockMaybeCompleteAuthSession).toHaveBeenCalledTimes(1);
  });

  it("handles cold start initial URL for oauthredirect by completing auth session", async () => {
    mockGetInitialURL.mockResolvedValueOnce("myapp://oauthredirect?code=123");

    render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockMaybeCompleteAuthSession).toHaveBeenCalledTimes(1);
    });
  });

  it("removes linking subscription on unmount (cleanup branch)", () => {
    const screen = render(<ScheduleScreen />);
    screen.unmount();
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("loads a saved valid token on mount and renders ready state", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "SAVED_TOKEN",
      meta: { any: "meta" },
    });
    mockIsTokenLikelyExpired.mockReturnValueOnce(false);

    mockFetchCalendarEventsInRange.mockResolvedValueOnce([{ id: "1" }]);
    mockParseCourseEvents.mockReturnValueOnce([{ id: "a" }, { id: "b" }]);

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("schedule-calendar")).toBeTruthy();
    expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
    expect(screen.getByText("Disconnect")).toBeTruthy();
  });

  it("if saved token is expired, deletes it and stays idle", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "EXPIRED_TOKEN",
      meta: { issuedAt: 0 },
    });
    mockIsTokenLikelyExpired.mockReturnValueOnce(true);

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockDeleteGoogleAccessToken).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
    expect(mockFetchCalendarEventsInRange).not.toHaveBeenCalled();
  });

  it("shows loading UI while fetching schedule", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "TOKEN",
      meta: { any: "meta" },
    });

    const d = defer<any[]>();
    mockFetchCalendarEventsInRange.mockReturnValueOnce(d.promise);
    mockParseCourseEvents.mockReturnValueOnce([{ id: "x" }]);

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Loading your schedule…")).toBeTruthy();
    });

    await act(async () => {
      d.resolve([{ id: "1" } as any]);
      await d.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
    });
  });

  it("OAuth cancelled keeps UI idle (cancelled branch)", async () => {
    const getResultFromResponse = jest.fn().mockReturnValue({
      ok: false,
      reason: "cancelled",
    });

    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn(),
      getResultFromResponse,
      response: { type: "dismiss" },
    });

    const screen = render(<ScheduleScreen />);
    expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
  });

  it("OAuth failure shows error message and button triggers connect() when no token", async () => {
    const promptAsync = jest.fn().mockResolvedValue(undefined);
    const getResultFromResponse = jest.fn().mockReturnValue({
      ok: false,
      reason: "failed",
      message: "Login failed hard",
    });

    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync,
      getResultFromResponse,
      response: { type: "error" },
    });

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Login failed hard")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Connect Google Calendar"));

    await waitFor(() => {
      expect(promptAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("OAuth success saves token (including catch branch) and loads schedule", async () => {
    const getResultFromResponse = jest.fn().mockReturnValue({
      ok: true,
      accessToken: "NEW_TOKEN",
      issuedAt: 123,
      expiresIn: 3600,
    });

    mockSaveGoogleAccessToken.mockRejectedValueOnce(new Error("store failed")); // covers .catch(() => {})
    mockUseGoogleCalendarAuth.mockReturnValue({
      request: { dummy: true },
      promptAsync: jest.fn(),
      getResultFromResponse,
      response: { type: "success" },
    });

    mockFetchCalendarEventsInRange.mockResolvedValueOnce([{ id: "1" }]);
    mockParseCourseEvents.mockReturnValueOnce([{ id: "x" }]);

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(mockSaveGoogleAccessToken).toHaveBeenCalledWith("NEW_TOKEN", {
        issuedAt: 123,
        expiresIn: 3600,
      });
    });

    await waitFor(() => {
      expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("calendar-items-count").props.children).toBe(1);
  });

  it("shows empty state and refresh triggers loadSchedule again", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "TOKEN",
      meta: { any: "meta" },
    });

    mockFetchCalendarEventsInRange.mockResolvedValue([{ id: "1" }]);
    mockParseCourseEvents.mockReturnValue([]); // empty

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("No events found in this semester window.")).toBeTruthy();
    });

    expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("Refresh"));

    await waitFor(() => {
      expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(2);
    });
  });

  it("loadSchedule error renders error UI with Try Again + Disconnect (token exists), and Try Again reloads", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "TOKEN",
      meta: { any: "meta" },
    });

    mockFetchCalendarEventsInRange.mockRejectedValueOnce(new Error("Fetch blew up"));

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Fetch blew up")).toBeTruthy();
    });

    // With token present -> button says "Try Again"
    expect(screen.getByText("Try Again")).toBeTruthy();
    expect(screen.getAllByText("Disconnect").length).toBeGreaterThan(0);

    // Next reload succeeds into empty (or ready)
    mockFetchCalendarEventsInRange.mockResolvedValueOnce([{ id: "1" }]);
    mockParseCourseEvents.mockReturnValueOnce([{ id: "x" }]);

    fireEvent.press(screen.getByText("Try Again"));

    await waitFor(() => {
      expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(2);
    });
  });

  it("disconnect deletes token and returns to idle UI (finally branch)", async () => {
    mockGetGoogleAccessToken.mockResolvedValueOnce({
      accessToken: "TOKEN",
      meta: { any: "meta" },
    });

    mockFetchCalendarEventsInRange.mockResolvedValueOnce([{ id: "1" }]);
    mockParseCourseEvents.mockReturnValueOnce([{ id: "a" }]);

    const screen = render(<ScheduleScreen />);

    await waitFor(() => {
      expect(screen.getByText("Disconnect")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Disconnect"));

    await waitFor(() => {
      expect(mockDeleteGoogleAccessToken).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
    });
  });

  it("shows an error when secure store read fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });

    try {
      mockGetGoogleAccessToken.mockRejectedValueOnce(
        new Error("secure store broke"),
      );

      const screen = render(<ScheduleScreen />);

      expect(await screen.findByText("secure store broke")).toBeTruthy();
      expect(mockFetchCalendarEventsInRange).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});