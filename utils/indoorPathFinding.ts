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
    for (; ;) {
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

//helpers
function isStairNode(node: BuildingPlanNode): boolean {
  const type = (node.type || "").toLowerCase();
  const label = (node.label || "").toLowerCase();
  return (
    type.includes("stair") ||
    label.includes("stair") ||
    type === "stair_landing"
  );
}

function isElevatorNode(node: BuildingPlanNode): boolean {
  const type = (node.type || "").toLowerCase();
  const label = (node.label || "").toLowerCase();
  return (
    type.includes("elevator") ||
    type === "eblock" ||
    type === "elevator_door" ||
    label.includes("elev")
  );
}

function isStairEdge(
  edge: BuildingPlanEdge,
  nodeMap: Map<string, BuildingPlanNode>,
): boolean {
  const edgeType = (edge.type || "").toLowerCase();
  if (edgeType.includes("stair")) return true;
  const src = nodeMap.get(edge.source);
  const tgt = nodeMap.get(edge.target);
  return (src != null && isStairNode(src)) || (tgt != null && isStairNode(tgt));
}

function isElevatorEdge(
  edge: BuildingPlanEdge,
  nodeMap: Map<string, BuildingPlanNode>,
): boolean {
  const edgeType = (edge.type || "").toLowerCase();
  if (edgeType.includes("elevator")) return true;
  const src = nodeMap.get(edge.source);
  const tgt = nodeMap.get(edge.target);
  return (
    (src != null && isElevatorNode(src)) ||
    (tgt != null && isElevatorNode(tgt))
  );
}

function isNodeAccessible(node: BuildingPlanNode): boolean {
  return node.accessible !== false && String(node.accessible) !== "false";
}

function isEdgeAccessible(edge: BuildingPlanEdge): boolean {
  return edge.accessible !== false && String(edge.accessible) !== "false";
}


interface AdjEntry {
  targetId: string;
  weight: number;
  accessible: boolean;
  edgeType: string;
}

function buildAdjacencyList(
  asset: BuildingPlanAsset,
  nodeMap: Map<string, BuildingPlanNode>,
  accessibleOnly: boolean,
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

  for (const edge of asset.edges ?? []) {
    if (!Number.isFinite(edge.weight) || edge.weight < 0) continue;

    const srcNode = nodeMap.get(edge.source);
    const tgtNode = nodeMap.get(edge.target);

    const edgeIsStair = isStairEdge(edge, nodeMap);
    const edgeIsElevator = isElevatorEdge(edge, nodeMap);

    if (accessibleOnly) {
      // Hard-block stairs and inaccessible edges/nodes
      if (edgeIsStair) continue;
      if (!isEdgeAccessible(edge)) continue;
      if (srcNode && isStairNode(srcNode)) continue;
      if (tgtNode && isStairNode(tgtNode)) continue;
      // Also block inaccessible non-elevator nodes (e.g. stair_landing marked accessible:false)
      if (srcNode && !isElevatorNode(srcNode) && !isNodeAccessible(srcNode))
        continue;
      if (tgtNode && !isElevatorNode(tgtNode) && !isNodeAccessible(tgtNode))
        continue;
    } else {
      // Hard-block elevators for standard routes
      if (edgeIsElevator) continue;
      if (srcNode && isElevatorNode(srcNode)) continue;
      if (tgtNode && isElevatorNode(tgtNode)) continue;
    }

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
  const accessibleOnly =
    options.accessibleOnly === true ||
    String(options.accessibleOnly) === "true";

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

  const adj = buildAdjacencyList(asset, nodeMap, accessibleOnly);

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

    for (const { targetId, weight } of adj.get(currentId) ?? []) {
      const newCost = currentCost + weight;
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
  const edgeAccessibleMap = new Map<string, boolean>();
  for (const edge of asset.edges!) {
    edgeAccessibleMap.set(`${edge.source}|${edge.target}`, edge.accessible);
    edgeAccessibleMap.set(`${edge.target}|${edge.source}`, edge.accessible);
  }

  let cumulative = 0;
  let fullyAccessible = true;
  const floorSet = new Set<number>();


  const steps: PathStep[] = pathIds.map((id, index) => {
    const node = nodeMap.get(id)!;
    floorSet.add(node.floor);

    if (index > 0) {
      const prevId = pathIds[index - 1];
      const edgeKey = `${prevId}|${id}`;
      const edgeOk = edgeAccessibleMap.get(edgeKey) !== false;
      if (!edgeOk || !isNodeAccessible(node) || isStairNode(node)) {
        fullyAccessible = false;
      }
      const seg = (adj.get(prevId) ?? []).find((e) => e.targetId === id);
      cumulative += seg?.weight ?? 0;
    } else {
      if (!isNodeAccessible(node) || isStairNode(node)) fullyAccessible = false;
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
