import { BUSSTOP } from "../constants/shuttle";
import { DRIVING_STRATEGY, WALKING_STRATEGY } from "../constants/strategies";
import { LatLng, RouteSegment, RouteStep } from "../constants/type";
import { RouteStrategy } from "./Routing";

type DirectionsResponse = {
  status?: string;
  error_message?: string;
  routes?: {
    legs?: {
      distance?: { text?: string };
      duration?: { text?: string };
      steps?: {
        polyline?: { points?: string };
        html_instructions?: string;
        distance?: { text?: string };
        duration?: { text?: string };
      }[];
    }[];
  }[];
};

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function requireGoogleApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your env (and restart Metro).",
    );
  }

  return apiKey;
}

function buildDirectionsUrl(
  origin: LatLng,
  destination: LatLng,
  strategy: RouteStrategy,
): string {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  const mode =
    strategy.mode === "shuttle" ? DRIVING_STRATEGY.mode : strategy.mode;

  url.search = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode,
    key: requireGoogleApiKey(),
  }).toString();

  return url.toString();
}

function parseToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  let total = 0;
  const hourMatch = timeStr.match(/(\d+)\s*hour/);
  const minMatch = timeStr.match(/(\d+)\s*min/);
  if (hourMatch) total += parseInt(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1]);
  return total;
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} mins`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h} hour ${m} mins` : `${h} hour`;
}

export interface OutdoorRouteResult {
  coordinates: LatLng[];
  segments: RouteSegment[]; // <-- add this
  steps: RouteStep[];
  duration?: string;
  distance?: string;
}

export async function getOutdoorRouteWithSteps(
  origin: LatLng,
  destination: LatLng,
  strategy: RouteStrategy = WALKING_STRATEGY,
): Promise<OutdoorRouteResult> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return {
      coordinates: [],
      segments: [],
      steps: [],
      duration: undefined,
      distance: undefined,
    };
  }

  if (strategy.mode === "shuttle") {
    const distToSGW = Math.abs(origin.latitude - BUSSTOP[0].coordinates.latitude);
    const fromStop = distToSGW < 0.01 ? BUSSTOP[0] : BUSSTOP[1];
    const toStop = fromStop === BUSSTOP[0] ? BUSSTOP[1] : BUSSTOP[0];

    // Walk to the stop
    const walkToStop = await getOutdoorRouteWithSteps(origin, fromStop.coordinates, WALKING_STRATEGY);

    // Shuttle ride
    const shuttleUrl = buildDirectionsUrl(fromStop.coordinates, toStop.coordinates, DRIVING_STRATEGY);
    const shuttleResponse = await fetch(shuttleUrl);
    const shuttleData: DirectionsResponse = await shuttleResponse.json();
    const shuttleLeg = shuttleData.routes?.[0]?.legs?.[0];

    const shuttleCoords = (shuttleLeg?.steps ?? []).flatMap((step) => {
      const encoded = step.polyline?.points;
      return encoded ? decodePolyline(encoded) : [];
    });

    // Walk from the stop to destination
    const walkFromStop = await getOutdoorRouteWithSteps(toStop.coordinates, destination, WALKING_STRATEGY);

    // Filter out "Empty" walking legs (if user is already at the stop)
    const validWalkToSteps = walkToStop.steps.filter(s => s.duration !== "1 min" || s.distance !== "0 m");
    const validWalkFromSteps = walkFromStop.steps.filter(s => s.duration !== "1 min" || s.distance !== "0 m");

    const totalMins =
      parseToMinutes(walkToStop.duration) +
      parseToMinutes(shuttleLeg?.duration?.text) +
      parseToMinutes(walkFromStop.duration);


    const parseDistance = (d?: string) => {
      if (!d) return 0;
      if (d.includes("km")) return parseFloat(d);
      if (d.includes("m")) return parseFloat(d) / 1000; // Convert meters to km
      return 0;
    };

    const totalDistance = parseDistance(walkToStop.distance) +
      parseDistance(shuttleLeg?.distance?.text) +
      parseDistance(walkFromStop.distance);

    return {
      coordinates: [...walkToStop.coordinates, ...shuttleCoords, ...walkFromStop.coordinates],
      segments: [
        { coordinates: walkToStop.coordinates, mode: "walking" },
        { coordinates: shuttleCoords, mode: "shuttle" },
        { coordinates: walkFromStop.coordinates, mode: "walking" },
      ],
      steps: [
        ...validWalkToSteps,
        {
          instruction: `Board Concordia shuttle at ${fromStop.name}`,
          distance: shuttleLeg?.distance?.text,
          duration: shuttleLeg?.duration?.text,
        },
        ...validWalkFromSteps,
      ],
      duration: formatMinutes(totalMins),
      distance: `${totalDistance.toFixed(1)} km`,
    };
  }

  // All other strategies (walking, cycling, transit, driving)
  const url = buildDirectionsUrl(origin, destination, strategy);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directions request failed: HTTP ${response.status}`);
  }

  const data: DirectionsResponse = await response.json();
  if (data.status !== "OK") {
    const msg = data.error_message ? ` (${data.error_message})` : "";
    throw new Error(`Directions API status: ${data.status ?? "UNKNOWN"}${msg}`);
  }

  const steps = data.routes?.[0]?.legs?.[0]?.steps;
  if (!steps?.length) {
    throw new Error(
      "No route steps returned (no walkable route or empty response).",
    );
  }

  const coordinates = steps.flatMap((step) => {
    const encoded = step.polyline?.points;
    return encoded ? decodePolyline(encoded) : [];
  });

  const leg = data.routes?.[0]?.legs?.[0];
  const routeSteps: RouteStep[] = steps.map((step) => ({
    instruction: step.html_instructions
      ? stripHtml(step.html_instructions)
      : "",
    distance: step.distance?.text,
    duration: step.duration?.text,
  }));

  return {
    coordinates,
    segments: [{ coordinates, mode: strategy.mode as any }],
    steps: routeSteps,
    duration: leg?.duration?.text,
    distance: leg?.distance?.text,
  };
}

export async function getOutdoorRoute(
  origin: LatLng,
  destination: LatLng,
  strategy: RouteStrategy = WALKING_STRATEGY,
): Promise<LatLng[]> {
  const { coordinates } = await getOutdoorRouteWithSteps(
    origin,
    destination,
    strategy,
  );
  return coordinates;
}

function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}
