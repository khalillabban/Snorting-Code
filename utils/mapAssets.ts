export interface LegacyFloorGeoJsonAsset {
  type: string;
  features: Array<{
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
  }>;
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

interface IndoorBuildingAssets {
  floors: number[];
  floorImages: Partial<Record<number, number>>;
  buildingPlanAsset?: BuildingPlanAsset;
  legacyFloorGeoJson?: Partial<Record<number, LegacyFloorGeoJsonAsset>>;
}

const INDOOR_ASSET_REGISTRY: Record<string, IndoorBuildingAssets> = {
  CC: {
    floors: [1],
    floorImages: {
      1: require("../assets/maps/CC1.png"),
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/cc1.json") as BuildingPlanAsset,
  },
  H: {
    floors: [1, 2, 8, 9],
    floorImages: {
      1: require("../assets/maps/H-1.png"),
      2: require("../assets/maps/H-2.png"),
      8: require("../assets/maps/H-8.png"),
      9: require("../assets/maps/H-9.png"),
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/hall.json") as BuildingPlanAsset,
  },
  LB: {
    floors: [2, 3, 4, 5],
    floorImages: {
      2: require("../assets/maps/LB2-n-s.png"),
      3: require("../assets/maps/LB3-n-s.png"),
      4: require("../assets/maps/LB4-n-s.png"),
      5: require("../assets/maps/LB5-n-s.png"),
    },
  },
  MB: {
    floors: [1, -2],
    floorImages: {
      1: require("../assets/maps/MB-1.png"),
      [-2]: require("../assets/maps/MB-S2.png"),
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/mb_floors_combined.json") as BuildingPlanAsset,
    legacyFloorGeoJson: {
      1: require("../assets/maps/MB-1.json") as LegacyFloorGeoJsonAsset,
      [-2]: require("../assets/maps/MB-S2.json") as LegacyFloorGeoJsonAsset,
    },
  },
  VE: {
    floors: [1, 2],
    floorImages: {
      1: require("../assets/maps/VE-1.png"),
      2: require("../assets/maps/VE-2.png"),
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/ve.json") as BuildingPlanAsset,
  },
  VL: {
    floors: [1, 2],
    floorImages: {
      1: require("../assets/maps/VL-1.png"),
      2: require("../assets/maps/VL-2.png"),
    },
    buildingPlanAsset: require("../assets/maps/buildingsPlan/vl_floors_combined.json") as BuildingPlanAsset,
  },
};

export function normalizeIndoorBuildingCode(buildingCode: string): string {
  const normalized = buildingCode.trim().toUpperCase();
  if (normalized === "HALL") return "H";
  return normalized;
}

function getIndoorAssets(buildingCode: string): IndoorBuildingAssets | undefined {
  const normalizedBuildingCode = normalizeIndoorBuildingCode(buildingCode);
  return INDOOR_ASSET_REGISTRY[normalizedBuildingCode];
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
): number | undefined {
  return getIndoorAssets(buildingCode)?.floorImages[floor];
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
