import type { LatLng } from "../constants/type";
import {
  findShortestPath,
  resolveRoutingNodeId,
  type PathfindingOptions,
} from "./indoorPathFinding";
import {
  getBuildingPlanAsset,
  normalizeIndoorBuildingCode,
  type BuildingPlanAsset,
  type BuildingPlanNode,
} from "./mapAssets";

export const BUILDING_EXIT_NODE_TYPE = "building_entry_exit" as const;

export interface SelectedIndoorExit {
  node: BuildingPlanNode;
  nodeId: string;
  pathDistance: number;
  outdoorLatLng?: LatLng;
}

type OutdoorLatLngNodeField = {
  outdoorLatLng?: LatLng;
};

function getExitOutdoorLatLng(node: BuildingPlanNode): LatLng | undefined {
  const maybe = (node as unknown as OutdoorLatLngNodeField).outdoorLatLng;
  if (!maybe) return undefined;
  if (
    typeof maybe.latitude !== "number" ||
    typeof maybe.longitude !== "number" ||
    Number.isNaN(maybe.latitude) ||
    Number.isNaN(maybe.longitude)
  ) {
    return undefined;
  }
  return maybe;
}

export type IndoorExitSelectionError =
  | "NO_GRAPH_DATA"
  | "NO_ORIGIN_NODE"
  | "NO_EXIT_NODES"
  | "NO_REACHABLE_EXIT";

export type IndoorExitSelectionResult =
  | { success: true; exit: SelectedIndoorExit }
  | { success: false; error: IndoorExitSelectionError; message: string };

function isExitNode(node: BuildingPlanNode): boolean {
  return (node.type || "").toLowerCase() === BUILDING_EXIT_NODE_TYPE;
}

export function getExitNodes(asset: BuildingPlanAsset): BuildingPlanNode[] {
  return (asset.nodes ?? []).filter(isExitNode);
}

/**
 * Selects the best building exit based on *graph shortest path distance*, not Euclidean distance.
 *
 * Origin is identified by resolving an indoor routing node ID, consistent with other indoor routing.
 */
export function selectBestIndoorExit(
  buildingCode: string,
  origin: {
    roomOrNodeId: string;
    x: number;
    y: number;
    floor: number;
  },
  options: PathfindingOptions = {},
): IndoorExitSelectionResult {
  const normalized = normalizeIndoorBuildingCode(buildingCode);
  const asset = getBuildingPlanAsset(normalized);

  if (!asset || !asset.nodes || asset.nodes.length === 0 || !asset.edges?.length) {
    return {
      success: false,
      error: "NO_GRAPH_DATA",
      message: `No indoor graph data available for "${normalized}".`,
    };
  }

  const originNodeId = resolveRoutingNodeId(
    asset,
    origin.roomOrNodeId,
    origin.x,
    origin.y,
    origin.floor,
  );

  if (!originNodeId) {
    return {
      success: false,
      error: "NO_ORIGIN_NODE",
      message: "Could not map origin to the indoor navigation graph.",
    };
  }

  const exits = getExitNodes(asset);
  if (exits.length === 0) {
    return {
      success: false,
      error: "NO_EXIT_NODES",
      message: `No building exits found for "${normalized}".`,
    };
  }

  let best: SelectedIndoorExit | null = null;

  for (const exit of exits) {
    const path = findShortestPath(asset, originNodeId, exit.id, options);
    if (!path) continue;

    const candidate: SelectedIndoorExit = {
      node: exit,
      nodeId: exit.id,
      pathDistance: path.totalDistance,
      outdoorLatLng: getExitOutdoorLatLng(exit),
    };

    if (!best || candidate.pathDistance < best.pathDistance) {
      best = candidate;
    }
  }

  if (!best) {
    return {
      success: false,
      error: "NO_REACHABLE_EXIT",
      message: options.accessibleOnly
        ? "No accessible exit route found."
        : "No reachable exit route found.",
    };
  }

  return { success: true, exit: best };
}

/**
 * Generic (and explicit) fallback when we only know the building centroid.
 */
export function getBuildingOutdoorFallback(buildingCode: string): LatLng | null {
  // Avoid importing the giant BUILDINGS list here.
  // The primary flow should pass a proper outdoor LatLng; this is a helper for callers.
  return null;
}
