import {
  BuildingPlanAsset,
  BuildingPlanEdge,
  BuildingPlanNode,
} from "./mapAssets";

export interface PathNode {
  id: string;
  x: number;
  y: number;
  floor: number;
  type: string;
  label: string;
  accessible: boolean;
}

export interface PathStep {
  node: PathNode;
  cumulativeDistance: number;
}

export interface IndoorPath {
  steps: PathStep[];
  totalDistance: number;
  fullyAccessible: boolean;
  floors: number[];
}

export interface PathfindingOptions {
  accessibleOnly?: boolean;
}

interface HeapEntry {
  id: string;
  cost: number;
}

class MinHeap {
  private data: HeapEntry[] = [];

  push(entry: HeapEntry): void {
    this.data.push(entry);
    this._bubbleUp(this.data.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.data.length;
  }

  private _bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.data[parent].cost <= this.data[i].cost) break;
      [this.data[parent], this.data[i]] = [this.data[i], this.data[parent]];
      i = parent;
    }
  }

  private _sinkDown(i: number): void {
    const n = this.data.length;
    for (;;) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.data[l].cost < this.data[smallest].cost) smallest = l;
      if (r < n && this.data[r].cost < this.data[smallest].cost) smallest = r;
      if (smallest === i) break;
      [this.data[smallest], this.data[i]] = [this.data[i], this.data[smallest]];
      i = smallest;
    }
  }
}

interface AdjEntry {
  targetId: string;
  weight: number;
  accessible: boolean;
  edgeType: string;
}

function buildAdjacencyList(
  edges: BuildingPlanEdge[],
): Map<string, AdjEntry[]> {
  const adj = new Map<string, AdjEntry[]>();

  const add = (
    from: string,
    to: string,
    weight: number,
    accessible: boolean,
    edgeType: string,
  ) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ targetId: to, weight, accessible, edgeType });
  };

  for (const edge of edges) {
    if (!Number.isFinite(edge.weight) || edge.weight < 0) continue;
    add(
      edge.source,
      edge.target,
      edge.weight,
      edge.accessible,
      edge.type ?? "",
    );
    add(
      edge.target,
      edge.source,
      edge.weight,
      edge.accessible,
      edge.type ?? "",
    );
  }

  return adj;
}

export function findShortestPath(
  asset: BuildingPlanAsset,
  originId: string,
  destinationId: string,
  options: PathfindingOptions = {},
): IndoorPath | null {
  const { accessibleOnly = false } = options;
  const isAccessibleRoute =
    accessibleOnly === true || String(accessibleOnly) === "true";
  console.log("findShortestPath options:", options);

  if (!asset.edges || asset.edges.length === 0) {
    return null;
  }

  const nodeMap = new Map<string, BuildingPlanNode>();
  for (const node of asset.nodes) {
    nodeMap.set(node.id, node);
  }

  if (!nodeMap.has(originId) || !nodeMap.has(destinationId)) {
    return null;
  }

  const adj = buildAdjacencyList(asset.edges);

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const node of asset.nodes) {
    dist.set(node.id, Infinity);
    prev.set(node.id, null);
  }
  dist.set(originId, 0);

  const heap = new MinHeap();
  heap.push({ id: originId, cost: 0 });

  while (heap.size > 0) {
    const { id: currentId, cost: currentCost } = heap.pop()!;

    if (currentCost > (dist.get(currentId) ?? Infinity)) continue;

    if (currentId === destinationId) break;

    const neighbors = adj.get(currentId) ?? [];
    for (const { targetId, weight, accessible, edgeType } of neighbors) {
      const isEdgeAccessible =
        accessible !== false && String(accessible) !== "false";
      const targetNode = nodeMap.get(targetId);
      const targetType = (targetNode?.type || "").toLowerCase();
      const targetLabel = (targetNode?.label || "").toLowerCase();
      const edgeTypeLower = (edgeType || "").toLowerCase();

      const isStairs =
        targetType.includes("stair") ||
        targetLabel.includes("stair") ||
        edgeTypeLower.includes("stair");

      const isElevator =
        targetType.includes("elevator") ||
        targetType === "eblock" ||
        targetLabel.includes("elev") ||
        edgeTypeLower.includes("elevator");

      const isNodeAccessible =
        targetNode?.accessible !== false &&
        String(targetNode?.accessible) !== "false";

      let penalty = 0;

      if (isAccessibleRoute) {
        // Heavily penalize stairs so elevators are prioritized
        if (isStairs) penalty += 100000;
        // Penalize inaccessible nodes/edges slightly so they are avoided
        if (!isElevator && (!isEdgeAccessible || !isNodeAccessible))
          penalty += 50000;
      } else {
        // Heavily penalize elevators so stairs are prioritized
        if (isElevator) penalty += 100000;
      }

      const newCost = currentCost + weight + penalty;
      if (newCost < (dist.get(targetId) ?? Infinity)) {
        dist.set(targetId, newCost);
        prev.set(targetId, currentId);
        heap.push({ id: targetId, cost: newCost });
      }
    }
  }

  const totalDistance = dist.get(destinationId) ?? Infinity;
  if (!isFinite(totalDistance)) return null;

  const pathIds: string[] = [];
  let cursor: string | null = destinationId;
  const visited = new Set<string>();
  while (cursor !== null) {
    if (visited.has(cursor)) break;
    visited.add(cursor);
    pathIds.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }

  let cumulative = 0;
  let fullyAccessible = true;
  const floorSet = new Set<number>();

  const edgeAccessible = new Map<string, boolean>();
  for (const edge of asset.edges!) {
    const key = (a: string, b: string) => `${a}|${b}`;
    edgeAccessible.set(key(edge.source, edge.target), edge.accessible);
    edgeAccessible.set(key(edge.target, edge.source), edge.accessible);
  }

  const steps: PathStep[] = pathIds.map((id, index) => {
    const node = nodeMap.get(id)!;
    floorSet.add(node.floor);

    if (index > 0) {
      const prevId = pathIds[index - 1];
      const edgeKey = `${prevId}|${id}`;
      const isEdgeAccessible = edgeAccessible.get(edgeKey) !== false;
      if (
        !isEdgeAccessible ||
        node.accessible === false ||
        node.type?.toLowerCase().includes("stair")
      )
        fullyAccessible = false;

      const seg = (adj.get(prevId) ?? []).find((e) => e.targetId === id);
      cumulative += seg?.weight ?? 0;
    } else {
      if (
        node.accessible === false ||
        node.type?.toLowerCase().includes("stair")
      )
        fullyAccessible = false;
    }

    return {
      node: {
        id: node.id,
        x: node.x,
        y: node.y,
        floor: node.floor,
        type: node.type,
        label: node.label,
        accessible: node.accessible,
      },
      cumulativeDistance: cumulative,
    };
  });

  return {
    steps,
    totalDistance: cumulative,
    fullyAccessible,
    floors: [...floorSet].sort((a, b) => a - b),
  };
}

export function resolveRoutingNodeId(
  asset: BuildingPlanAsset,
  roomId: string,
  roomX: number,
  roomY: number,
  floor: number,
): string | null {
  if (asset.nodes.some((n) => n.id === roomId && n.floor === floor))
    return roomId;

  let bestId: string | null = null;
  let bestDist = Infinity;

  for (const node of asset.nodes) {
    if (node.floor !== floor) continue;
    const dx = node.x - roomX;
    const dy = node.y - roomY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) {
      bestDist = d;
      bestId = node.id;
    }
  }

  return bestId;
}
