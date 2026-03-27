import {
  OUTDOOR_POI_CATEGORY_MAP,
  type OutdoorPOICategoryId,
} from "../constants/outdoorPOI";

const NEARBY_SEARCH_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";

function requireGoogleApiKey(): string {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Add it to your env.",
    );
  }
  return apiKey;
}

export interface PlacePOI {
  placeId: string;
  name: string;
  latitude: number;
  longitude: number;
  vicinity: string;
  categoryId: OutdoorPOICategoryId;
  openNow?: boolean;
  rating?: number;
}

interface NearbySearchResult {
  place_id?: string;
  name?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  vicinity?: string;
  opening_hours?: { open_now?: boolean };
  rating?: number;
}

interface NearbySearchResponse {
  status?: string;
  error_message?: string;
  results?: NearbySearchResult[];
}

export async function fetchNearbyPOIs(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  categoryId: OutdoorPOICategoryId,
): Promise<PlacePOI[]> {
  const category = OUTDOOR_POI_CATEGORY_MAP[categoryId];
  if (!category) return [];

  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: String(radiusMeters),
    type: category.googlePlacesType,
    key: requireGoogleApiKey(),
  });

  const response = await fetch(`${NEARBY_SEARCH_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Places API request failed: HTTP ${response.status}`);
  }

  const data: NearbySearchResponse = await response.json();
  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    const msg = data.error_message ? ` (${data.error_message})` : "";
    throw new Error(`Places API status: ${data.status ?? "UNKNOWN"}${msg}`);
  }

  return (data.results ?? [])
    .filter(
      (r) =>
        r.place_id &&
        r.name &&
        r.geometry?.location?.lat != null &&
        r.geometry?.location?.lng != null,
    )
    .map((r) => ({
      placeId: r.place_id!,
      name: r.name!,
      latitude: r.geometry!.location!.lat!,
      longitude: r.geometry!.location!.lng!,
      vicinity: r.vicinity ?? "",
      categoryId,
      openNow: r.opening_hours?.open_now,
      rating: r.rating,
    }));
}

export async function fetchNearbyPOIsForCategories(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  categoryIds: OutdoorPOICategoryId[],
): Promise<PlacePOI[]> {
  if (categoryIds.length === 0) return [];

  const results = await Promise.all(
    categoryIds.map((id) =>
      fetchNearbyPOIs(latitude, longitude, radiusMeters, id).catch(
        () => [] as PlacePOI[],
      ),
    ),
  );

  // Deduplicate by placeId (a place can match multiple types)
  const seen = new Set<string>();
  return results.flat().filter((poi) => {
    if (seen.has(poi.placeId)) return false;
    seen.add(poi.placeId);
    return true;
  });
}
