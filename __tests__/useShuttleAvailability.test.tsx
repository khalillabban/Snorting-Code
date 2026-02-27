import { act, renderHook } from "@testing-library/react-native";
import type { CampusKey } from "../constants/campuses";
import { useShuttleAvailability } from "../hooks/useShuttleAvailability";
import { getShuttleAvailabilityStatus } from "../utils/shuttleAvailability";

// Mock the underlying utility function
jest.mock("../utils/shuttleAvailability", () => ({
  getShuttleAvailabilityStatus: jest.fn(),
}));

describe("useShuttleAvailability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Enable fake timers to test the setInterval logic
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Clean up timers after each test
    jest.useRealTimers();
  });

  it("initializes with the correct status based on currentCampus", () => {
    // Setup mock return value using 'available'
    (getShuttleAvailabilityStatus as jest.Mock).mockReturnValue({
      available: true,
      message: "Shuttle is running",
      nextDeparture: "10:00 AM",
    });

    const { result } = renderHook(() => useShuttleAvailability("sgw"));

    // Verify utility was called with the correct campus
    expect(getShuttleAvailabilityStatus).toHaveBeenCalledWith({ campus: "sgw" });
    
    // Verify the hook returns the mocked state
    expect(result.current).toEqual({
      available: true,
      message: "Shuttle is running",
      nextDeparture: "10:00 AM",
    });
  });

  it("updates status immediately when currentCampus changes", () => {
    (getShuttleAvailabilityStatus as jest.Mock).mockReturnValue({ available: true });

    // FIX: Define explicit prop types for renderHook to resolve the 'unknown' error
    const { rerender } = renderHook(
      (props: { campus: CampusKey | null }) => useShuttleAvailability(props.campus),
      { initialProps: { campus: "sgw" } }
    );

    expect(getShuttleAvailabilityStatus).toHaveBeenCalledWith({ campus: "sgw" });

    // Change the campus prop and rerender
    rerender({ campus: "loyola" });

    // Verify it immediately fetched the new status for Loyola
    expect(getShuttleAvailabilityStatus).toHaveBeenCalledWith({ campus: "loyola" });
  });

  it("refreshes the status every 60 seconds", () => {
    // Setup a sequence of mock returns to simulate time passing
    (getShuttleAvailabilityStatus as jest.Mock)
      .mockReturnValueOnce({ available: true }) // Initial State
      .mockReturnValueOnce({ available: true }) // Initial Effect Trigger
      .mockReturnValueOnce({ available: false }); // After 60 seconds (Interval)

    const { result } = renderHook(() => useShuttleAvailability("sgw"));

    // FIX: Assert on 'available'
    expect(result.current.available).toBe(true);

    // Fast-forward time by 60 seconds
    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    // Verify the hook state updated based on the interval trigger
    expect(result.current.available).toBe(false);
  });

  it("cleans up the interval on unmount", () => {
    (getShuttleAvailabilityStatus as jest.Mock).mockReturnValue({ available: true });

    const { unmount } = renderHook(() => useShuttleAvailability("sgw"));

    // Record how many times the function was called so far (Initial State + Effect)
    const callsBeforeUnmount = (getShuttleAvailabilityStatus as jest.Mock).mock.calls.length;

    // Unmount the hook
    unmount();

    // Fast-forward time by 60 seconds
    act(() => {
      jest.advanceTimersByTime(60 * 1000);
    });

    // The call count should NOT have increased, because the interval was cleared
    expect(getShuttleAvailabilityStatus).toHaveBeenCalledTimes(callsBeforeUnmount);
  });
});