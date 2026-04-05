import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useNearbyPOIs } from "../hooks/useNearbyPOIs";
import { fetchNearbyPOIsForCategories } from "../services/GooglePlacesService";

jest.mock("../services/GooglePlacesService", () => ({
  fetchNearbyPOIsForCategories: jest.fn(),
}));

describe("useNearbyPOIs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("starts with empty state", () => {
    const { result } = renderHook(() => useNearbyPOIs());

    expect(result.current.pois).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("clears POIs and skips fetch when no categories are selected", async () => {
    const { result } = renderHook(() => useNearbyPOIs());

    await act(async () => {
      await result.current.search({ latitude: 45.5, longitude: -73.5 }, 500, []);
    });

    expect(fetchNearbyPOIsForCategories).not.toHaveBeenCalled();
    expect(result.current.pois).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("sets loading and stores POI results on successful search", async () => {
    (fetchNearbyPOIsForCategories as jest.Mock).mockResolvedValue({
      pois: [
        {
          placeId: "p1",
          name: "Cafe One",
          latitude: 45.501,
          longitude: -73.601,
          vicinity: "1455 Maisonneuve",
          categoryId: "coffee",
        },
      ],
      errors: [],
    });

    const { result } = renderHook(() => useNearbyPOIs());

    await act(async () => {
      await result.current.search(
        { latitude: 45.5, longitude: -73.5 },
        1000,
        ["coffee", "restaurant"],
      );
    });

    expect(fetchNearbyPOIsForCategories).toHaveBeenCalledWith(
      45.5,
      -73.5,
      1000,
      ["coffee", "restaurant"],
    );
    expect(result.current.pois).toHaveLength(1);
    expect(result.current.pois[0].placeId).toBe("p1");
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("stores API warnings when the search succeeds with partial errors", async () => {
    (fetchNearbyPOIsForCategories as jest.Mock).mockResolvedValue({
      pois: [],
      errors: ["one", "two"],
    });

    const { result } = renderHook(() => useNearbyPOIs());

    await act(async () => {
      await result.current.search(
        { latitude: 45.5, longitude: -73.5 },
        1000,
        ["coffee"],
      );
    });

    expect(result.current.error).toBe("one\ntwo");
    expect(result.current.pois).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("captures thrown Error messages and clears stale POIs", async () => {
    (fetchNearbyPOIsForCategories as jest.Mock).mockRejectedValue(
      new Error("API unavailable"),
    );

    const { result } = renderHook(() => useNearbyPOIs());

    await act(async () => {
      await result.current.search(
        { latitude: 45.5, longitude: -73.5 },
        500,
        ["coffee"],
      );
    });

    await waitFor(() => {
      expect(result.current.error).toBe("API unavailable");
    });
    expect(result.current.pois).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("falls back to a generic message for non-Error failures", async () => {
    (fetchNearbyPOIsForCategories as jest.Mock).mockRejectedValue("boom");

    const { result } = renderHook(() => useNearbyPOIs());

    await act(async () => {
      await result.current.search(
        { latitude: 45.5, longitude: -73.5 },
        500,
        ["coffee"],
      );
    });

    expect(result.current.error).toBe("Failed to fetch nearby places");
    expect(result.current.pois).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("clear removes POIs and resets error", async () => {
    (fetchNearbyPOIsForCategories as jest.Mock).mockRejectedValue(
      new Error("API unavailable"),
    );

    const { result } = renderHook(() => useNearbyPOIs());

    await act(async () => {
      await result.current.search(
        { latitude: 45.5, longitude: -73.5 },
        500,
        ["coffee"],
      );
    });

    act(() => {
      result.current.clear();
    });

    expect(result.current.pois).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
