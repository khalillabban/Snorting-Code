import {
    findIndoorPath,
    getFloorGraphData,
    type GraphNode,
} from "@/utils/IndoorNavigationGraph";
import { useMemo } from "react";
import { BUILDINGS } from "../constants/buildings";
import type { Buildings } from "../constants/type";

export type LatLng = { latitude: number; longitude: number };

/**
 * Given a building and its bounding box, convert a pixel coordinate
 * (from the floor plan graph, 0–1000 range) into a GPS LatLng.
 *
 * We use the building's boundingBox to define the transform:
 *   - boundingBox[0] = top-left corner (min lat, min lng  — SW)
 *   - boundingBox[1] = top-right corner
 *   - boundingBox[2] = bottom-right corner (max lat, max lng — NE)
 *   - boundingBox[3] = bottom-left corner
 *
 * The floor plan pixel space is assumed to be 1000x1000.
 */
const FLOOR_PLAN_NATIVE_W = 1000;
const FLOOR_PLAN_NATIVE_H = 1000;

function pixelToLatLng(
  px: number,
  py: number,
  building: Buildings,
): LatLng | null {
  const box = building.boundingBox;
  if (!box || box.length < 4) return null;

  // Derive bounding lat/lng from the polygon corners
  const lats = box.map((p) => p.latitude);
  const lngs = box.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // px=0 → west (minLng), px=1000 → east (maxLng)
  // py=0 → north (maxLat), py=1000 → south (minLat)
  const lng = minLng + (px / FLOOR_PLAN_NATIVE_W) * (maxLng - minLng);
  const lat = maxLat - (py / FLOOR_PLAN_NATIVE_H) * (maxLat - minLat);

  return { latitude: lat, longitude: lng };
}

function findBuildingByName(name: string): Buildings | undefined {
  // Graph uses "Hall" as buildingId, buildings use "H" as name
  const normalized = name === "Hall" ? "H" : name;
  return BUILDINGS.find((b) => b.name === normalized);
}

export type IndoorPathResult = {
  /** Path node IDs */
  path: string[];
  /** GPS coordinates for rendering as a Polyline on the map */
  coordinates: LatLng[];
  /** Which floor this path is on */
  floor: number;
  /** The building this path belongs to */
  buildingName: string;
};

/**
 * Computes the indoor path for a given building between two room IDs.
 * Returns GPS coordinates suitable for a react-native-maps Polyline.
 */
export function useIndoorPath(
  buildingName: string | null,
  startRoomId: string | null,
  endRoomId: string | null,
  accessibleOnly: boolean = false,
): IndoorPathResult | null {
  return useMemo(() => {
    if (!buildingName || !startRoomId || !endRoomId) return null;

    // Normalize: MB-S2 rooms live in MB graph
    const graphKey = buildingName.startsWith("MB") ? "MB" : buildingName;
    const graphData = getFloorGraphData(graphKey);
    if (!graphData) return null;

    const path = findIndoorPath(
      graphData,
      startRoomId,
      endRoomId,
      accessibleOnly,
    );
    if (!path || path.length === 0) return null;

    const nodeMap: Record<string, GraphNode> = {};
    for (const n of graphData.nodes) nodeMap[n.id] = n;

    // Determine which building to use for geo projection
    // Use the building the start room belongs to
    const startNode = nodeMap[startRoomId];
    const buildingId = startNode?.buildingId ?? graphKey;
    const building = findBuildingByName(
      buildingId.startsWith("MB") ? "MB" : buildingId,
    );
    if (!building) return null;

    // Determine floor from start node
    const floor = startNode?.floor ?? 1;

    // Convert path pixel coords → GPS
    const coordinates: LatLng[] = path
      .map((id) => {
        const node = nodeMap[id];
        if (!node) return null;
        return pixelToLatLng(node.x, node.y, building);
      })
      .filter((c): c is LatLng => c !== null);

    if (coordinates.length < 2) return null;

    return { path, coordinates, floor, buildingName: graphKey };
  }, [buildingName, startRoomId, endRoomId, accessibleOnly]);
}

/**
 * For a route that spans two different buildings, returns both indoor paths.
 */
export function useBothIndoorPaths(
  startBuildingName: string | null,
  startRoomId: string | null,
  endBuildingName: string | null,
  endRoomId: string | null,
  accessibleOnly: boolean = false,
): {
  startPath: IndoorPathResult | null;
  endPath: IndoorPathResult | null;
} {
  const isSameBuilding =
    startBuildingName &&
    endBuildingName &&
    startBuildingName.split("-")[0] === endBuildingName.split("-")[0];

  const startPath = useIndoorPath(
    startBuildingName,
    startRoomId,
    isSameBuilding ? endRoomId : null,
    accessibleOnly,
  );

  // For different buildings, end path goes from entrance to end room
  // We use the endRoom directly — pathfinding handles it within its graph
  const endPath = useIndoorPath(
    !isSameBuilding ? endBuildingName : null,
    !isSameBuilding ? endRoomId : null,
    !isSameBuilding ? endRoomId : null,
    accessibleOnly,
  );

  return { startPath, endPath: isSameBuilding ? null : endPath };
}
