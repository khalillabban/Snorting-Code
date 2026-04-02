import { BUILDINGS } from "../constants/buildings";
import { Buildings } from "../constants/type";

// Find a Buildings object by its short code (e.g. "H", "MB", "FG"), return null when no match is found
export function findBuildingByCode(code: string): Buildings | null {
  if (!code) return null;
  const upper = code.toUpperCase().trim();

  return (
    BUILDINGS.find((b) => b.name.toUpperCase() === upper) ?? null
  );
}
