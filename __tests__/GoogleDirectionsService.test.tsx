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
      "https://maps.googleapis.com/maps/api/directions/json",
    );
    expect(parsed.searchParams.get("origin")).toBe(
      `${origin.latitude},${origin.longitude}`,
    );

    expect(parsed.searchParams.get("destination")).toBe(
      `${destination.latitude},${destination.longitude}`,
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

    await expect(getOutdoorRoute(origin, destination)).rejects.toThrow(
      "ZERO_RESULTS",
    );
  });

  it("propagates fetch errors", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    await expect(getOutdoorRoute(origin, destination)).rejects.toThrow(
      "Network error",
    );
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

    const result = await getOutdoorRouteWithSteps(origin, destination);

    expect(result.duration).toBe("12 mins");
    expect(result.distance).toBe("2.1 km");
    expect(result.coordinates.length).toBeGreaterThan(0);
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].instruction).toBe("Head north");
    // FIX: Added check to ensure segments are generated
    expect(result.segments).toHaveLength(1);
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
});

describe("getOutdoorRouteWithSteps - Transit Details", () => {
  const origin = { latitude: 45.5, longitude: -73.5 };
  const destination = { latitude: 45.51, longitude: -73.51 };
  const samplePolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";
  });

  it("populates transitDetails for TRANSIT steps", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "OK",
        routes: [
          {
            legs: [
              {
                distance: { text: "5 km" },
                duration: { text: "20 mins" },
                steps: [
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Walk to stop",
                    distance: { text: "200 m" },
                    duration: { text: "3 min" },
                    travel_mode: "WALKING",
                  },
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Bus towards Station B",
                    distance: { text: "4 km" },
                    duration: { text: "15 min" },
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
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Walk to destination",
                    distance: { text: "100 m" },
                    duration: { text: "2 min" },
                    travel_mode: "WALKING",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const transitStrategy = { mode: "transit", label: "Transit", icon: "bus" };
    const result = await getOutdoorRouteWithSteps(origin, destination, transitStrategy as any);

    expect(result.steps).toHaveLength(3);

    // Walking steps should not have transitDetails
    expect(result.steps[0].transitDetails).toBeUndefined();
    expect(result.steps[2].transitDetails).toBeUndefined();

    // Transit step should have full transitDetails
    const transitStep = result.steps[1];
    expect(transitStep.transitDetails).toBeDefined();
    expect(transitStep.transitDetails!.lineName).toBe("24");
    expect(transitStep.transitDetails!.vehicleType).toBe("BUS");
    expect(transitStep.transitDetails!.departureTime).toBe("3:15 PM");
    expect(transitStep.transitDetails!.arrivalTime).toBe("3:30 PM");
    expect(transitStep.transitDetails!.departureStop).toBe("Guy-Concordia");
    expect(transitStep.transitDetails!.arrivalStop).toBe("Atwater");
    expect(transitStep.transitDetails!.numStops).toBe(5);
  });

  it("does not populate transitDetails for non-TRANSIT travel_mode", async () => {
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
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Walk north",
                    travel_mode: "WALKING",
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const result = await getOutdoorRouteWithSteps(origin, destination);
    expect(result.steps[0].transitDetails).toBeUndefined();
  });

  it("handles TRANSIT step with partial transit_details", async () => {
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
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Metro towards Berri",
                    travel_mode: "TRANSIT",
                    transit_details: {
                      line: { short_name: "Green", vehicle: { type: "SUBWAY" } },
                      num_stops: 3,
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const transitStrategy = { mode: "transit", label: "Transit", icon: "bus" };
    const result = await getOutdoorRouteWithSteps(origin, destination, transitStrategy as any);

    const td = result.steps[0].transitDetails;
    expect(td).toBeDefined();
    expect(td!.lineName).toBe("Green");
    expect(td!.vehicleType).toBe("SUBWAY");
    expect(td!.numStops).toBe(3);
    expect(td!.departureTime).toBeUndefined();
    expect(td!.arrivalTime).toBeUndefined();
    expect(td!.departureStop).toBeUndefined();
    expect(td!.arrivalStop).toBeUndefined();
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

    const result = await getOutdoorRouteWithSteps(
      origin,
      destination,
      shuttleStrategy as any,
    );

    // 1. Verify fetch was called 3 times (Walk to stop, Drive shuttle, Walk to dest)
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // 2. Verify segments are divided correctly
    expect(result.segments).toHaveLength(3);
    expect(result.segments[0].mode).toBe("walking");
    expect(result.segments[1].mode).toBe("shuttle");
    expect(result.segments[2].mode).toBe("walking");

    // 3. Verify custom shuttle instruction was injected
    const hasBoardInstruction = result.steps.some((step) =>
      step.instruction.includes("Board Concordia shuttle"),
    );
    expect(hasBoardInstruction).toBe(true);

    // 4. Verify total distance and duration parsing logic
    // 10m walk + 10m drive + 10m walk = 30 mins
    expect(result.duration).toBe("30 min");
    // 1km + 1km + 1km = 3.0 km
    expect(result.distance).toBe("3.0 km");
  });

  it("filters out empty 0m/1min walking legs", async () => {
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
    const result = await getOutdoorRouteWithSteps(
      origin,
      destination,
      shuttleStrategy as any,
    );

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].instruction).toContain("Board Concordia shuttle");
  });

  it("parses hour-based durations in shuttle legs", async () => {
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
                duration: { text: "1 hour 10 mins" },
                steps: [
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Walk",
                    distance: { text: "1.0 km" },
                    duration: { text: "10 min" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
    const result = await getOutdoorRouteWithSteps(
      origin,
      destination,
      shuttleStrategy as any,
    );

    // 3 legs each with "1 hour 10 mins" = 3 * 70 = 210 min = 3 h 30 min
    expect(result.duration).toBe("3 h 30 min");
  });

  it("handles distance with no recognized unit in shuttle parseDistance", async () => {
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
                duration: { text: "5 min" },
                steps: [
                  {
                    polyline: { points: samplePolyline },
                    html_instructions: "Walk",
                    distance: { text: "unknown" },
                    duration: { text: "5 min" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const shuttleStrategy = { mode: "shuttle", label: "Shuttle", icon: "bus" };
    const result = await getOutdoorRouteWithSteps(
      origin,
      destination,
      shuttleStrategy as any,
    );

    // parseDistance returns 0 for unrecognized units, so total = 0.0 km
    expect(result.distance).toBe("0.0 km");
  });
});

describe("getOutdoorRouteWithSteps - Error Handling", () => {
  const origin = { latitude: 45.5, longitude: -73.5 };
  const destination = { latitude: 45.51, longitude: -73.51 };
  const samplePolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-api-key";
  });

  it("includes error_message in thrown error when API provides one", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        status: "REQUEST_DENIED",
        error_message: "API key is invalid",
      }),
    });

    await expect(
      getOutdoorRouteWithSteps(origin, destination),
    ).rejects.toThrow("REQUEST_DENIED (API key is invalid)");
  });

  it("uses empty instruction when step has no html_instructions", async () => {
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
                  {
                    polyline: { points: samplePolyline },
                    distance: { text: "100 m" },
                  },
                ],
              },
            ],
          },
        ],
      }),
    });

    const result = await getOutdoorRouteWithSteps(origin, destination);
    expect(result.steps[0].instruction).toBe("");
  });

  it("throws when HTTP response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
    });

    await expect(
      getOutdoorRouteWithSteps(origin, destination),
    ).rejects.toThrow("HTTP 403");
  });
});
