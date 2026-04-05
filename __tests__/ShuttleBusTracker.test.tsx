import { BUSSTOP } from "@/constants/shuttle";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import axios from "axios";
import React from "react";
import { ActivityIndicator } from "react-native";
import { ShuttleBusTracker, useShuttleBus } from "../components/ShuttleBusTracker"; // Adjust path if necessary

// 1. Mock Axios to prevent real network requests
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// 2. Mock the Shuttle constants so we have predictable UI data
jest.mock("../constants/shuttle", () => ({
    BUSSTOP: [
        { id: "stop1", name: "Mock SGW Stop", address: "123 Main St" },
        { id: "stop2", name: "Mock Loyola Stop", address: "456 West Ave" },
    ],
}));

describe("ShuttleBusTracker Module", () => {
    const originalEnv = process.env.NODE_ENV;
    let consoleWarnSpy: jest.SpyInstance;

    const createDeferred = <T,>() => {
        let resolve!: (value: T) => void;
        let reject!: (reason?: unknown) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return { promise, resolve, reject };
    };

    beforeEach(() => {
        jest.clearAllMocks();
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => { });
    });

    afterEach(() => {
        (process.env as any).NODE_ENV = originalEnv;
        consoleWarnSpy.mockRestore();
        jest.useRealTimers();
    });

    // --- HOOK TESTS (useShuttleBus) ---
    describe("useShuttleBus Hook", () => {

        it("bails out early and does not fetch if NODE_ENV is 'test'", async () => {
            (process.env as any).NODE_ENV = "test";

            const { result } = renderHook(() => useShuttleBus());

            expect(result.current.loading).toBe(false);
            expect(result.current.activeBuses).toEqual([]);
            expect(mockedAxios.get).not.toHaveBeenCalled();
        });

        it("fetches and filters buses successfully", async () => {
            (process.env as any).NODE_ENV = "development";
            mockedAxios.get.mockResolvedValueOnce({ status: 200 });
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    d: {
                        Points: [
                            { ID: "BUS-123", Latitude: 45.497, Longitude: -73.578 },
                            { ID: "INVALID", Latitude: 0, Longitude: 0 },
                        ],
                    },
                },
            });

            const { result } = renderHook(() => useShuttleBus());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.activeBuses).toHaveLength(1);
            expect(result.current.activeBuses[0].ID).toBe("BUS-123");
        });

        it("falls back to an empty array when API response has no Points", async () => {
            (process.env as any).NODE_ENV = "development";
            mockedAxios.get.mockResolvedValueOnce({ status: 200 });
            mockedAxios.post.mockResolvedValueOnce({
                data: { d: {} },
            });

            const { result } = renderHook(() => useShuttleBus());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.activeBuses).toEqual([]);
        });

        it("falls back to an empty array when API response has no d object", async () => {
            (process.env as any).NODE_ENV = "development";
            mockedAxios.get.mockResolvedValueOnce({ status: 200 });
            mockedAxios.post.mockResolvedValueOnce({
                data: {},
            });

            const { result } = renderHook(() => useShuttleBus());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.activeBuses).toEqual([]);
        });

        it("handles fetch errors gracefully and sets loading to false", async () => {
            (process.env as any).NODE_ENV = "development";
            mockedAxios.get.mockRejectedValueOnce(new Error("Network Error"));

            const { result } = renderHook(() => useShuttleBus());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            expect(result.current.activeBuses).toEqual([]);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                "Error fetching bus data:",
                expect.any(Error)
            );
        });

        it("polls for new data every 15 seconds", async () => {
            (process.env as any).NODE_ENV = "development";
            jest.useFakeTimers();

            mockedAxios.get.mockResolvedValue({ status: 200 });
            mockedAxios.post.mockResolvedValue({
                data: { d: { Points: [] } },
            });

            const { result } = renderHook(() => useShuttleBus());

            await act(async () => {
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(result.current.loading).toBe(false);
            expect(mockedAxios.get).toHaveBeenCalledTimes(1);

            await act(async () => {
                jest.advanceTimersByTime(15000);
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        });

        it("does not update state after unmount when request resolves late", async () => {
            (process.env as any).NODE_ENV = "development";
            mockedAxios.get.mockResolvedValueOnce({ status: 200 });

            const deferredPost = createDeferred<{
                data: { d: { Points: Array<{ ID: string; Latitude: number; Longitude: number }> } };
            }>();
            mockedAxios.post.mockReturnValueOnce(deferredPost.promise as any);

            const { unmount } = renderHook(() => useShuttleBus());

            unmount();

            await act(async () => {
                deferredPost.resolve({
                    data: {
                        d: {
                            Points: [{ ID: "BUS-LATE", Latitude: 45.5, Longitude: -73.6 }],
                        },
                    },
                });
                await Promise.resolve();
                await Promise.resolve();
            });

            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });
    });

    // --- COMPONENT TESTS (ShuttleBusTracker) ---
    describe("ShuttleBusTracker Component", () => {
        beforeEach(() => {
            (process.env as any).NODE_ENV = "development";
        });

        it("renders loading indicator initially", () => {
            mockedAxios.get.mockImplementationOnce(() => new Promise(() => { }));

            render(<ShuttleBusTracker />);

            const loader = screen.UNSAFE_getByType(ActivityIndicator);
            expect(loader).toBeTruthy();
        });

        it("renders campus stops with no live buses in test environment", async () => {
            render(<ShuttleBusTracker />);

            await waitFor(() => {
                BUSSTOP.forEach((stop) => {
                    expect(screen.getByText(stop.name)).toBeTruthy();
                });
            });

            expect(screen.getByText("No buses currently in service.")).toBeTruthy();
        });

        it("shows loading indicator initially then resolves", async () => {
            render(<ShuttleBusTracker />);

            // In test env, loading resolves synchronously so spinner disappears fast
            await waitFor(() => {
                expect(screen.queryByTestId("activity-indicator")).toBeNull();
            });

            expect(screen.getByText(/Live Buses/)).toBeTruthy();
        });

        it("renders empty state message when no buses are running", async () => {
            mockedAxios.get.mockResolvedValueOnce({ status: 200 });
            mockedAxios.post.mockResolvedValueOnce({
                data: { d: { Points: [] } },
            });

            render(<ShuttleBusTracker />);

            await screen.findByText("Campus Stops", {}, { timeout: 10000 });

            expect(screen.getByText("Live Buses (0)")).toBeTruthy();
            expect(screen.getByText("No buses currently in service.")).toBeTruthy();
        });

        it("renders live buses when API returns active bus points", async () => {
            mockedAxios.get.mockResolvedValueOnce({ status: 200 });
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    d: {
                        Points: [
                            { ID: "BUS-101", Latitude: 45.497, Longitude: -73.579 },
                            { ID: "X-IGNORE", Latitude: 0, Longitude: 0 },
                        ],
                    },
                },
            });

            render(<ShuttleBusTracker />);

            await waitFor(() => {
                expect(screen.getByText("Live Buses (1)")).toBeTruthy();
            });

            expect(screen.getByText("Bus ID: BUS-101")).toBeTruthy();
            expect(screen.getByText("Location: 45.4970, -73.5790")).toBeTruthy();
            expect(screen.queryByText("No buses currently in service.")).toBeNull();
        });
    });
});