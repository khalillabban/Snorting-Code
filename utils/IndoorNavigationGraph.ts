//THIS IS AN OTHER WAY TO DO THE NAVIGATION
export type GraphNode = {
  id: string;
  type: string; // "room" | "doorway" | "hallway_waypoint" | "elevator_door" | "stair_landing"
  buildingId: string;
  floor: number;
  x: number;
  y: number;
  label: string;
  accessible: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
  type: string; // "hallway" | "door_to_hallway" | "elevator" | "stair"
  weight: number;
  accessible: boolean;
};

export type FloorGraphData = {
  meta: { buildingId: string };
  nodes: GraphNode[];
  edges: GraphEdge[];
};

// ─── Graph loader ────────────────────────────────────────────────────────────

const GRAPH_REGISTRY: Record<string, FloorGraphData> = {
  MB: require("../assets/maps/mb_floors_combined.json"),
};

export function getFloorGraphData(buildingId: string): FloorGraphData | null {
  return GRAPH_REGISTRY[buildingId] ?? null;
}

// ─── Adjacency builder ───────────────────────────────────────────────────────

type AdjacencyMap = Record<
  string,
  { id: string; weight: number; accessible: boolean }[]
>;

function buildAdjacency(edges: GraphEdge[]): AdjacencyMap {
  const adj: AdjacencyMap = {};

  for (const edge of edges) {
    if (!adj[edge.source]) adj[edge.source] = [];
    if (!adj[edge.target]) adj[edge.target] = [];

    adj[edge.source].push({
      id: edge.target,
      weight: edge.weight,
      accessible: edge.accessible,
    });
    adj[edge.target].push({
      id: edge.source,
      weight: edge.weight,
      accessible: edge.accessible,
    });
  }

  return adj;
}

// ─── Dijkstra ────────────────────────────────────────────────────────────────

export function findIndoorPath(
  data: FloorGraphData,
  startId: string,
  endId: string,
  accessibleOnly: boolean = false,
): string[] {
  const nodeMap: Record<string, GraphNode> = {};
  for (const n of data.nodes) nodeMap[n.id] = n;

  if (!nodeMap[startId] || !nodeMap[endId]) return [];
  if (startId === endId) return [startId];

  const adj = buildAdjacency(data.edges);

  const dist: Record<string, number> = {};
  const prev: Record<string, string | null> = {};
  const unvisited = new Set<string>(data.nodes.map((n) => n.id));

  for (const n of data.nodes) {
    dist[n.id] = Infinity;
    prev[n.id] = null;
  }
  dist[startId] = 0;

  while (unvisited.size > 0) {
    let current: string | null = null;
    let smallest = Infinity;
    for (const id of unvisited) {
      if (dist[id] < smallest) {
        smallest = dist[id];
        current = id;
      }
    }

    if (!current || current === endId) break;
    unvisited.delete(current);

    for (const neighbor of adj[current] ?? []) {
      if (!unvisited.has(neighbor.id)) continue;
      if (accessibleOnly && !neighbor.accessible) continue;

      const candidate = dist[current] + neighbor.weight;
      if (candidate < dist[neighbor.id]) {
        dist[neighbor.id] = candidate;
        prev[neighbor.id] = current;
      }
    }
  }

  const path: string[] = [];
  let cur: string | null = endId;
  while (cur) {
    path.unshift(cur);
    cur = prev[cur];
  }

  return path[0] === startId ? path : [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getRoomsForFloor(
  data: FloorGraphData,
  floor: number,
): GraphNode[] {
  return data.nodes
    .filter((n) => n.type === "room" && n.floor === floor && n.label !== "")
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findNodeByLabel(
  data: FloorGraphData,
  label: string,
): GraphNode | undefined {
  return data.nodes.find((n) => n.label === label);
}

export function findNodeById(
  data: FloorGraphData,
  id: string,
): GraphNode | undefined {
  return data.nodes.find((n) => n.id === id);
}

export function getPathDistance(data: FloorGraphData, path: string[]): number {
  if (path.length < 2) return 0;
  const nodeMap: Record<string, GraphNode> = {};
  for (const n of data.nodes) nodeMap[n.id] = n;

  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = nodeMap[path[i]];
    const b = nodeMap[path[i + 1]];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}
