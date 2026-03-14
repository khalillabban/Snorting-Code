/**
 * pixelToLatLng.ts
 * utils/pixelToLatLng.ts
 *
 * Works directly with your existing Buildings type — no new fields needed.
 * Derives the transform from your existing boundingBox polygon.
 */

import type { Buildings } from "../constants/type";

type LatLng = { latitude: number; longitude: number };

// GeoJSON pixel bounding box per building name.
// Find these by looking at the min/max x,y in your GeoJSON files.
// Add one entry per building that has an indoor map.
const GEOJSON_BOUNDS: Record<
  string,
  {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }
> = {
  MB: { minX: 726, minY: 171, maxX: 1969, maxY: 1997 },
  // SP: { minX: ..., minY: ..., maxX: ..., maxY: ... },
};

/**
 * Derives 4 axis-aligned corners from your existing boundingBox polygon
 * by finding the min/max lat and lng across all its points.
 */
function getCornersFromBoundingBox(boundingBox: LatLng[]) {
  let minLat = Infinity,
    maxLat = -Infinity;
  let minLng = Infinity,
    maxLng = -Infinity;

  for (const { latitude, longitude } of boundingBox) {
    if (latitude < minLat) minLat = latitude;
    if (latitude > maxLat) maxLat = latitude;
    if (longitude < minLng) minLng = longitude;
    if (longitude > maxLng) maxLng = longitude;
  }

  return {
    topLeft: { latitude: maxLat, longitude: minLng },
    topRight: { latitude: maxLat, longitude: maxLng },
    bottomRight: { latitude: minLat, longitude: maxLng },
    bottomLeft: { latitude: minLat, longitude: minLng },
  };
}

/**
 * Maps a GeoJSON pixel coordinate to a real-world lat/lng.
 * Call this for every vertex of every room polygon before passing to <Polygon>.
 */
export function pixelToLatLng(
  pixelX: number,
  pixelY: number,
  building: Buildings,
): LatLng {
  const bounds = GEOJSON_BOUNDS[building.name];

  if (!bounds) {
    // Building has no indoor map registered — return center as fallback
    console.warn(`pixelToLatLng: no bounds registered for "${building.name}"`);
    return building.coordinates;
  }

  if (!building.boundingBox?.length) {
    console.warn(
      `pixelToLatLng: building "${building.name}" has no boundingBox`,
    );
    return building.coordinates;
  }

  const corners = getCornersFromBoundingBox(building.boundingBox);

  // Normalize: 0 = left/top edge of GeoJSON, 1 = right/bottom edge
  const u = (pixelX - bounds.minX) / (bounds.maxX - bounds.minX);
  const v = 1 - (pixelY - bounds.minY) / (bounds.maxY - bounds.minY);
  // Bilinear interpolation across the 4 real-world corners
  const latitude =
    corners.topLeft.latitude * (1 - u) * (1 - v) +
    corners.topRight.latitude * u * (1 - v) +
    corners.bottomLeft.latitude * (1 - u) * v +
    corners.bottomRight.latitude * u * v;

  const longitude =
    corners.topLeft.longitude * (1 - u) * (1 - v) +
    corners.topRight.longitude * u * (1 - v) +
    corners.bottomLeft.longitude * (1 - u) * v +
    corners.bottomRight.longitude * u * v;

  return { latitude, longitude };
}
