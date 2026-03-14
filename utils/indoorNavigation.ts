import { Floor } from "./IndoorMapComposite";

export type IndoorGraphNode = {
  id: string;
  x: number;
  y: number;
  neighbors: { id: string; weight: number }[];
};

export type IndoorGraph = {
  nodes: Record<string, IndoorGraphNode>;
};

type SelectableNode = {
  id: string;
  name: string;
};

type FloorPolygon = {
  name: string;
  type: string;
  coordinates: number[][];
};

export type IndoorPathData = {
  graph: IndoorGraph;
  selectableByName: Record<string, SelectableNode>;
};

function distanceBetweenPoints(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(bx - ax, by - ay);
}

function distanceBetweenNodeIds(graph: IndoorGraph, fromId: string, toId: string) {
  const fromNode = graph.nodes[fromId];
  const toNode = graph.nodes[toId];

  if (!fromNode || !toNode) return Infinity;

  return distanceBetweenPoints(fromNode.x, fromNode.y, toNode.x, toNode.y);
}

function addNode(graph: IndoorGraph, id: string, x: number, y: number) {
  graph.nodes[id] = {
    id,
    x,
    y,
    neighbors: [],
  };
}

function addUndirectedEdge(graph: IndoorGraph, fromId: string, toId: string) {
  const fromNode = graph.nodes[fromId];
  const toNode = graph.nodes[toId];

  if (!fromNode || !toNode || fromId === toId) return;

  const weight = distanceBetweenPoints(fromNode.x, fromNode.y, toNode.x, toNode.y);

  const fromAlreadyConnected = fromNode.neighbors.some((neighbor) => neighbor.id === toId);
  if (!fromAlreadyConnected) {
    fromNode.neighbors.push({ id: toId, weight });
  }

  const toAlreadyConnected = toNode.neighbors.some((neighbor) => neighbor.id === fromId);
  if (!toAlreadyConnected) {
    toNode.neighbors.push({ id: fromId, weight });
  }
}

function createEmptyGraph(): IndoorGraph {
  return { nodes: {} };
}

function buildMB1BaseGraph(): IndoorGraph {
  const graph = createEmptyGraph();

  addNode(graph, "hall-entrance-west", 930, 320);
  addNode(graph, "hall-west-mid", 1020, 900);
  addNode(graph, "hall-center", 1238, 1100);
  addNode(graph, "hall-center-north", 1478, 1100);
  addNode(graph, "hall-center-south", 1478, 1265);
  addNode(graph, "hall-south-mid", 1238, 1475);
  addNode(graph, "hall-south-west", 1238, 1600);
  addNode(graph, "hall-east-south", 1479, 1760);
  addNode(graph, "hall-east-mid", 1478, 1600);
  addNode(graph, "hall-east", 1712, 1600);
  addNode(graph, "hall-far-east", 1821, 1670);
  addNode(graph, "hall-north-east", 1530, 450);
  addNode(graph, "hall-north-west", 1233, 459);

  addUndirectedEdge(graph, "hall-entrance-west", "hall-west-mid");
  addUndirectedEdge(graph, "hall-west-mid", "hall-center");
  addUndirectedEdge(graph, "hall-center", "hall-center-north");
  addUndirectedEdge(graph, "hall-center-north", "hall-center-south");
  addUndirectedEdge(graph, "hall-center-south", "hall-south-mid");
  addUndirectedEdge(graph, "hall-south-mid", "hall-south-west");
  addUndirectedEdge(graph, "hall-center-south", "hall-east-mid");
  addUndirectedEdge(graph, "hall-east-mid", "hall-east-south");
  addUndirectedEdge(graph, "hall-east-mid", "hall-east");
  addUndirectedEdge(graph, "hall-east", "hall-far-east");
  addUndirectedEdge(graph, "hall-center", "hall-north-west");
  addUndirectedEdge(graph, "hall-north-west", "hall-north-east");
  addUndirectedEdge(graph, "hall-center-north", "hall-north-east");

  return graph;
}

function getBaseGraphForFloor(buildingCode: string, floorNumber: number): IndoorGraph {
  if (buildingCode === "MB" && floorNumber === 1) {
    return buildMB1BaseGraph();
  }

  return createEmptyGraph();
}

function pointInPolygon(x: number, y: number, polygon: number[][]) {
  const total = polygon.length;
  if (total < 3) return false;

  let isInside = false;

  for (let i = 0, j = total - 1; i < total; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isBlockedPolygonType(type: string) {
  return type === "room" || type === "block" || type === "Eblock";
}

function segmentCrossesBlockedArea(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blockedPolygons: FloorPolygon[],
  allowedPolygonNames: Set<string>
) {
  const segmentLength = distanceBetweenPoints(fromX, fromY, toX, toY);
  const sampleCount = Math.max(12, Math.ceil(segmentLength / 20));

  for (let i = 1; i < sampleCount; i += 1) {
    const t = i / sampleCount;
    const sampleX = fromX + (toX - fromX) * t;
    const sampleY = fromY + (toY - fromY) * t;

    for (const polygon of blockedPolygons) {
      if (allowedPolygonNames.has(polygon.name)) continue;

      if (pointInPolygon(sampleX, sampleY, polygon.coordinates)) {
        return true;
      }
    }
  }

  return false;
}

function getClosestPointOnPolygonToTarget(coordinates: number[][], targetX: number, targetY: number) {
  let closestPoint = coordinates[0];
  let closestDistance = Infinity;

  coordinates.forEach(([x, y]) => {
    const dist = distanceBetweenPoints(x, y, targetX, targetY);
    if (dist < closestDistance) {
      closestDistance = dist;
      closestPoint = [x, y];
    }
  });

  return closestPoint;
}

function getBestRoomConnector(
  graph: IndoorGraph,
  roomName: string,
  roomCoordinates: number[][],
  blockedPolygons: FloorPolygon[]
) {
  let best: { baseNodeId: string; doorwayPoint: number[]; distance: number } | null = null;

  for (const node of Object.values(graph.nodes)) {
    if (node.id.startsWith("room-")) continue;

    const doorwayPoint = getClosestPointOnPolygonToTarget(roomCoordinates, node.x, node.y);
    const crossesBlockedArea = segmentCrossesBlockedArea(
      doorwayPoint[0],
      doorwayPoint[1],
      node.x,
      node.y,
      blockedPolygons,
      new Set<string>([roomName])
    );

    if (crossesBlockedArea) continue;

    const connectionDistance = distanceBetweenPoints(
      doorwayPoint[0],
      doorwayPoint[1],
      node.x,
      node.y
    );

    if (!best || connectionDistance < best.distance) {
      best = {
        baseNodeId: node.id,
        doorwayPoint,
        distance: connectionDistance,
      };
    }
  }

  return best;
}

export function buildIndoorPathData(
  floorComposite: Floor,
  buildingCode: string,
  floorNumber: number
): IndoorPathData {
  const graph = getBaseGraphForFloor(buildingCode, floorNumber);
  const selectableByName: Record<string, SelectableNode> = {};
  const floorPolygons: FloorPolygon[] = floorComposite.getChildren().map((node) => ({
    name: node.getName(),
    type: node.getType(),
    coordinates: node.getCoordinates(),
  }));

  const blockedPolygons = floorPolygons.filter((polygon) => isBlockedPolygonType(polygon.type));

  floorComposite.getChildren().forEach((node) => {
    const nodeType = node.getType();

    if (nodeType === "block" || nodeType === "Eblock" || nodeType === "hallway") {
      return;
    }

    if (nodeType !== "room") return;

    const roomNodeId = `room-${node.getName()}`;
    const roomCoordinates = node.getCoordinates();
    const roomConnector = getBestRoomConnector(
      graph,
      node.getName(),
      roomCoordinates,
      blockedPolygons
    );

    if (!roomConnector) return;

    addNode(graph, roomNodeId, roomConnector.doorwayPoint[0], roomConnector.doorwayPoint[1]);
    addUndirectedEdge(graph, roomNodeId, roomConnector.baseNodeId);

    selectableByName[node.getName()] = {
      id: roomNodeId,
      name: node.getName(),
    };
  });

  return {
    graph,
    selectableByName,
  };
}

export function findShortestIndoorPath(graph: IndoorGraph, startId: string, endId: string): string[] {
  if (!graph.nodes[startId] || !graph.nodes[endId]) return [];
  if (startId === endId) return [startId];

  const distances: Record<string, number> = {};
  const previous: Record<string, string | null> = {};
  const unvisited = new Set(Object.keys(graph.nodes));

  Object.keys(graph.nodes).forEach((nodeId) => {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
  });

  distances[startId] = 0;

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let smallestDistance = Infinity;

    unvisited.forEach((nodeId) => {
      if (distances[nodeId] < smallestDistance) {
        smallestDistance = distances[nodeId];
        currentId = nodeId;
      }
    });

    if (!currentId) break;
    if (currentId === endId) break;

    unvisited.delete(currentId);

    const currentNode = graph.nodes[currentId];
    currentNode.neighbors.forEach((neighbor) => {
      if (!unvisited.has(neighbor.id)) return;

      const tentativeDistance = distances[currentId!] + neighbor.weight;
      if (tentativeDistance < distances[neighbor.id]) {
        distances[neighbor.id] = tentativeDistance;
        previous[neighbor.id] = currentId;
      }
    });
  }

  const path: string[] = [];
  let currentId: string | null = endId;

  while (currentId) {
    path.unshift(currentId);
    currentId = previous[currentId];
  }

  if (path[0] !== startId) return [];

  return path;
}

export function getPathDistance(graph: IndoorGraph, path: string[]) {
  if (path.length < 2) return 0;

  let total = 0;

  for (let i = 0; i < path.length - 1; i += 1) {
    total += distanceBetweenNodeIds(graph, path[i], path[i + 1]);
  }

  return total;
}