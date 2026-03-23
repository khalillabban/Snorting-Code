import {
  compactIndoorSearchKey,
  IndoorRoomRecord,
  NormalizedIndoorBuildingPlan,
} from "./indoorBuildingPlan";

export type IndoorRoomMatchType =
  | "exact_label"
  | "exact_room"
  | "exact_compact"
  | "prefix_label"
  | "prefix_room"
  | "prefix_compact"
  | "partial_label"
  | "partial_room"
  | "partial_compact";

export interface IndoorRoomMatch {
  room: IndoorRoomRecord;
  floor: number;
  matchType: IndoorRoomMatchType;
  score: number;
}

export interface IndoorRoomSearchOptions {
  currentFloor?: number;
  maxResults?: number;
}

function normalizeIndoorRoomQuery(query: string): string {
  return query.trim().toUpperCase();
}

function getMatchScore(
  room: IndoorRoomRecord,
  normalizedQuery: string,
  compactQuery: string,
): { score: number; matchType: IndoorRoomMatchType | null } {
  if (!normalizedQuery || !compactQuery) {
    return { score: 0, matchType: null };
  }

  if (room.label === normalizedQuery) {
    return { score: 900, matchType: "exact_label" };
  }

  if (room.roomNumber === normalizedQuery) {
    return { score: 850, matchType: "exact_room" };
  }

  if (room.searchKeys.includes(compactQuery)) {
    return { score: 800, matchType: "exact_compact" };
  }

  if (room.label.startsWith(normalizedQuery)) {
    return { score: 700, matchType: "prefix_label" };
  }

  if (room.roomNumber.startsWith(normalizedQuery)) {
    return { score: 650, matchType: "prefix_room" };
  }

  if (room.searchKeys.some((key) => key.startsWith(compactQuery))) {
    return { score: 600, matchType: "prefix_compact" };
  }

  if (room.label.includes(normalizedQuery)) {
    return { score: 500, matchType: "partial_label" };
  }

  if (room.roomNumber.includes(normalizedQuery)) {
    return { score: 450, matchType: "partial_room" };
  }

  if (room.searchKeys.some((key) => key.includes(compactQuery))) {
    return { score: 400, matchType: "partial_compact" };
  }

  return { score: 0, matchType: null };
}

function compareMatches(
  left: IndoorRoomMatch,
  right: IndoorRoomMatch,
  currentFloor?: number,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const leftOnCurrentFloor = currentFloor != null && left.floor === currentFloor;
  const rightOnCurrentFloor = currentFloor != null && right.floor === currentFloor;

  if (leftOnCurrentFloor !== rightOnCurrentFloor) {
    return Number(rightOnCurrentFloor) - Number(leftOnCurrentFloor);
  }

  const leftRoomLength = left.room.roomNumber.length;
  const rightRoomLength = right.room.roomNumber.length;

  if (leftRoomLength !== rightRoomLength) {
    return leftRoomLength - rightRoomLength;
  }

  if (left.floor !== right.floor) {
    return left.floor - right.floor;
  }

  return left.room.label.localeCompare(right.room.label);
}

export function findIndoorRoomMatches(
  plan: NormalizedIndoorBuildingPlan,
  query: string,
  options?: IndoorRoomSearchOptions,
): IndoorRoomMatch[] {
  const normalizedQuery = normalizeIndoorRoomQuery(query);
  const compactQuery = compactIndoorSearchKey(normalizedQuery);

  if (!normalizedQuery || !compactQuery) {
    return [];
  }

  const matches = plan.rooms
    .map((room) => {
      const { score, matchType } = getMatchScore(
        room,
        normalizedQuery,
        compactQuery,
      );

      if (!matchType || score <= 0) {
        return null;
      }

      return {
        room,
        floor: room.floor,
        matchType,
        score,
      };
    })
    .filter((match): match is IndoorRoomMatch => match != null)
    .sort((left, right) => compareMatches(left, right, options?.currentFloor));

  if (options?.maxResults != null) {
    return matches.slice(0, options.maxResults);
  }

  return matches;
}

export function findIndoorRoomMatch(
  plan: NormalizedIndoorBuildingPlan,
  query: string,
  options?: IndoorRoomSearchOptions,
): IndoorRoomMatch | null {
  return findIndoorRoomMatches(plan, query, {
    currentFloor: options?.currentFloor,
    maxResults: 1,
  })[0] ?? null;
}

export function findIndoorRoomFloor(
  plan: NormalizedIndoorBuildingPlan,
  query: string,
  options?: IndoorRoomSearchOptions,
): number | null {
  return findIndoorRoomMatch(plan, query, options)?.floor ?? null;
}
