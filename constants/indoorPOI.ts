export type POICategoryId =
  | "washroom"
  | "water_fountain"
  | "stairs"
  | "elevator"
  | "entrance";

export interface POICategoryDefinition {
  id: POICategoryId;
  label: string;
  icon: string;
  color: string;
}

export const POI_CATEGORIES: POICategoryDefinition[] = [
  { id: "washroom", label: "Washrooms", icon: "human-male-female", color: "#1565c0" },
  { id: "water_fountain", label: "Water", icon: "water", color: "#0097a7" },
  { id: "stairs", label: "Stairs", icon: "stairs", color: "#6a1b9a" },
  { id: "elevator", label: "Elevators", icon: "elevator-passenger", color: "#2e7d32" },
  { id: "entrance", label: "Entrances", icon: "door-open", color: "#e65100" },
];

export const NODE_TYPE_TO_POI: Record<string, POICategoryId> = {
  stair_landing: "stairs",
  elevator_door: "elevator",
  building_entry_exit: "entrance",
};

export const POI_CATEGORY_MAP: Record<POICategoryId, POICategoryDefinition> =
  Object.fromEntries(POI_CATEGORIES.map((c) => [c.id, c])) as Record<
    POICategoryId,
    POICategoryDefinition
  >;
