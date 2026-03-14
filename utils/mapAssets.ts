import { getRegisteredFloors } from "../hooks/useFloorData";
const AVAILABLE_MAPS: Record<string, number[]> = {
  CC: [1],
  H: [1, 2, 8, 9],
  LB: [2, 3, 4, 5],
  MB: [1, -2],
  VE: [1, 2],
  VL: [1, 2],
};

export function hasFloorMap(buildingCode: string, floor: number): boolean {
  const floors = AVAILABLE_MAPS[buildingCode];
  return floors ? floors.includes(floor) : false;
}

export function getAvailableFloors(buildingName: string): number[] {
  return getRegisteredFloors(buildingName) ?? [];
}
