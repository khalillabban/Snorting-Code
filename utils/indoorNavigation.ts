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

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type NavigationSegmentKind =
  | "walk" // straight hallway walk
  | "enter_room" // step through a door into a room
  | "exit_room" // leave a room into the hallway
  | "stairs" // floor transition via stairs
  | "elevator"; // floor transition via elevator

export interface NavigationSegment {
  kind: NavigationSegmentKind;
  description: string;
  /** Nodes included in this segment (for rendering on the floor plan). */
  nodeIds: string[];
  /** Floor this segment takes place on. */
  floor: number;
  /** Approximate distance of this segment in coordinate units. */
  distance: number;
}

export interface NavigationRoute {
  /** Resolved origin room. */
  origin: IndoorRoomRecord;
  /** Resolved destination room. */
  destination: IndoorRoomRecord;
  /** Raw pathfinding result. */
  path: IndoorPath;
  /** Human-readable turn-by-turn segments. */
  segments: NavigationSegment[];
  /** Floors the route passes through. */
  floors: number[];
  /** Total distance in coordinate units. */
  totalDistance: number;
  /** True when every edge on the route is wheelchair-accessible. */
  fullyAccessible: boolean;
  /** Estimated walking time in seconds (assumes ~1.4 coordinate units/sec). */
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Assumed walking speed in coordinate units per second. */
const WALK_SPEED = 1.4;

// ---------------------------------------------------------------------------
// Segment builder
// ---------------------------------------------------------------------------

/**
 * Convert a raw IndoorPath into human-readable NavigationSegments.
 * Groups consecutive hallway waypoints into single "walk" segments and
 * identifies room entry/exit and floor transitions.
 */
function buildSegments(path: IndoorPath): NavigationSegment[] {
  const segments: NavigationSegment[] = [];
  const steps = path.steps;

  if (steps.length === 0) return segments;

  let walkNodeIds: string[] = [];
  let walkFloor = steps[0].node.floor;
  let walkStart = 0; // cumulative distance at start of current walk segment

  const flushWalk = (endDistance: number) => {
    if (walkNodeIds.length < 2) {
      walkNodeIds = [];
      return;
    }
    const dist = endDistance - walkStart;
    const meters = Math.round(dist / 10); // rough unit → meters conversion hint
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

    // Floor change
    if (prevNode && node.floor !== prevNode.floor) {
      flushWalk(steps[i - 1].cumulativeDistance);
      walkStart = step.cumulativeDistance;
      walkFloor = node.floor;

      // Detect elevator vs stairs by node label / type heuristics
      const isElevator =
        prevNode.label?.toLowerCase().includes("elev") ||
        node.label?.toLowerCase().includes("elev");

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

    // Room entry (destination)
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

    // Room exit (origin)
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

    // Doorway
    if (node.type === "doorway") {
      walkNodeIds.push(node.id);
      continue;
    }

    // Hallway waypoint / building_entry_exit → accumulate walk
    walkNodeIds.push(node.id);
  }

  // Flush any remaining walk
  if (walkNodeIds.length >= 2) {
    flushWalk(steps[steps.length - 1].cumulativeDistance);
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Compute a navigable indoor route between two rooms in the same building.
 *
 * @param buildingCode  e.g. "CC", "H", "MB"
 * @param originQuery   Room label / number for the starting room (e.g. "CC-110")
 * @param destQuery     Room label / number for the destination (e.g. "CC-120")
 * @param options       Optional pathfinding flags (accessibleOnly, etc.)
 */
export function getIndoorNavigationRoute(
  buildingCode: string,
  originQuery: string,
  destQuery: string,
  options: PathfindingOptions = {},
): NavigationResult {
  // 1. Resolve rooms via existing search infrastructure
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

  // 2. Get the raw graph asset
  const asset = getBuildingPlanAsset(buildingCode);
  if (!asset || !asset.edges || asset.edges.length === 0) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No graph data (edges) available for building "${buildingCode}".`,
    };
  }

  // 3. Map rooms to graph node ids
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

  // 4. Run Dijkstra
  const path = findShortestPath(asset, originNodeId, destNodeId, options);
  if (!path) {
    return {
      success: false,
      error: "NO_PATH_FOUND",
      message:
        "No path found between the two rooms. The rooms may not be connected in the graph.",
    };
  }

  // 5. Build segments and return
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
      estimatedSeconds: Math.round(path.totalDistance / WALK_SPEED),
    },
  };
}

// ---------------------------------------------------------------------------
// Convenience: just retrieve ordered path node ids for a floor (for rendering)
// ---------------------------------------------------------------------------

/**
 * Returns the (x, y) waypoints on a specific floor for a computed route.
 * Useful for drawing the path SVG overlay on the floor plan image.
 */
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
