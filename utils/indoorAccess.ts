import {
    getAvailableFloors,
    hasBuildingPlanAsset,
    normalizeIndoorBuildingCode,
} from "./mapAssets";

export interface IndoorAccessState {
  buildingCode: string;
  floors: number[];
  hasIndoorMap: boolean;
  hasSearchableRooms: boolean;
}

export interface IndoorMapRouteParams {
  [key: string]: string | undefined;
  buildingName: string;
  floors: string;
  roomQuery?: string;
}

export function normalizeRoomQuery(buildingCode: string, room: string): string {
  const trimmed = room.trim();
  if (!trimmed) return "";
  const prefix = `${buildingCode.toUpperCase()}-`;
  if (trimmed.toUpperCase().startsWith(prefix)) return trimmed;
  return `${prefix}${trimmed}`;
}

export function getIndoorAccessState(
  buildingCode?: string | null,
): IndoorAccessState {
  const normalizedBuildingCode = buildingCode?.trim()
    ? normalizeIndoorBuildingCode(buildingCode)
    : "";
  const floors = normalizedBuildingCode
    ? getAvailableFloors(normalizedBuildingCode)
    : [];

  return {
    buildingCode: normalizedBuildingCode,
    floors,
    hasIndoorMap: floors.length > 0,
    hasSearchableRooms:
      normalizedBuildingCode !== "" &&
      floors.length > 0 &&
      hasBuildingPlanAsset(normalizedBuildingCode),
  };
}

export function buildIndoorMapRouteParams(
  buildingCode?: string | null,
  roomQuery?: string,
): IndoorMapRouteParams | null {
  const access = getIndoorAccessState(buildingCode);

  if (!access.hasIndoorMap || !access.buildingCode) {
    return null;
  }

  const params: IndoorMapRouteParams = {
    buildingName: access.buildingCode,
    floors: JSON.stringify(access.floors),
  };

  const trimmedRoomQuery = roomQuery?.trim();
  if (trimmedRoomQuery && access.hasSearchableRooms) {
    params.roomQuery = trimmedRoomQuery;
  }

  return params;
}
