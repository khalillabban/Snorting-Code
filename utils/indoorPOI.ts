/*
 * POIs come from two sources:
 *  1. Structural nodes already in the building plan JSON 
 *   --> stairs, elevators, entrances
 *  2. Manually added amenities that are visible on the SVG floor plans but not encoded as graph nodes 
 *   --> washrooms, water fountains
 */

import {
  NODE_TYPE_TO_POI,
  POICategoryId,
} from "../constants/indoorPOI";
import { getBuildingPlanAsset, normalizeIndoorBuildingCode } from "./mapAssets";

export interface IndoorPOI {
  id: string;
  category: POICategoryId;
  buildingCode: string;
  floor: number;
  x: number;
  y: number;
  label?: string;
}

interface ManualPOIEntry {
  category: POICategoryId;
  floor: number;
  x: number;
  y: number;
  label?: string;
}

const MANUAL_POI_REGISTRY: Record<string, ManualPOIEntry[]> = {
  H: [
    // Floor 8
    { category: "washroom", floor: 8, x: 800, y: 520, label: "Washroom" },
    { category: "washroom", floor: 8, x: 1275, y: 520, label: "Washroom" },
    { category: "water_fountain", floor: 8, x: 660, y: 430, label: "Water Fountain" },
    { category: "water_fountain", floor: 8, x: 1350, y: 430, label: "Water Fountain" },
    { category: "water_fountain", floor: 8, x: 530, y: 1600, label: "Water Fountain" },
    // Floor 9
    { category: "washroom", floor: 9, x: 780, y: 1530, label: "Washroom" },
    { category: "washroom", floor: 9, x: 1270, y: 1530, label: "Washroom" },
    { category: "water_fountain", floor: 9, x: 520, y: 640, label: "Water Fountain" },
    { category: "water_fountain", floor: 9, x: 690, y: 1530, label: "Water Fountain" },
    { category: "water_fountain", floor: 9, x: 1750, y: 1300, label: "Water Fountain" },
  ],
  MB: [
    // Floor 1
    { category: "washroom", floor: 1, x: 720, y: 760, label: "Washroom" },
    { category: "washroom", floor: 1, x: 800, y: 790, label: "Washroom" },
    { category: "water_fountain", floor: 1, x: 755, y: 790, label: "Water Fountain" },
    // Floor -2 (S2)
    { category: "washroom", floor: -2, x: 645, y: 770, label: "Washroom" },
    { category: "washroom", floor: -2, x: 730, y: 770, label: "Washroom" },
    { category: "water_fountain", floor: -2, x: 690, y: 790, label: "Water Fountain" },
  ],
  VE: [
    // Floor 2
    { category: "washroom", floor: 2, x: 520, y: 210, label: "Washroom" },
    { category: "washroom", floor: 2, x: 660, y: 210, label: "Washroom" },
    { category: "water_fountain", floor: 2, x: 590, y: 240, label: "Water Fountain" },
  ],
  VL: [
    // Floor 1
    { category: "washroom", floor: 1, x: 80, y: 710, label: "Washroom" },
    { category: "washroom", floor: 1, x: 710, y: 300, label: "Washroom" },
    { category: "washroom", floor: 1, x: 710, y: 240, label: "Washroom" },
    { category: "water_fountain", floor: 1, x: 650, y: 260, label: "Water Fountain" },
    // Floor 2
    { category: "washroom", floor: 2, x: 700, y: 235, label: "Washroom" },
    { category: "washroom", floor: 2, x: 700, y: 305, label: "Washroom" },
    { category: "water_fountain", floor: 2, x: 650, y: 270, label: "Water Fountain" },
  ],
  CC: [],
};

export function getIndoorPOIs(buildingCode: string): IndoorPOI[] {
  const code = normalizeIndoorBuildingCode(buildingCode);
  const pois: IndoorPOI[] = [];

  const asset = getBuildingPlanAsset(code);
  if (asset) {
    for (const node of asset.nodes) {
      const category = NODE_TYPE_TO_POI[node.type];
      if (category) {
        pois.push({
          id: node.id,
          category,
          buildingCode: code,
          floor: node.floor,
          x: node.x,
          y: node.y,
          label: node.label || undefined,
        });
      }
    }
  }

  const manual = MANUAL_POI_REGISTRY[code];
  if (manual) {
    manual.forEach((entry, i) => {
      pois.push({
        id: `${code}_manual_poi_${i}`,
        category: entry.category,
        buildingCode: code,
        floor: entry.floor,
        x: entry.x,
        y: entry.y,
        label: entry.label,
      });
    });
  }

  return pois;
}

export function filterPOIsByFloor(pois: IndoorPOI[], floor: number): IndoorPOI[] {
  return pois.filter((poi) => poi.floor === floor);
}

export function filterPOIsByCategories(
  pois: IndoorPOI[],
  activeCategories: Set<POICategoryId>,
): IndoorPOI[] {
  if (activeCategories.size === 0) return [];
  return pois.filter((poi) => activeCategories.has(poi.category));
}
