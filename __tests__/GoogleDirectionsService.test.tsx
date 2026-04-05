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

        const result = await getOutdoorRouteWithSteps(origin, destination);

        // FIX: The original test was expecting empty arrays, but if the API 
        // succeeds, it should return the decoded polyline. 
        // We check for the presence of the properties instead of exact equality.
        expect(result.coordinates.length).toBeGreaterThan(0);
        expect(result.segments.length).toBeGreaterThan(0); // Added segments check
        expect(result.steps.length).toBe(1);
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

    it("includes API error_message in thrown error", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "REQUEST_DENIED",
                error_message: "API key invalid",
            }),
        });

        await expect(getOutdoorRoute(origin, destination)).rejects.toThrow(
            "Directions API status: REQUEST_DENIED (API key invalid)",
        );
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
        // FIX: Added check to ensure segments are generated
        expect(result.segments).toHaveLength(1); 
    });

    it("formats an exact-hour duration without minutes", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "1.0 km" },
                                duration: { text: "20 mins" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Head north",
                                        distance: { text: "1.0 km" },
                                        duration: { text: "20 mins" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        expect(result.duration).toBe("1 h");
    });

    it("returns empty result without calling fetch when API key is missing", async () => {
        const orig = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
        delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

        const result = await getOutdoorRouteWithSteps(origin, destination);

        expect(result).toEqual({
            coordinates: [],
            segments: [], 
            steps: [],
            duration: undefined,
            distance: undefined,
        });
        expect(global.fetch).not.toHaveBeenCalled();

        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = orig;
    });

    it("formats an exact-hour duration without minutes", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "1.0 km" },
                                duration: { text: "20 mins" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Walk",
                                        distance: { text: "1.0 km" },
                                        duration: { text: "20 mins" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        expect(result.duration).toBe("1 h");
    });

    it("falls back to zero distance for unrecognized shuttle leg units", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "unknown" },
                                duration: { text: "10 mins" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Walk",
                                        distance: { text: "unknown" },
                                        duration: { text: "10 mins" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        expect(result.distance).toBe("0.0 km");
    });

    it("treats missing shuttle leg distance as zero while summing known walking distance", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "0.5 km" },
                                    duration: { text: "4 mins" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Walk to stop",
                                            distance: { text: "0.5 km" },
                                            duration: { text: "4 mins" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    duration: { text: "10 mins" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Ride shuttle",
                                            duration: { text: "10 mins" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "500 m" },
                                    duration: { text: "5 mins" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Walk from stop",
                                            distance: { text: "500 m" },
                                            duration: { text: "5 mins" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        expect(result.distance).toBe("1.0 km");
    });

    it("throws when the HTTP response is not ok", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 503,
            json: jest.fn(),
        });

        await expect(
            getOutdoorRouteWithSteps(origin, destination)
        ).rejects.toThrow("Directions request failed: HTTP 503");
    });

    it("throws when no steps are returned", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [{ legs: [{}] }],
            }),
        });

        await expect(
            getOutdoorRouteWithSteps(origin, destination)
        ).rejects.toThrow("No route steps returned (no walkable route or empty response).");
    });

    it("maps transit details onto route steps when transit metadata is present", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "4 km" },
                                duration: { text: "15 mins" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Take bus",
                                        travel_mode: "TRANSIT",
                                        transit_details: {
                                            line: { short_name: "24", vehicle: { type: "BUS" } },
                                            departure_time: { text: "3:15 PM" },
                                            arrival_time: { text: "3:30 PM" },
                                            departure_stop: { name: "Guy-Concordia" },
                                            arrival_stop: { name: "Atwater" },
                                            num_stops: 5,
                                        },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const result = await getOutdoorRouteWithSteps(origin, destination, {
            mode: "transit",
            label: "Transit",
            icon: "bus",
        } as any);

        expect(result.steps[0].transitDetails).toEqual({
            lineName: "24",
            vehicleType: "BUS",
            departureTime: "3:15 PM",
            arrivalTime: "3:30 PM",
            departureStop: "Guy-Concordia",
            arrivalStop: "Atwater",
            numStops: 5,
        });
    });
});

describe("getOutdoorRouteWithSteps - Shuttle Strategy", () => {
    const origin = { latitude: 45.497, longitude: -73.578 }; // SGW area
    const destination = { latitude: 45.458, longitude: -73.639 }; // Loyola area
    const samplePolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it("handles shuttle routing by combining walk, shuttle, and walk segments", async () => {
        // Mock a successful Google API response that all 3 calls will use
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "1.0 km" },
                                duration: { text: "10 mins" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Walk",
                                        distance: { text: "1.0 km" },
                                        duration: { text: "10 min" }, // Changed from mins to min for regex parser
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };

        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        // 1. Verify fetch was called 3 times (Walk to stop, Drive shuttle, Walk to dest)
        expect(global.fetch).toHaveBeenCalledTimes(3);

        // 2. Verify segments are divided correctly
        expect(result.segments).toHaveLength(3);
        expect(result.segments[0].mode).toBe("walking");
        expect(result.segments[1].mode).toBe("shuttle");
        expect(result.segments[2].mode).toBe("walking");

        // 3. Verify custom shuttle instruction was injected
        const hasBoardInstruction = result.steps.some((step) => 
            step.instruction.includes("Board Concordia shuttle")
        );
        expect(hasBoardInstruction).toBe(true);

        // 4. Verify total distance and duration parsing logic 
        // 10m walk + 10m drive + 10m walk = 30 min
        expect(result.duration).toBe("30 min");
        // 1km + 1km + 1km = 3.0 km
        expect(result.distance).toBe("3.0 km");
    });

    it("filters out empty 0m/1min walking legs", async () => {
        // Mock response specifically simulating a "0 meter" walk
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "0 m" },
                                duration: { text: "1 min" },
                                steps: [
                                    {
                                        polyline: { points: samplePolyline },
                                        html_instructions: "Walk 0 meters",
                                        distance: { text: "0 m" },
                                        duration: { text: "1 min" },
                                    },
                                ],
                            },
                        ],
                    },
                ],
            }),
        });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        // Since all 3 legs (walk, drive, walk) returned 0m/1min in this mock,
        // your code's `.filter(s => s.duration !== "1 min" || s.distance !== "0 m")` 
        // should remove the walking steps, leaving ONLY the injected shuttle boarding instruction.
        expect(result.steps).toHaveLength(1);
        expect(result.steps[0].instruction).toContain("Board Concordia shuttle");
    });

    it("uses Loyola stop when origin is near Loyola and formats mixed hour/min duration", async () => {
        const loyolaOrigin = { latitude: 45.45842, longitude: -73.63836 };

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "500 m" },
                                    duration: { text: "2 mins" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Walk to Loyola stop",
                                            distance: { text: "500 m" },
                                            duration: { text: "2 mins" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "5.0 km" },
                                    duration: { text: "1 hour" },
                                    steps: [
                                        {
                                            // Intentionally missing polyline to cover no-decoding shuttle step branch.
                                            html_instructions: "Ride shuttle",
                                            distance: { text: "5.0 km" },
                                            duration: { text: "1 hour" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "200 m" },
                                    duration: { text: "2 mins" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Walk from SGW stop",
                                            distance: { text: "200 m" },
                                            duration: { text: "2 mins" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(loyolaOrigin, destination, shuttleStrategy as any);

        expect(result.steps.some((s) => s.instruction.includes("Loyola Campus Shuttle Stop"))).toBe(true);
        expect(result.duration).toBe("1 h 4 min");
    });

    it("handles missing shuttle leg steps and durations by falling back to zero-minute totals", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "0 m" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Walk to stop",
                                            distance: { text: "0 m" },
                                            duration: { text: "1 min" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    // No steps and no duration text on shuttle leg.
                                    distance: { text: "0 m" },
                                },
                            ],
                        },
                    ],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    status: "OK",
                    routes: [
                        {
                            legs: [
                                {
                                    distance: { text: "0 m" },
                                    steps: [
                                        {
                                            polyline: { points: samplePolyline },
                                            html_instructions: "Walk from stop",
                                            distance: { text: "0 m" },
                                            duration: { text: "1 min" },
                                        },
                                    ],
                                },
                            ],
                        },
                    ],
                }),
            });

        const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
        const result = await getOutdoorRouteWithSteps(origin, destination, shuttleStrategy as any);

        expect(result.duration).toBe("0 min");
        expect(result.distance).toBe("0.0 km");
        expect(result.segments[1].coordinates).toEqual([]);
    });
});

describe("getOutdoorRouteWithSteps - additional status and parsing branches", () => {
    const origin = { latitude: 45.5, longitude: -73.5 };
    const destination = { latitude: 45.51, longitude: -73.51 };

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
        process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";
    });

    it("throws UNKNOWN when API status is missing", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                routes: [{ legs: [{ steps: [] }] }],
            }),
        });

        await expect(getOutdoorRouteWithSteps(origin, destination)).rejects.toThrow(
            "Directions API status: UNKNOWN",
        );
    });

    it("keeps empty instruction and coordinates when a step has no html or polyline", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: jest.fn().mockResolvedValue({
                status: "OK",
                routes: [
                    {
                        legs: [
                            {
                                distance: { text: "100 m" },
                                duration: { text: "1 min" },
                                steps: [
                                    {
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

        const result = await getOutdoorRouteWithSteps(origin, destination);
        expect(result.coordinates).toEqual([]);
        expect(result.steps).toEqual([
            {
                instruction: "",
                distance: "100 m",
                duration: "1 min",
            },
        ]);
    });
});