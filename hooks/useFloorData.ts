// hooks/useFloorData.ts
import { useMemo } from "react";
import {
  getFloorGraphData,
  type FloorGraphData,
} from "../utils/IndoorNavigationGraph";
import {
  getFloorPlanAsset,
  getRegisteredIndoorFloors,
  type FloorPlan
} from "../utils/indoorMapAssets";

export type { FloorPlan, ImageFloorPlan } from "../utils/indoorMapAssets";

export function useFloorData(
  buildingName: string | null,
  floor: number,
): { floorPlan: FloorPlan | null; graphData: FloorGraphData | null } {
  const floorPlan = useMemo(() => {
    return getFloorPlanAsset(buildingName, floor);
  }, [buildingName, floor]);

  const graphData = useMemo(() => {
    if (!buildingName) return null;
    return getFloorGraphData(buildingName);
  }, [buildingName]);

  return { floorPlan, graphData };
}

export function getRegisteredFloors(buildingName: string): number[] {
  return getRegisteredIndoorFloors(buildingName);
}
