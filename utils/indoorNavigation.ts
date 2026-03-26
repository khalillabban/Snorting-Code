import {
  getNormalizedBuildingPlan,
  IndoorRoomRecord,
} from "./indoorBuildingPlan";
import {
  findShortestPath,
  IndoorPath,
  PathfindingOptions,
  resolveRoutingNodeId,
} from "./indoorPathFinding";
import { findIndoorRoomMatch } from "./indoorRoomSearch";
import { getBuildingPlanAsset } from "./mapAssets";
import type { RouteStep } from "../constants/type";

export type NavigationSegmentKind =
  | "walk"
  | "enter_room"
  | "exit_room"
  | "stairs"
  | "elevator";

export interface NavigationSegment {
  kind: NavigationSegmentKind;
  description: string;
  nodeIds: string[];
  floor: number;
  distance: number;
}

export interface NavigationRoute {
  origin: IndoorRoomRecord;
  destination: IndoorRoomRecord;
  path: IndoorPath;
  segments: NavigationSegment[];
  floors: number[];
  totalDistance: number;
  fullyAccessible: boolean;
  estimatedSeconds: number;
}

export type NavigationError =
  | "ORIGIN_NOT_FOUND"
  | "DESTINATION_NOT_FOUND"
  | "NO_GRAPH_DATA"
  | "NO_PATH_FOUND"
  | "SAME_ROOM";

export type NavigationResult =
  | { success: true; route: NavigationRoute }
  | { success: false; error: NavigationError; message: string };

const WALK_SPEED = 1.4; // Average human walking speed in meters per second
const PIXELS_PER_METER = 10; // Scaling factor from map coordinate units to meters

function buildSegments(path: IndoorPath): NavigationSegment[] {
  const segments: NavigationSegment[] = [];
  const steps = path.steps;

  if (steps.length === 0) return segments;

  let walkNodeIds: string[] = [];
  let walkFloor = steps[0].node.floor;
  let walkStart = 0;

  const flushWalk = (endDistance: number) => {
    if (walkNodeIds.length < 2) {
      walkNodeIds = [];
      return;
    }
    const dist = endDistance - walkStart;
    const meters = Math.round(dist / PIXELS_PER_METER);
    segments.push({
      kind: "walk",
      description:
        dist > 0
          ? `Walk ${meters > 0 ? `~${meters}m` : "a short distance"} along the hallway`
          : "Continue ahead",
      nodeIds: [...walkNodeIds],
      floor: walkFloor,
      distance: dist,
    });
    walkNodeIds = [];
  };

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const { node } = step;
    const prevNode = i > 0 ? steps[i - 1].node : null;

    if (prevNode && node.floor !== prevNode.floor) {
      flushWalk(steps[i - 1].cumulativeDistance);
      walkStart = step.cumulativeDistance;
      walkFloor = node.floor;

      const type1 = (prevNode.type || "").toLowerCase();
      const type2 = (node.type || "").toLowerCase();
      const label1 = (prevNode.label || "").toLowerCase();
      const label2 = (node.label || "").toLowerCase();

      const isElevator =
        prevNode.type === "elevator_door" ||
        node.type === "elevator_door" ||
        type1.includes("elevator") ||
        type2.includes("elevator") ||
        type1 === "eblock" ||
        type2 === "eblock" ||
        label1.includes("elev") ||
        label2.includes("elev");

      segments.push({
        kind: isElevator ? "elevator" : "stairs",
        description: isElevator
          ? `Take the elevator from floor ${prevNode.floor} to floor ${node.floor}`
          : `Take the stairs from floor ${prevNode.floor} to floor ${node.floor}`,
        nodeIds: [prevNode.id, node.id],
        floor: prevNode.floor,
        distance: 0,
      });
      walkStart = step.cumulativeDistance;
      walkNodeIds = [node.id];
      continue;
    }

    if (node.type === "room" && i === steps.length - 1) {
      walkNodeIds.push(node.id);
      flushWalk(step.cumulativeDistance);
      segments.push({
        kind: "enter_room",
        description: `Arrive at ${node.label || "destination"}`,
        nodeIds: [node.id],
        floor: node.floor,
        distance: 0,
      });
      continue;
    }

    if (node.type === "room" && i === 0) {
      segments.push({
        kind: "exit_room",
        description: `Leave ${node.label || "your room"} and head into the hallway`,
        nodeIds: [node.id],
        floor: node.floor,
        distance: 0,
      });
      walkStart = step.cumulativeDistance;
      walkFloor = node.floor;
      walkNodeIds = [node.id];
      continue;
    }

    if (node.type === "doorway") {
      walkNodeIds.push(node.id);
      continue;
    }

    walkNodeIds.push(node.id);
  }

  if (walkNodeIds.length >= 2) {
    flushWalk(steps[steps.length - 1].cumulativeDistance);
  }

  return segments;
}

/**
 * @param buildingCode
 * @param originQuery
 * @param destQuery
 * @param options
 */
export function getIndoorNavigationRoute(
  buildingCode: string,
  originQuery: string,
  destQuery: string,
  options: PathfindingOptions = {},
): NavigationResult {
  console.log("findShortestPath options:", options);
  const plan = getNormalizedBuildingPlan(buildingCode);
  if (!plan) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No building plan found for "${buildingCode}".`,
    };
  }

  const originMatch = findIndoorRoomMatch(plan, originQuery);
  if (!originMatch) {
    return {
      success: false,
      error: "ORIGIN_NOT_FOUND",
      message: `Could not find room matching "${originQuery}" in ${buildingCode}.`,
    };
  }

  const destMatch = findIndoorRoomMatch(plan, destQuery);
  if (!destMatch) {
    return {
      success: false,
      error: "DESTINATION_NOT_FOUND",
      message: `Could not find room matching "${destQuery}" in ${buildingCode}.`,
    };
  }

  if (originMatch.room.id === destMatch.room.id) {
    return {
      success: false,
      error: "SAME_ROOM",
      message: "Origin and destination are the same room.",
    };
  }

  const asset = getBuildingPlanAsset(buildingCode);
  if (!asset || !asset.edges || asset.edges.length === 0) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No graph data (edges) available for building "${buildingCode}".`,
    };
  }

  const originNodeId = resolveRoutingNodeId(
    asset,
    originMatch.room.id,
    originMatch.room.x,
    originMatch.room.y,
    originMatch.room.floor,
  );
  const destNodeId = resolveRoutingNodeId(
    asset,
    destMatch.room.id,
    destMatch.room.x,
    destMatch.room.y,
    destMatch.room.floor,
  );

  if (!originNodeId || !destNodeId) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message: "Could not map rooms to the navigation graph.",
    };
  }

  const path = findShortestPath(asset, originNodeId, destNodeId, options);
  if (!path) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message:
        options.accessibleOnly
          ? "No accessible route found. There may be no elevator connecting these floors."
          : "No path found between the two rooms. The rooms may not be connected in the graph.",
    };
  }

  const segments = buildSegments(path);

  return {
    success: true,
    route: {
      origin: originMatch.room,
      destination: destMatch.room,
      path,
      segments,
      floors: path.floors,
      totalDistance: path.totalDistance,
      fullyAccessible: path.fullyAccessible,
      estimatedSeconds: Math.round(
        path.totalDistance / PIXELS_PER_METER / WALK_SPEED,
      ),
    },
  };
}

/**
 * NodeId-based variant of indoor routing.
 *
 * Use this when the destination is a graph node (e.g. building exits) rather than a room query.
 * The returned `destination` is derived from the destination node's coordinates.
 */
export function getIndoorNavigationRouteToNode(
  buildingCode: string,
  originQuery: string,
  destNodeId: string,
  options: PathfindingOptions = {},
): NavigationResult {
  console.log("findShortestPath options:", options);
  const plan = getNormalizedBuildingPlan(buildingCode);
  if (!plan) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No building plan found for "${buildingCode}".`,
    };
  }

  const originMatch = findIndoorRoomMatch(plan, originQuery);
  if (!originMatch) {
    return {
      success: false,
      error: "ORIGIN_NOT_FOUND",
      message: `Could not find room matching "${originQuery}" in ${buildingCode}.`,
    };
  }

  const asset = getBuildingPlanAsset(buildingCode);
  if (!asset || !asset.nodes || !asset.edges || asset.edges.length === 0) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No graph data (edges) available for building "${buildingCode}".`,
    };
  }

  const destNode = asset.nodes.find((n) => n.id === destNodeId);
  if (!destNode) {
    return {
      success: false,
      error: "DESTINATION_NOT_FOUND",
      message: `Destination node "${destNodeId}" not found in ${buildingCode}.`,
    };
  }

  const originNodeId = resolveRoutingNodeId(
    asset,
    originMatch.room.id,
    originMatch.room.x,
    originMatch.room.y,
    originMatch.room.floor,
  );

  if (!originNodeId) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message: "Could not map origin room to the navigation graph.",
    };
  }

  if (originNodeId === destNodeId) {
    return {
      success: false,
      error: "SAME_ROOM",
      message: "Origin and destination are the same location.",
    };
  }

  const path = findShortestPath(asset, originNodeId, destNodeId, options);
  if (!path) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message:
        options.accessibleOnly
          ? "No accessible route found. There may be no elevator connecting these floors."
          : "No path found between the two locations. They may not be connected in the graph.",
    };
  }

  const segments = buildSegments(path);

  // Create a destination-like object compatible with the UI.
  const destinationLike = {
    id: destNode.id,
    label: (destNode as any).label ?? "Exit",
    floor: destNode.floor,
    x: destNode.x,
    y: destNode.y,
    accessible: (destNode as any).accessible ?? true,
  } as any;

  return {
    success: true,
    route: {
      origin: originMatch.room,
      destination: destinationLike,
      path,
      segments,
      floors: path.floors,
      totalDistance: path.totalDistance,
      fullyAccessible: path.fullyAccessible,
      estimatedSeconds: Math.round(
        path.totalDistance / PIXELS_PER_METER / WALK_SPEED,
      ),
    },
  };
}

/**
 * Compute an indoor route from a *graph node id* (e.g. building entry/exit node)
 * to a destination room query.
 */
export function getIndoorNavigationRouteFromNode(
  buildingCode: string,
  originNodeId: string,
  destQuery: string,
  options: PathfindingOptions = {},
): NavigationResult {
  const plan = getNormalizedBuildingPlan(buildingCode);
  if (!plan) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No building plan found for "${buildingCode}".`,
    };
  }

  const destMatch = findIndoorRoomMatch(plan, destQuery);
  if (!destMatch) {
    return {
      success: false,
      error: "DESTINATION_NOT_FOUND",
      message: `Could not find room matching "${destQuery}" in ${buildingCode}.`,
    };
  }

  const asset = getBuildingPlanAsset(buildingCode);
  if (!asset || !asset.nodes || !asset.edges || asset.edges.length === 0) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No graph data (edges) available for building "${buildingCode}".`,
    };
  }

  const originNode = asset.nodes.find((n) => n.id === originNodeId);
  if (!originNode) {
    return {
      success: false,
      error: "ORIGIN_NOT_FOUND",
      message: `Origin node "${originNodeId}" not found in ${buildingCode}.`,
    };
  }

  const destNodeId = resolveRoutingNodeId(
    asset,
    destMatch.room.id,
    destMatch.room.x,
    destMatch.room.y,
    destMatch.room.floor,
  );

  if (!destNodeId) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message: "Could not map destination room to the navigation graph.",
    };
  }

  if (originNodeId === destNodeId) {
    return {
      success: false,
      error: "SAME_ROOM",
      message: "Origin and destination are the same location.",
    };
  }

  const path = findShortestPath(asset, originNodeId, destNodeId, options);
  if (!path) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message:
        options.accessibleOnly
          ? "No accessible route found. There may be no elevator connecting these floors."
          : "No path found between the two locations. They may not be connected in the graph.",
    };
  }

  const segments = buildSegments(path);

  const originLike = {
    id: originNode.id,
    label: (originNode as any).label ?? "Entrance",
    floor: originNode.floor,
    x: originNode.x,
    y: originNode.y,
    accessible: (originNode as any).accessible ?? true,
  } as any;

  return {
    success: true,
    route: {
      origin: originLike,
      destination: destMatch.room,
      path,
      segments,
      floors: path.floors,
      totalDistance: path.totalDistance,
      fullyAccessible: path.fullyAccessible,
      estimatedSeconds: Math.round(path.totalDistance / PIXELS_PER_METER / WALK_SPEED),
    },
  };
}

export function getRouteWaypointsForFloor(
  route: NavigationRoute,
  floor: number,
  coordinateScale = 1,
): { x: number; y: number }[] {
  return route.path.steps
    .filter((step) => step.node.floor === floor)
    .map((step) => ({
      x: step.node.x * coordinateScale,
      y: step.node.y * coordinateScale,
    }));
}

/**
 * Convert an indoor navigation route into a step list compatible with the outdoor
 * directions UI (`DirectionStepsPanel`).
 */
export function indoorRouteToSteps(route: NavigationRoute): RouteStep[] {
  return (route.segments ?? [])
    .map((seg) => ({ instruction: seg.description }))
    .filter((s) => Boolean(s.instruction));
}
