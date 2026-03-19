import {
  BuildingPlanAsset,
  BuildingPlanNode,
  getBuildingPlanAsset,
  normalizeIndoorBuildingCode,
} from "./mapAssets";

export interface IndoorRoomRecord {
  id: string;
  buildingCode: string;
  floor: number;
  label: string;
  roomNumber: string;
  roomName?: string;
  aliases: string[];
  x: number;
  y: number;
  accessible: boolean;
  searchTerms: string[];
  searchKeys: string[];
}

export interface NormalizedIndoorBuildingPlan {
  buildingCode: string;
  floors: number[];
  rooms: IndoorRoomRecord[];
  roomsByFloor: Record<number, IndoorRoomRecord[]>;
}

export function compactIndoorSearchKey(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeSearchValue(value?: string): string {
  return value?.trim().toUpperCase() ?? "";
}

function extractRoomNumber(
  node: BuildingPlanNode,
  label: string,
  buildingCode: string,
): string {
  const explicitRoomNumber = normalizeSearchValue(node.roomNumber);
  if (explicitRoomNumber) {
    return explicitRoomNumber;
  }

  const normalizedLabel = label.trim().toUpperCase();
  const prefix = `${buildingCode}-`;
  if (normalizedLabel.startsWith(prefix)) {
    return normalizedLabel.slice(prefix.length);
  }
  return normalizedLabel;
}

function resolveFloorFromLabel(
  buildingCode: string,
  label: string,
  fallbackFloor: number,
): number {
  const normalizedLabel = label.trim().toUpperCase();

  if (buildingCode === "MB" && normalizedLabel.startsWith("MB-S2")) {
    return -2;
  }

  return fallbackFloor;
}

function buildRoomRecord(
  buildingCode: string,
  node: BuildingPlanNode,
): IndoorRoomRecord | null {
  if (node.type !== "room" || !node.label?.trim()) {
    return null;
  }

  const normalizedLabel = normalizeSearchValue(node.label);
  const roomNumber = extractRoomNumber(node, normalizedLabel, buildingCode);
  const roomName = normalizeSearchValue(node.displayName ?? node.name);
  const aliases = uniqueNonEmpty(
    (node.aliases ?? []).map((alias) => normalizeSearchValue(alias)),
  );
  const floor = resolveFloorFromLabel(buildingCode, normalizedLabel, node.floor);
  const searchTerms = uniqueNonEmpty([
    normalizedLabel,
    roomNumber,
    roomName,
    ...aliases,
  ]);
  const searchKeys = uniqueNonEmpty(
    searchTerms.map((value) => compactIndoorSearchKey(value)),
  );

  return {
    id: node.id,
    buildingCode,
    floor,
    label: normalizedLabel,
    roomNumber,
    roomName: roomName || undefined,
    aliases,
    x: node.x,
    y: node.y,
    accessible: node.accessible,
    searchTerms,
    searchKeys,
  };
}

export function normalizeBuildingPlanAsset(
  asset: BuildingPlanAsset,
  buildingCodeOverride?: string,
): NormalizedIndoorBuildingPlan {
  const buildingCode = normalizeIndoorBuildingCode(
    buildingCodeOverride ?? asset.meta.buildingId,
  );

  const rooms = asset.nodes
    .map((node) => buildRoomRecord(buildingCode, node))
    .filter((room): room is IndoorRoomRecord => room != null);

  const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);
  const roomsByFloor = floors.reduce<Record<number, IndoorRoomRecord[]>>(
    (acc, floor) => {
      acc[floor] = rooms.filter((room) => room.floor === floor);
      return acc;
    },
    {},
  );

  return {
    buildingCode,
    floors,
    rooms,
    roomsByFloor,
  };
}

export function getNormalizedBuildingPlan(
  buildingCode: string,
): NormalizedIndoorBuildingPlan | null {
  const asset = getBuildingPlanAsset(buildingCode);
  if (!asset) return null;
  return normalizeBuildingPlanAsset(asset, buildingCode);
}
