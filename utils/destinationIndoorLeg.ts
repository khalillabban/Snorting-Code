import type { IndoorRoomRecord } from "./indoorBuildingPlan";

export type EntryExitNode = {
  id: string;
  type: string;
  x?: number;
  y?: number;
};

export function isDestinationLegOrigin(value: string): boolean {
  return value.trim().toUpperCase() === "ENTRANCE";
}

export function pickClosestEntryExitNodeId(opts: {
  entryNodes: EntryExitNode[];
  destinationRoom?: Pick<IndoorRoomRecord, "x" | "y"> | null;
}): string | null {
  const destinationRoom = opts.destinationRoom;
  if (!destinationRoom) return null;
  if (opts.entryNodes.length === 0) return null;

  const best = opts.entryNodes
    .map((n) => {
      const dx = (n.x ?? 0) - destinationRoom.x;
      const dy = (n.y ?? 0) - destinationRoom.y;
      return { id: n.id, d: dx * dx + dy * dy };
    })
    .sort((a, b) => a.d - b.d)[0];

  return best?.id ?? opts.entryNodes[0]?.id ?? null;
}
