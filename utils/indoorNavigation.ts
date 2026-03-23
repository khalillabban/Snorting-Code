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

      const isElevator =
        prevNode.type === "elevator_door" || node.type === "elevator_door";

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
        "No path found between the two rooms. The rooms may not be connected in the graph.",
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
