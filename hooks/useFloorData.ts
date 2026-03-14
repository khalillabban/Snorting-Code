/**
 * useFloorData.ts
 * hooks/useFloorData.ts
 *
 * Loads the GeoJSON floor plan for a given building + floor number.
 * Add one entry per building/floor in FLOOR_REGISTRY below.
 */

import { useMemo } from "react";

type GeoJsonFeature = {
  properties: { name: string; type: string };
  geometry: { coordinates: number[][][] };
};

type FloorPlan = {
  features: GeoJsonFeature[];
};

// ─────────────────────────────────────────────────────────────
// Register your floor plan JSON files here.
// Metro bundler requires static require() paths — no dynamic imports.
//
// File structure:
//   assets/indoor/MB/floor_1.json
//   assets/indoor/MB/floor_2.json
//   assets/indoor/SP/floor_1.json
// ─────────────────────────────────────────────────────────────
const FLOOR_REGISTRY: Record<string, Record<number, FloorPlan>> = {
  MB: {
    1: require("../assets/maps/MB-1.json"),
    2: require("../assets/maps/MB-S2.json"),
  },
  // SP: {
  //   1: require('../assets/indoor/SP/floor_1.json'),
  // },
};

export function useFloorData(
  buildingName: string | null,
  floor: number,
): { floorPlan: FloorPlan | null } {
  const floorPlan = useMemo(() => {
    if (!buildingName) return null;
    return FLOOR_REGISTRY[buildingName]?.[floor] ?? null;
  }, [buildingName, floor]);

  return { floorPlan };
}

// ─────────────────────────────────────────────────────────────
// Helper used by getAvailableFloors() in utils/mapAssets.ts
// Returns the floor numbers registered for a given building.
// ─────────────────────────────────────────────────────────────
export function getRegisteredFloors(buildingName: string): number[] {
  const entry = FLOOR_REGISTRY[buildingName];
  if (!entry) return [];
  return Object.keys(entry)
    .map(Number)
    .sort((a, b) => a - b);
}
