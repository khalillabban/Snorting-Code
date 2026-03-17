import type { GeoJSONData } from "./IndoorMapComposite";

export type ImageFloorPlan = number | { uri: string };
export type FloorPlan = GeoJSONData | ImageFloorPlan;

// Prefer the new assets/maps directory. Where it currently contains only SVG files,
// fall back to raster copies from mapsbackup because Metro cannot load those SVGs as
// react-native-maps Overlay image assets in the current project configuration.
const FLOOR_IMAGE_REGISTRY: Record<string, Record<number, ImageFloorPlan>> = {
  MB: {
    1: require("../assets/maps/mb_1.png"),
    [-2]: require("../assets/maps/mb_s2.png"),
  },
  H: {
    1: require("../assets/maps/H1.png"),
    2: require("../assets/maps/H2.png"),
    8: require("../assets/maps/hall8.png"),
    9: require("../assets/maps/hall9.png"),
  },
  VL: {
    1: require("../assets/maps/vl_1.png"),
    2: require("../assets/maps/vl_2.png"),
  },
  VE: {
    1: require("../assets/maps/ve1.png"),
    2: require("../assets/maps/ve2.png"),
  },
  CC: {
    1: require("../assets/maps/CC1.png"),
  },
};

const FLOOR_GEOJSON_REGISTRY: Record<string, Record<number, GeoJSONData>> = {
  MB: {
    1: require("../assets/mapsbackup/MB-1.json"),
    [-2]: require("../assets/mapsbackup/MB-S2.json"),
  },
};

export function getFloorPlanAsset(
  buildingName: string | null | undefined,
  floor: number,
): ImageFloorPlan | null {
  if (!buildingName) return null;
  return FLOOR_IMAGE_REGISTRY[buildingName]?.[floor] ?? null;
}

export function getFloorGeoJSON(
  buildingName: string | null | undefined,
  floor: number,
): GeoJSONData | null {
  if (!buildingName) return null;
  return FLOOR_GEOJSON_REGISTRY[buildingName]?.[floor] ?? null;
}

export function getRegisteredIndoorFloors(buildingName: string): number[] {
  const imageFloors = Object.keys(FLOOR_IMAGE_REGISTRY[buildingName] ?? {}).map(
    Number,
  );
  const geoJsonFloors = Object.keys(
    FLOOR_GEOJSON_REGISTRY[buildingName] ?? {},
  ).map(Number);

  return Array.from(new Set([...imageFloors, ...geoJsonFloors])).sort(
    (a, b) => {
      if (a < 0 && b >= 0) return 1;
      if (a >= 0 && b < 0) return -1;
      return a - b;
    },
  );
}
