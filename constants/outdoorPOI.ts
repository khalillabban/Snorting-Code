import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";

export type OutdoorPOICategoryId =
  | "restaurant"
  | "coffee"
  | "study"
  | "grocery"
  | "pharmacy"
  | "atm";

type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export interface OutdoorPOICategoryDefinition {
  id: OutdoorPOICategoryId;
  label: string;
  icon: MaterialIconName;
  color: string;
  googlePlacesType: string;
}

export const OUTDOOR_POI_CATEGORIES: OutdoorPOICategoryDefinition[] = [
  { id: "restaurant", label: "Food", icon: "silverware-fork-knife", color: "#e65100", googlePlacesType: "restaurant" },
  { id: "coffee", label: "Coffee", icon: "coffee", color: "#6d4c41", googlePlacesType: "cafe" },
  { id: "study", label: "Library", icon: "book-open-variant", color: "#1565c0", googlePlacesType: "library" },
  { id: "grocery", label: "Grocery", icon: "cart", color: "#2e7d32", googlePlacesType: "supermarket" },
  { id: "pharmacy", label: "Pharmacy", icon: "medical-bag", color: "#c62828", googlePlacesType: "pharmacy" },
  { id: "atm", label: "ATMs", icon: "cash-multiple", color: "#0277bd", googlePlacesType: "atm" },
];

export const OUTDOOR_POI_CATEGORY_MAP: Record<OutdoorPOICategoryId, OutdoorPOICategoryDefinition> =
  Object.fromEntries(OUTDOOR_POI_CATEGORIES.map((c) => [c.id, c])) as Record<
    OutdoorPOICategoryId,
    OutdoorPOICategoryDefinition
  >;
