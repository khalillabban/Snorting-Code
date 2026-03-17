//pixelToLatLng.ts
import type { Buildings } from "../constants/type";

type LatLng = { latitude: number; longitude: number };

const CANVAS_SIZE: Record<string, { width: number; height: number }> = {
  MB: { width: 1969, height: 1997 },
  H: { width: 2040, height: 2000 }, // ← was 1000x1000, wrong
};

const BUILDING_CALIBRATION: Record<
  string,
  {
    gpsCorners: { latitude: number; longitude: number }[];
  }
> = {
  H: {
    gpsCorners: [
      { latitude: 45.497708183281496, longitude: -73.5790334123961 }, // tl = NW (top-left)
      { latitude: 45.4973720615268, longitude: -73.57833870872308 }, // tr = NE (top-right)
      { latitude: 45.49682818364492, longitude: -73.57884845912251 }, // br = SE (bottom-right)
      { latitude: 45.497163503733475, longitude: -73.57954223351966 }, // bl = SW (bottom-left)
    ],
  },
  MB: {
    // MB is rotated — these are approximate, tune after seeing result
    gpsCorners: [
      { latitude: 45.495597, longitude: -73.579318 }, // NW
      { latitude: 45.495236, longitude: -73.578476 }, // NE
      { latitude: 45.495027, longitude: -73.5787 }, // SE
      { latitude: 45.495296, longitude: -73.579624 }, // SW
    ],
  },
};

export function pixelToLatLng(
  px: number,
  py: number,
  building: Buildings,
  debugOnce?: boolean,
): LatLng | null {
  const cal = BUILDING_CALIBRATION[building.name];

  if (cal) {
    // Bilinear interpolation using 4 corner points
    const [tl, tr, br, bl] = cal.gpsCorners;
    const nativeW = CANVAS_SIZE[building.name]?.width ?? 1969;
    const nativeH = CANVAS_SIZE[building.name]?.height ?? 1997;

    const u = px / nativeW; // 0→1 left to right
    const v = py / nativeH; // 0→1 top to bottom

    const lat =
      tl.latitude * (1 - u) * (1 - v) +
      tr.latitude * u * (1 - v) +
      br.latitude * u * v +
      bl.latitude * (1 - u) * v;

    const lng =
      tl.longitude * (1 - u) * (1 - v) +
      tr.longitude * u * (1 - v) +
      br.longitude * u * v +
      bl.longitude * (1 - u) * v;

    if (debugOnce) {
      console.log("[IndoorPath] bilinear u/v:", u, v);
      console.log("[IndoorPath] GPS out:", { latitude: lat, longitude: lng });
    }

    return { latitude: lat, longitude: lng };
  }

  // Fallback: simple axis-aligned projection
  const box = building.boundingBox;
  if (!box || box.length < 4) return null;
  const lats = box.map((p) => p.latitude);
  const lngs = box.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const nativeW = CANVAS_SIZE[building.name]?.width ?? 1000;
  const nativeH = CANVAS_SIZE[building.name]?.height ?? 1000;
  const lng = minLng + (px / nativeW) * (maxLng - minLng);
  const lat = maxLat - (py / nativeH) * (maxLat - minLat);
  return { latitude: lat, longitude: lng };
}
