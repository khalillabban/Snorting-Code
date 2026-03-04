// __tests__/Schedule.test.tsx
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import ScheduleScreen from "../app/schedule";

// --- Mocks ---
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
jest.mock("../utils/parseCourseEvents", () => ({
    parseCourseEvents: (...args: any[]) => mockParseCourseEvents(...args),
}));

// ✅ FIX: require RN components INSIDE the factory so nothing is "out of scope"
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

// Theme constants are styles only; keep lightweight.
jest.mock("../constants/theme", () => ({
    colors: {
        white: "#fff",
        primaryDark: "#000",
        gray700: "#777",
        error: "#f00",
    },
    spacing: { lg: 16, md: 12 },
    typography: { title: {}, button: {} },
}));

describe("ScheduleScreen", () => {
    // inside beforeEach()
    beforeEach(() => {
        jest.clearAllMocks();

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

        // ✅ IMPORTANT: component calls .catch() on this
        mockSaveGoogleAccessToken.mockResolvedValue(undefined);
    });

    it("renders idle state with connect button when request exists", () => {
        const screen = render(<ScheduleScreen />);

        expect(screen.getByText("My Schedule")).toBeTruthy();
        expect(
            screen.getByText(
                "Connect Google Calendar to import your course schedule (exported from Concordia Schedule Builder)."
            )
        ).toBeTruthy();

        expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
    });

    it("pressing connect sets connecting UI and calls promptAsync", () => {
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

    it("loads a saved valid token on mount and then fetches events", async () => {
        mockGetGoogleAccessToken.mockResolvedValue({
            accessToken: "SAVED_TOKEN",
            meta: { any: "meta" },
        });
        mockIsTokenLikelyExpired.mockReturnValue(false);

        mockFetchCalendarEventsInRange.mockResolvedValue([{ id: "1" }]);
        mockParseCourseEvents.mockReturnValue([{ id: "a" }, { id: "b" }]);

        const screen = render(<ScheduleScreen />);

        await waitFor(() => {
            expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByTestId("schedule-calendar")).toBeTruthy();
        expect(screen.getByTestId("calendar-items-count").props.children).toBe(2);
        expect(screen.getByText("Disconnect")).toBeTruthy();
    });

    it("if saved token is expired, deletes it and stays idle", async () => {
        mockGetGoogleAccessToken.mockResolvedValue({
            accessToken: "EXPIRED_TOKEN",
            meta: { issuedAt: 0 },
        });
        mockIsTokenLikelyExpired.mockReturnValue(true);

        const screen = render(<ScheduleScreen />);

        await waitFor(() => {
            expect(mockDeleteGoogleAccessToken).toHaveBeenCalledTimes(1);
        });

        expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
        expect(mockFetchCalendarEventsInRange).not.toHaveBeenCalled();
    });

    it("OAuth failure shows error message", async () => {
        const getResultFromResponse = jest.fn().mockReturnValue({
            ok: false,
            reason: "error",
            message: "Login failed hard",
        });

        mockUseGoogleCalendarAuth.mockReturnValue({
            request: { dummy: true },
            promptAsync: jest.fn(),
            getResultFromResponse,
            response: { type: "error" },
        });

        const screen = render(<ScheduleScreen />);

        await waitFor(() => {
            expect(screen.getByText("Login failed hard")).toBeTruthy();
        });
    });

    it("OAuth success saves token and loads schedule", async () => {
        const getResultFromResponse = jest.fn().mockReturnValue({
            ok: true,
            accessToken: "NEW_TOKEN",
            issuedAt: 123,
            expiresIn: 3600,
        });

        mockUseGoogleCalendarAuth.mockReturnValue({
            request: { dummy: true },
            promptAsync: jest.fn(),
            getResultFromResponse,
            response: { type: "success" },
        });

        mockFetchCalendarEventsInRange.mockResolvedValue([{ id: "1" }]);
        mockParseCourseEvents.mockReturnValue([{ id: "x" }]);

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

    it("shows empty state when parseCourseEvents returns empty items", async () => {
        mockGetGoogleAccessToken.mockResolvedValue({
            accessToken: "TOKEN",
            meta: { any: "meta" },
        });

        mockFetchCalendarEventsInRange.mockResolvedValue([{ id: "1" }]);
        mockParseCourseEvents.mockReturnValue([]);

        const screen = render(<ScheduleScreen />);

        await waitFor(() => {
            expect(
                screen.getByText("No events found in this semester window.")
            ).toBeTruthy();
        });

        expect(screen.getByText("Refresh")).toBeTruthy();
    });

    it("disconnect deletes token and returns to idle UI", async () => {
        mockGetGoogleAccessToken.mockResolvedValue({
            accessToken: "TOKEN",
            meta: { any: "meta" },
        });

        mockFetchCalendarEventsInRange.mockResolvedValue([{ id: "1" }]);
        mockParseCourseEvents.mockReturnValue([{ id: "a" }]);

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

    it("ignores errors when reading saved token (secure store error path)", async () => {
        mockGetGoogleAccessToken.mockRejectedValueOnce(new Error("secure store broke"));

        const screen = render(<ScheduleScreen />);

        // should still render idle UI (no crash)
        expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
        // and never tries to fetch events
        expect(mockFetchCalendarEventsInRange).not.toHaveBeenCalled();
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
            response: { type: "dismiss" }, // triggers effect
        });

        const screen = render(<ScheduleScreen />);
        expect(screen.getByText("Connect Google Calendar")).toBeTruthy();
    });

    it("connect() error uses fallback message when error has no message", async () => {
        const promptAsync = jest.fn().mockRejectedValueOnce({}); // no message field
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

    it("empty state refresh calls loadSchedule again (covers Refresh handler)", async () => {
        mockGetGoogleAccessToken.mockResolvedValueOnce({
            accessToken: "TOKEN",
            meta: { any: "meta" },
        });

        // first load -> empty
        mockFetchCalendarEventsInRange.mockResolvedValue([{ id: "1" }]);
        mockParseCourseEvents.mockReturnValue([]); // empty state

        const screen = render(<ScheduleScreen />);

        await waitFor(() => {
            expect(screen.getByText("Refresh")).toBeTruthy();
        });

        expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(1);

        fireEvent.press(screen.getByText("Refresh"));

        await waitFor(() => {
            expect(mockFetchCalendarEventsInRange).toHaveBeenCalledTimes(2);
        });
    });

    it("error state with NO token: primary button calls connect()", async () => {
        const promptAsync = jest.fn().mockResolvedValue(undefined);

        // Force OAuth error without setting an accessToken
        const getResultFromResponse = jest.fn().mockReturnValue({
            ok: false,
            reason: "error",
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

        // When no accessToken, button label is "Connect Google Calendar" and press triggers connect() -> promptAsync()
        fireEvent.press(screen.getByText("Connect Google Calendar"));

        await waitFor(() => {
            expect(promptAsync).toHaveBeenCalledTimes(1);
        });
    });

});