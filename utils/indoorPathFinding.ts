import {
  BuildingPlanAsset,
  BuildingPlanEdge,
  BuildingPlanNode,
} from "./mapAssets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /** Cumulative distance from origin at this step (in asset coordinate units). */
  cumulativeDistance: number;
}

export interface IndoorPath {
  /** Ordered list of waypoints from origin to destination. */
  steps: PathStep[];
  /** Total path cost (sum of edge weights). */
  totalDistance: number;
  /** True when every edge along the path is accessible. */
  fullyAccessible: boolean;
  /** IDs of the floors touched by this path. */
  floors: number[];
}

export interface PathfindingOptions {
  /** When true, only traverse edges marked accessible:true. */
  accessibleOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Internal min-heap (priority queue) — avoids O(n²) Dijkstra
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Graph builder
// ---------------------------------------------------------------------------

interface AdjEntry {
  targetId: string;
  weight: number;
  accessible: boolean;
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
  ) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ targetId: to, weight, accessible });
  };

  for (const edge of edges) {
    // Edges are treated as undirected
    // Guard against invalid weights
    if (!Number.isFinite(edge.weight) || edge.weight <= 0) continue;
    add(edge.source, edge.target, edge.weight, edge.accessible);
    add(edge.target, edge.source, edge.weight, edge.accessible);
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

  if (!asset.edges || asset.edges.length === 0) {
    return null;
  }

  // Index nodes by id
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

    // Skip stale heap entries
    if (currentCost > (dist.get(currentId) ?? Infinity)) continue;

    if (currentId === destinationId) break;

    const neighbors = adj.get(currentId) ?? [];
    for (const { targetId, weight, accessible } of neighbors) {
      if (accessibleOnly && !accessible) continue;
      const newCost = currentCost + weight;
      if (newCost < (dist.get(targetId) ?? Infinity)) {
        dist.set(targetId, newCost);
        prev.set(targetId, currentId);
        heap.push({ id: targetId, cost: newCost });
      }
    }
  }

  // No path found
  const totalDistance = dist.get(destinationId) ?? Infinity;
  if (!isFinite(totalDistance)) return null;

  // Reconstruct path
  const pathIds: string[] = [];
  let cursor: string | null = destinationId;
  const visited = new Set<string>();
  while (cursor !== null) {
    if (visited.has(cursor)) break;
    visited.add(cursor);
    pathIds.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }

  // Build steps
  let cumulative = 0;
  let fullyAccessible = true;
  const floorSet = new Set<number>();

  // Pre-build accessible edge lookup for the reconstruction pass
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
      const accessible = edgeAccessible.get(edgeKey) ?? true;
      if (!accessible) fullyAccessible = false;

      // Recompute actual distance for this segment from adjacency list
      const seg = (adj.get(prevId) ?? []).find((e) => e.targetId === id);
      cumulative += seg?.weight ?? 0;
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
    totalDistance,
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
  // Direct match (check floor)
  if (asset.nodes.some((n) => n.id === roomId && n.floor === floor)) return roomId;

  // Nearest node on same floor
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
