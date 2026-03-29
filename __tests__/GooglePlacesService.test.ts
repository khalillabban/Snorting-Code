import {
    fetchNearbyPOIs,
    fetchNearbyPOIsForCategories,
} from "../services/GooglePlacesService";

describe("GooglePlacesService", () => {
  const originalApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-key";
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalApiKey;
    jest.restoreAllMocks();
  });

  it("throws when Google Maps API key is missing", async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    await expect(fetchNearbyPOIs(45.5, -73.5, 500, "coffee")).rejects.toThrow(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY",
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns an empty array when category id is unknown", async () => {
    const result = await fetchNearbyPOIs(45.5, -73.5, 500, "unknown" as any);
    expect(result).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("calls Places Nearby Search with expected headers and request body", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ places: [] }),
    });

    await fetchNearbyPOIs(45.5, -73.5, 750, "coffee");

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];

    expect(url).toBe("https://places.googleapis.com/v1/places:searchNearby");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Goog-Api-Key"]).toBe("test-key");
    expect(init.headers["X-Goog-FieldMask"]).toContain("places.id");

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      includedTypes: ["cafe"],
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: 45.5, longitude: -73.5 },
          radius: 750,
        },
      },
    });
  });

  it("throws when HTTP response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    await expect(fetchNearbyPOIs(45.5, -73.5, 500, "coffee")).rejects.toThrow(
      "Places API request failed: HTTP 500",
    );
  });

  it("throws when Places API returns an error object", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        error: { status: "INVALID_ARGUMENT", message: "Bad request" },
      }),
    });

    await expect(fetchNearbyPOIs(45.5, -73.5, 500, "coffee")).rejects.toThrow(
      "Places API error: INVALID_ARGUMENT – Bad request",
    );
  });

  it("maps, filters and normalizes place results", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        places: [
          {
            id: "p1",
            displayName: { text: "Cafe One" },
            location: { latitude: 45.501, longitude: -73.601 },
            shortFormattedAddress: "1455 Maisonneuve",
            currentOpeningHours: { openNow: true },
            rating: 4.6,
          },
          {
            id: "p2",
            displayName: { text: "Cafe Two" },
            location: { latitude: 45.502, longitude: -73.602 },
            formattedAddress: "1400 St Mathieu",
            regularOpeningHours: { openNow: false },
          },
          {
            id: "missing-name",
            location: { latitude: 45.503, longitude: -73.603 },
          },
        ],
      }),
    });

    const result = await fetchNearbyPOIs(45.5, -73.5, 500, "coffee");

    expect(result).toEqual([
      {
        placeId: "p1",
        name: "Cafe One",
        latitude: 45.501,
        longitude: -73.601,
        vicinity: "1455 Maisonneuve",
        categoryId: "coffee",
        openNow: true,
        rating: 4.6,
      },
      {
        placeId: "p2",
        name: "Cafe Two",
        latitude: 45.502,
        longitude: -73.602,
        vicinity: "1400 St Mathieu",
        categoryId: "coffee",
        openNow: false,
        rating: undefined,
      },
    ]);
  });

  it("returns [] when no categories are provided to multi-category fetch", async () => {
    const result = await fetchNearbyPOIsForCategories(45.5, -73.5, 500, []);
    expect(result).toEqual({ pois: [], errors: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("merges category results, swallows failed category requests, and de-duplicates by placeId", async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          places: [
            {
              id: "dup-1",
              displayName: { text: "Shared Place" },
              location: { latitude: 45.501, longitude: -73.601 },
            },
            {
              id: "coffee-only",
              displayName: { text: "Coffee Only" },
              location: { latitude: 45.502, longitude: -73.602 },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          places: [
            {
              id: "dup-1",
              displayName: { text: "Shared Place (restaurant)" },
              location: { latitude: 45.501, longitude: -73.601 },
            },
            {
              id: "restaurant-only",
              displayName: { text: "Restaurant Only" },
              location: { latitude: 45.503, longitude: -73.603 },
            },
          ],
        }),
      });

    const result = await fetchNearbyPOIsForCategories(45.5, -73.5, 500, [
      "coffee",
      "study",
      "restaurant",
    ]);

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result.pois.map((p) => p.placeId)).toEqual([
      "dup-1",
      "coffee-only",
      "restaurant-only",
    ]);
    expect(result.errors).toHaveLength(1);
  });
});
