// hooks/useFloorData.ts
import { useMemo } from "react";
import type { GeoJSONData } from "../utils/IndoorMapComposite";
import {
  getFloorGraphData,
  type FloorGraphData,
} from "../utils/IndoorNavigationGraph";

export type FloorPlan = GeoJSONData;

const FLOOR_REGISTRY: Record<string, Record<number, FloorPlan>> = {
  MB: {
    1: require("../assets/maps/MB-1.json"),
  },
};

export function useFloorData(
  buildingName: string | null,
  floor: number,
): { floorPlan: FloorPlan | null; graphData: FloorGraphData | null } {
  const floorPlan = useMemo(() => {
    if (!buildingName) return null;
    return FLOOR_REGISTRY[buildingName]?.[floor] ?? null;
  }, [buildingName, floor]);

  const graphData = useMemo(() => {
    if (!buildingName) return null;
    return getFloorGraphData(buildingName);
  }, [buildingName]);

  return { floorPlan, graphData };
}

export function getRegisteredFloors(buildingName: string): number[] {
  const entry = FLOOR_REGISTRY[buildingName];
  if (!entry) return [];
  return Object.keys(entry)
    .map(Number)
    .sort((a, b) => a - b);
}
