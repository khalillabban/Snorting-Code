import {
  OUTDOOR_POI_CATEGORY_MAP,
  type OutdoorPOICategoryId,
} from "../constants/outdoorPOI";

const NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";

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

interface NewPlaceResult {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  shortFormattedAddress?: string;
  formattedAddress?: string;
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { openNow?: boolean };
  rating?: number;
}

interface NearbySearchNewResponse {
  places?: NewPlaceResult[];
  error?: { message?: string; status?: string };
}

export async function fetchNearbyPOIs(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  categoryId: OutdoorPOICategoryId,
): Promise<PlacePOI[]> {
  const category = OUTDOOR_POI_CATEGORY_MAP[categoryId];
  if (!category) return [];

  const body = {
    includedTypes: [category.googlePlacesType],
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude, longitude },
        radius: radiusMeters,
      },
    },
  };

  const response = await fetch(NEARBY_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireGoogleApiKey(),
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.shortFormattedAddress,places.formattedAddress,places.currentOpeningHours,places.rating",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Places API request failed: HTTP ${response.status}`);
  }

  const data: NearbySearchNewResponse = await response.json();

  if (data.error) {
    throw new Error(
      `Places API error: ${data.error.status ?? "UNKNOWN"} – ${data.error.message ?? ""}`,
    );
  }

  return (data.places ?? [])
    .filter(
      (r) =>
        r.id &&
        r.displayName?.text &&
        r.location?.latitude != null &&
        r.location?.longitude != null,
    )
    .map((r) => ({
      placeId: r.id!,
      name: r.displayName!.text!,
      latitude: r.location!.latitude!,
      longitude: r.location!.longitude!,
      vicinity:
        r.shortFormattedAddress ?? r.formattedAddress ?? "",
      categoryId,
      openNow: r.currentOpeningHours?.openNow ?? r.regularOpeningHours?.openNow,
      rating: r.rating,
    }));
}

export interface NearbyPOIResult {
  pois: PlacePOI[];
  errors: string[];
}

export async function fetchNearbyPOIsForCategories(
  latitude: number,
  longitude: number,
  radiusMeters: number,
  categoryIds: OutdoorPOICategoryId[],
): Promise<NearbyPOIResult> {
  if (categoryIds.length === 0) return { pois: [], errors: [] };

  const settled = await Promise.allSettled(
    categoryIds.map((id) =>
      fetchNearbyPOIs(latitude, longitude, radiusMeters, id),
    ),
  );

  const pois: PlacePOI[] = [];
  const errors: string[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      pois.push(...result.value);
    } else {
      const categoryLabel = OUTDOOR_POI_CATEGORY_MAP[categoryIds[i]]?.label ?? categoryIds[i];
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors.push(`${categoryLabel}: ${reason}`);
    }
  });

  const seen = new Set<string>();
  const deduplicated = pois.filter((poi) => {
    if (seen.has(poi.placeId)) return false;
    seen.add(poi.placeId);
    return true;
  });

  return { pois: deduplicated, errors };
}
