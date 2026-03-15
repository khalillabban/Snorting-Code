import type { Buildings } from "../constants/type";

type LatLng = { latitude: number; longitude: number };

const CANVAS_SIZE: Record<string, { width: number; height: number }> = {
  MB: { width: 1969, height: 1997 },
};

export function pixelToLatLng(
  pixelX: number,
  pixelY: number,
  building: Buildings,
): LatLng {
  if (!building.mapCorners) {
    console.warn("[pixelToLatLng] No mapCorners for", building.name); // ← does this fire?
    return building.coordinates;
  }
  const canvas = CANVAS_SIZE[building.name];
  if (!canvas) return building.coordinates;

  const u = pixelX / canvas.width;
  const v = 1 - pixelY / canvas.height; // flip Y: pixels go down, lat goes up

  const { NW, NE, SW, SE } = building.mapCorners;

  const latitude =
    SW.latitude * (1 - u) * (1 - v) +
    SE.latitude * u * (1 - v) +
    NW.latitude * (1 - u) * v +
    NE.latitude * u * v;

  const longitude =
    SW.longitude * (1 - u) * (1 - v) +
    SE.longitude * u * (1 - v) +
    NW.longitude * (1 - u) * v +
    NE.longitude * u * v;

  return { latitude, longitude };
}
