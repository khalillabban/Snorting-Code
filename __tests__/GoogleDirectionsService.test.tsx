import {
  getOutdoorRoute,
  getOutdoorRouteWithSteps,
} from "../services/GoogleDirectionsService";

describe("getOutdoorRoute", () => {
    const origin = { latitude: 45.5, longitude: -73.5 };
    const destination = { latitude: 45.51, longitude: -73.51 };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    const samplePolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

    it("calls Google Directions API with correct URL", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                steps: [{ polyline: { points: samplePolyline } }],
                            },
                        ],
                    },
                ],
            }),
        });

        await getOutdoorRoute(origin, destination);

        expect(global.fetch).toHaveBeenCalledTimes(1);

        const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
        const parsed = new URL(calledUrl);

        expect(calledUrl).toContain(
            "https://maps.googleapis.com/maps/api/directions/json"
        );
        expect(parsed.searchParams.get("origin")).toBe(
            `${origin.latitude},${origin.longitude}`
        );

        expect(parsed.searchParams.get("destination")).toBe(
            `${destination.latitude},${destination.longitude}`
        );
        expect(calledUrl).toContain("mode=walking");
    });

    it("returns decoded route points when API succeeds", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                steps: [{ polyline: { points: samplePolyline } }],
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await getOutdoorRoute(origin, destination);

        expect(result).toEqual([
            { latitude: 38.5, longitude: -120.2 },
            { latitude: 40.7, longitude: -120.95 },
            { latitude: 43.252, longitude: -126.453 },
        ]);
    });

    it("concatenates route points from multiple steps", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                steps: [
                                    { polyline: { points: samplePolyline } },
                                    { polyline: { points: samplePolyline } },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await getOutdoorRoute(origin, destination);

        expect(result.length).toBe(6);
    });

    it("throws when API status is not OK", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true, // IMPORTANT
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "ZERO_RESULTS",
            }),
        });

        await expect(
            getOutdoorRoute(origin, destination)
        ).rejects.toThrow("ZERO_RESULTS");
    });

    it("propagates fetch errors", async () => {
        (global.fetch as jest.Mock).mockRejectedValue(
            new Error("Network error")
        );

        await expect(
            getOutdoorRoute(origin, destination)
        ).rejects.toThrow("Network error");
    });
});

describe("getOutdoorRouteWithSteps", () => {
    const origin = { latitude: 45.5, longitude: -73.5 };
    const destination = { latitude: 45.51, longitude: -73.51 };
    const samplePolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    it("returns duration and distance from leg when API includes them", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "2.1 km" },
                                duration: { text: "12 mins" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Head north",
                                        distance: { text: "100 m" },
                                        duration: { text: "1 min" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await getOutdoorRouteWithSteps(
            origin,
            destination
        );

        expect(result.duration).toBe("12 mins");
        expect(result.distance).toBe("2.1 km");
        expect(result.coordinates.length).toBeGreaterThan(0);
        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].instruction).toBe("Head north");
    });

    it("returns empty result without calling fetch when API key is missing", async () => {
        const orig = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

        const result = await getOutdoorRouteWithSteps(origin, destination);

        expect(result).toEqual({
            coordinates: [],
            steps: [],
            duration: undefined,
            distance: undefined,
        });
        expect(global.fetch).not.toHaveBeenCalled();

        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = orig;
    });
});
