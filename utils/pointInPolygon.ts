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
