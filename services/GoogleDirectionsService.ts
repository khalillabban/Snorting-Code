const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

interface LatLng {
  latitude: number;
  longitude: number;
}

type DirectionsResponse = {
  status?: string;
  error_message?: string;
  routes?: Array<{
    legs?: Array<{
      steps?: Array<{
        polyline?: { points?: string };
      }>;
    }>;
  }>;
};

function requireGoogleApiKey(): string {
  if (!GOOGLE_API_KEY) {
    throw new Error(
      'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your env (and restart Metro).'
    );
  }
  return GOOGLE_API_KEY;
}

function buildDirectionsUrl(origin: LatLng, destination: LatLng): string {
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");

  url.search = new URLSearchParams({
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    mode: "walking",
    key: requireGoogleApiKey(),
  }).toString();

  return url.toString();
}

export async function getOutdoorRoute(
  origin: LatLng,
  destination: LatLng
): Promise<LatLng[]> {
  const url = buildDirectionsUrl(origin, destination);

  const response = await fetch(url);
  if (!response.ok) {
    // In many cases Google still returns JSON, but response.ok being false is a big red flag.
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

  // Avoid O(n^2) concat in a loop
  return steps.flatMap((step) => {
    const encoded = step.polyline?.points;
    return encoded ? decodePolyline(encoded) : [];
  });
}

/* Polyline decoder */
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
