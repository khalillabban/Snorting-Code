import { BUILDINGS } from "../constants/buildings";
import { Buildings } from "../constants/type";
import { getIndoorAccessState } from "./indoorAccess";
import { compactIndoorSearchKey, getNormalizedBuildingPlan, IndoorRoomRecord } from "./indoorBuildingPlan";

const MAX_SUGGESTIONS = 20;

export type SearchResult =
  | { kind: "building"; building: Buildings }
  | { kind: "room"; room: IndoorRoomRecord; building: Buildings };

export function resultLabel(result: SearchResult): string {
  if (result.kind === "building") return result.building.displayName;
  return result.room.roomName
    ? `${result.room.label} — ${result.room.roomName}`
    : result.room.label;
}

export function resultSubtitle(result: SearchResult): string {
  if (result.kind === "building") return result.building.campusName;
  return `${result.building.displayName} · Floor ${result.room.floor}`;
}

let _cachedIndex: SearchResult[] | null = null;

function buildSearchIndex(): SearchResult[] {
  const index: SearchResult[] = [];

  for (const building of BUILDINGS) {
    index.push({ kind: "building", building });

    const access = getIndoorAccessState(building.name);
    if (!access.hasSearchableRooms) continue;

    const plan = getNormalizedBuildingPlan(building.name);
    if (!plan) continue;

    for (const room of plan.rooms) {
      index.push({ kind: "room", room, building });
    }
  }

  return index;
}

export function getSearchIndex(): SearchResult[] {
  _cachedIndex ??= buildSearchIndex();
  return _cachedIndex;
}

export function queryIndex(query: string): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const compactQuery = compactIndoorSearchKey(q);

  return getSearchIndex()
    .filter((item) => {
      const label = resultLabel(item).toLowerCase();
      const code = item.building.name.toLowerCase();
      const roomNumber =
        item.kind === "room" ? item.room.roomNumber.toLowerCase() : "";
      const searchKeys =
        item.kind === "room" ? item.room.searchKeys : [];

      if (label.includes(q) || code.includes(q) || roomNumber.includes(q)) {
        return true;
      }

      if (compactQuery && searchKeys.some((key) => key.includes(compactQuery))) {
        return true;
      }

      return false;
    })
    .slice(0, MAX_SUGGESTIONS);
}

export function campusBuildingResults(campusKey: string): SearchResult[] {
  const campusNorm = campusKey.toLowerCase();
  return BUILDINGS.filter(
    (b) =>
      b.boundingBox &&
      b.boundingBox.length >= 3 &&
      (b.campusName || "").toLowerCase() === campusNorm,
  ).map((b) => ({ kind: "building" as const, building: b }));
}
