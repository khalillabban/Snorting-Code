export interface LegacyFloorGeoJsonAsset {
  type: string;
  features: {
    type: string;
    properties: {
      name: string;
      type: string;
      centroid?: number[];
    };
    geometry: {
      type: string;
      coordinates: number[][][];
    };
  }[];
}

export interface BuildingPlanNode {
  id: string;
  type: string;
  buildingId: string;
  floor: number;
  x: number;
  y: number;
  label: string;
  accessible: boolean;
  roomNumber?: string;
  name?: string;
  displayName?: string;
  aliases?: string[];
}

export interface BuildingPlanEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  accessible: boolean;
}

export interface BuildingPlanAsset {
  meta: {
    buildingId: string;
  };
  nodes: BuildingPlanNode[];
  edges?: BuildingPlanEdge[];
}

export interface IndoorFloorImageAsset {
  source: number | string;
  width: number;
  height: number;
  coordinateScale: number;
  showFullImage?: boolean;
}

type FloorPlanSvgSourceKey =
  | "CC1"
  | "H1"
  | "H2"
  | "H8"
  | "H9"
  | "VE1"
  | "VE2";

type IndoorFloorImageAssetConfig = Omit<IndoorFloorImageAsset, "source"> & {
  source?: number | string;
  sourceKey?: FloorPlanSvgSourceKey;
};

interface IndoorBuildingAssets {
  floors: number[];
  floorImages: Partial<Record<number, IndoorFloorImageAssetConfig>>;
  buildingPlanAsset?: BuildingPlanAsset;
  legacyFloorGeoJson?: Partial<Record<number, LegacyFloorGeoJsonAsset>>;
}

let floorPlanSvgSourcesCache:
  | Record<FloorPlanSvgSourceKey, string>
  | null = null;

function getFloorPlanSvgSources(): Record<FloorPlanSvgSourceKey, string> {
  if (!floorPlanSvgSourcesCache) {
    floorPlanSvgSourcesCache = (
      require("./floorPlanSvgSources") as {
        FLOOR_PLAN_SVG_SOURCES: Record<FloorPlanSvgSourceKey, string>;
      }
    ).FLOOR_PLAN_SVG_SOURCES;
  }

  return floorPlanSvgSourcesCache;
}

function resolveFloorImageAsset(
  imageConfig?: IndoorFloorImageAssetConfig,
): IndoorFloorImageAsset | undefined {
  if (!imageConfig) return undefined;

  const source = imageConfig.sourceKey
    ? getFloorPlanSvgSources()[imageConfig.sourceKey]
    : imageConfig.source;

  if (!source) return undefined;

  return {
    source,
    width: imageConfig.width,
    height: imageConfig.height,
    coordinateScale: imageConfig.coordinateScale,
    showFullImage: imageConfig.showFullImage,
  };
}


// Registry of asset loader functions (not the assets themselves)
const INDOOR_ASSET_LOADERS: Record<string, () => IndoorBuildingAssets> = {
  CC: () => ({
    floors: [1],
    floorImages: {
      1: {
        sourceKey: "CC1",
        width: 4096,
        height: 1024,
        coordinateScale: 0.5,
      },
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/cc1.json") as BuildingPlanAsset,
  }),
  H: () => ({
    floors: [1, 2, 8, 9],
    floorImages: {
      1: {
        sourceKey: "H1",
        width: 1024,
        height: 1024,
        coordinateScale: 0.5,
      },
      2: {
        sourceKey: "H2",
        width: 1024,
        height: 1024,
        coordinateScale: 0.5,
      },
      8: {
        sourceKey: "H8",
        width: 1024,
        height: 1024,
        coordinateScale: 0.5,
      },
      9: {
        sourceKey: "H9",
        width: 1024,
        height: 1024,
        coordinateScale: 0.5,
      },
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/hall.json") as BuildingPlanAsset,
  }),
  MB: () => ({
    floors: [1, -2],
    floorImages: {
      1: {
        source: require("../assets/maps/FloorPlans/mb_1.png"),
        width: 1024,
        height: 1024,
        coordinateScale: 1,
        showFullImage: true,
      },
      [-2]: {
        source: require("../assets/maps/FloorPlans/mb_s2.png"),
        width: 1024,
        height: 1024,
        coordinateScale: 1,
        showFullImage: true,
      },
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/mb_floors_combined.json") as BuildingPlanAsset,
    legacyFloorGeoJson: {
      1: require("../assets/maps/MB-1.json") as LegacyFloorGeoJsonAsset,
      [-2]: require("../assets/maps/MB-S2.json") as LegacyFloorGeoJsonAsset,
    },
  }),
  VE: () => ({
    floors: [1, 2],
    floorImages: {
      1: {
        sourceKey: "VE1",
        width: 1024,
        height: 1024,
        coordinateScale: 0.5,
      },
      2: {
        sourceKey: "VE2",
        width: 1024,
        height: 1024,
        coordinateScale: 0.5,
      },
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/ve.json") as BuildingPlanAsset,
  }),
  VL: () => ({
    floors: [1, 2],
    floorImages: {
      1: {
        source: require("../assets/maps/FloorPlans/vl_1.png"),
        width: 1024,
        height: 1024,
        coordinateScale: 1,
      },
      2: {
        source: require("../assets/maps/FloorPlans/vl_2.png"),
        width: 1024,
        height: 1024,
        coordinateScale: 1,
      },
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/vl_floors_combined.json") as BuildingPlanAsset,
  }),
};

// Cache for loaded assets
const INDOOR_ASSET_CACHE: Record<string, IndoorBuildingAssets> = {};

export function normalizeIndoorBuildingCode(buildingCode: string): string {
  const normalized = buildingCode.trim().toUpperCase();
  if (normalized === "HALL") return "H";
  return normalized;
}

function getIndoorAssets(buildingCode: string): IndoorBuildingAssets | undefined {
  const normalizedBuildingCode = normalizeIndoorBuildingCode(buildingCode);
  if (!(normalizedBuildingCode in INDOOR_ASSET_CACHE)) {
    const loader = INDOOR_ASSET_LOADERS[normalizedBuildingCode];
    if (loader) {
      INDOOR_ASSET_CACHE[normalizedBuildingCode] = loader();
    }
  }
  return INDOOR_ASSET_CACHE[normalizedBuildingCode];
}

export function hasFloorMap(buildingCode: string, floor: number): boolean {
  return floor in (getIndoorAssets(buildingCode)?.floorImages ?? {});
}

export function getAvailableFloors(buildingCode: string): number[] {
  return [...(getIndoorAssets(buildingCode)?.floors ?? [])];
}

export function getFloorImageAsset(
  buildingCode: string,
  floor: number,
): number | string | undefined {
  return resolveFloorImageAsset(getIndoorAssets(buildingCode)?.floorImages[floor])
    ?.source;
}

export function getFloorImageMetadata(
  buildingCode: string,
  floor: number,
): IndoorFloorImageAsset | undefined {
  return resolveFloorImageAsset(getIndoorAssets(buildingCode)?.floorImages[floor]);
}

export function hasBuildingPlanAsset(buildingCode: string): boolean {
  return getBuildingPlanAsset(buildingCode) != null;
}

export function getBuildingPlanAsset(
  buildingCode: string,
): BuildingPlanAsset | undefined {
  return getIndoorAssets(buildingCode)?.buildingPlanAsset;
}

export function getLegacyFloorGeoJsonAsset(
  buildingCode: string,
  floor: number,
): LegacyFloorGeoJsonAsset | undefined {
  return getIndoorAssets(buildingCode)?.legacyFloorGeoJson?.[floor];
}
