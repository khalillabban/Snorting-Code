import { getOutdoorRoute } from "../services/GoogleDirectionsService";

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
