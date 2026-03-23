// hooks/useFloorData.ts
import { useMemo } from "react";
import {
  getAvailableFloors,
  getBuildingPlanAsset,
  getFloorImageAsset,
  type BuildingPlanAsset,
} from "../utils/mapAssets";

export type ImageFloorPlan = number | string;
export type FloorPlan = ImageFloorPlan;

export function useFloorData(
  buildingName: string | null,
  floor: number,
): { floorPlan: FloorPlan | null; graphData: BuildingPlanAsset | null } {
  const floorPlan = useMemo(() => {
    if (!buildingName) return null;
    return getFloorImageAsset(buildingName, floor) ?? null;
  }, [buildingName, floor]);

  const graphData = useMemo(() => {
    if (!buildingName) return null;
    return getBuildingPlanAsset(buildingName) ?? null;
  }, [buildingName]);

  return { floorPlan, graphData };
}

export function getRegisteredFloors(buildingName: string): number[] {
  return getAvailableFloors(buildingName);
}
