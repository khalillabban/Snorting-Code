import { Buildings, Location } from "../constants/type";

/**
 * Ray-casting: returns true if point is inside the polygon (closed ring of coordinates).
 */
export function pointInPolygon(
  point: Location,
  polygon: Location[],
): boolean {
  const { latitude: lat, longitude: lng } = point;
  const n = polygon.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const lat1 = polygon[j].latitude;
    const lng1 = polygon[j].longitude;
    const lat2 = polygon[i].latitude;
    const lng2 = polygon[i].longitude;
    const crossesLat = (lat1 <= lat && lat < lat2) || (lat2 <= lat && lat < lat1);
    if (!crossesLat) continue;
    const t = (lat - lat1) / (lat2 - lat1);
    const lngCross = lng1 + t * (lng2 - lng1);
    if (lngCross > lng) inside = !inside;
  }
  return inside;
}

/**
 * Returns the first building whose boundingBox contains the point, or null.
 */
export function getBuildingContainingPoint(
  point: Location,
  buildings: Buildings[],
): Buildings | null {
  for (const building of buildings) {
    if (!building.boundingBox || building.boundingBox.length < 3) continue;
    if (pointInPolygon(point, building.boundingBox)) return building;
  }
  return null;
}

/**
 * Distance from a point to a line segment (flat approximation).
 */
function distanceToSegment(
  point: Location,
  v: Location,
  w: Location,
): number {
  const l2 =
    (w.latitude - v.latitude) ** 2 +
    (w.longitude - v.longitude) ** 2;

  if (l2 === 0) {
    return Math.sqrt(
      (point.latitude - v.latitude) ** 2 +
      (point.longitude - v.longitude) ** 2
    );
  }

  let t =
    ((point.latitude - v.latitude) * (w.latitude - v.latitude) +
      (point.longitude - v.longitude) *
      (w.longitude - v.longitude)) /
    l2;

  t = Math.max(0, Math.min(1, t));

  const projection = {
    latitude: v.latitude + t * (w.latitude - v.latitude),
    longitude: v.longitude + t * (w.longitude - v.longitude),
  };

  return Math.sqrt(
    (point.latitude - projection.latitude) ** 2 +
    (point.longitude - projection.longitude) ** 2
  );
}

/**
 * Returns minimum distance from point to polygon edges.
 * Returns 0 if point is inside polygon.
 */
export function getDistanceToPolygon(
  point: Location,
  polygon: Location[],
): number {
  if (!polygon || polygon.length < 3) return Infinity;

  // If inside building → distance = 0
  if (pointInPolygon(point, polygon)) {
    return 0;
  }

  let minDistance = Infinity;

  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;

    const d = distanceToSegment(
      point,
      polygon[i],
      polygon[next],
    );

    if (d < minDistance) {
      minDistance = d;
    }
  }

  return minDistance;
}

