import { WALKING_STRATEGY } from '../constants/strategies';
import { RouteStrategy } from './Routing';

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface LatLng {
  latitude: number;
  longitude: number;
}


export interface RouteStep {
  instruction: string;
  distance?: string;
  duration?: string;
}

type DirectionsResponse = {
  status?: string;
  error_message?: string;
  routes?: Array<{
    legs?: Array<{
      distance?: { text?: string };
      duration?: { text?: string };
      steps?: Array<{
        polyline?: { points?: string };
        html_instructions?: string;
        distance?: { text?: string };
        duration?: { text?: string };
      }>;
    }>;
  }>;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function requireGoogleApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your env (and restart Metro)."
    );
  }

  return apiKey;
}


function buildDirectionsUrl(origin: LatLng, destination: LatLng, strategy: RouteStrategy): string {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");

  url.search = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: strategy.mode,
    key: requireGoogleApiKey(),
  }).toString();

  return url.toString();
}

export interface OutdoorRouteResult {
  coordinates: LatLng[];
  steps: RouteStep[];
  duration?: string;
  distance?: string;
}

export async function getOutdoorRouteWithSteps(
  origin: LatLng,
  destination: LatLng,
  strategy: RouteStrategy = WALKING_STRATEGY
): Promise<OutdoorRouteResult> {
  if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return { coordinates: [], steps: [], duration: undefined, distance: undefined };
  }
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
    throw new Error("No route steps returned (no walkable route or empty response).");
  }

  const coordinates = steps.flatMap((step) => {
    const encoded = step.polyline?.points;
    return encoded ? decodePolyline(encoded) : [];
  });

  const routeSteps: RouteStep[] = steps.map((step) => ({
    instruction: step.html_instructions ? stripHtml(step.html_instructions) : "",
    distance: step.distance?.text,
    duration: step.duration?.text,
  }));

  const leg = data.routes?.[0]?.legs?.[0];
  const duration = leg?.duration?.text;
  const distance = leg?.distance?.text;

  return { coordinates, steps: routeSteps, duration, distance };
}

export async function getOutdoorRoute(
  origin: LatLng,
  destination: LatLng,
  strategy: RouteStrategy = WALKING_STRATEGY
): Promise<LatLng[]> {
  const { coordinates } = await getOutdoorRouteWithSteps(origin, destination, strategy);
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
