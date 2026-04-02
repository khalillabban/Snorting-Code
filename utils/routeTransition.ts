import type { LatLng } from "../constants/type";
import type { RouteStrategy } from "../services/Routing";

export type NavigationContextMode = "indoor" | "outdoor" | "indoor_to_outdoor";

// Future-friendly union: for now we primarily serialize IndoorToOutdoorTransitionPayload,
// but cross-building indoor trips can also start from the outdoor screen.
export type CrossBuildingNavigationContextMode =
  | NavigationContextMode
  | "cross_building_indoor";

export interface IndoorToOutdoorTransitionPayload {
  mode: "indoor_to_outdoor";
  originBuildingCode: string;
  exitNodeId: string;
  exitIndoor: {
    buildingCode: string;
    floor: number;
    x: number;
    y: number;
  };
  exitOutdoor: LatLng;
  destinationBuildingCode: string;
  destinationCampus?: string;
  strategy?: RouteStrategy;
  accessibleOnly?: boolean;
  usabilityTaskId?: "task_13" | "task_14";
  usabilityTaskStartedAtMs?: number;

  /**
   * Optional: if provided, the outdoor screen can compute the final indoor leg
   * and present a single merged step list (indoor + outdoor + indoor).
   */
  destinationIndoorRoomQuery?: string;
}

export interface CrossBuildingIndoorTripPayload {
  mode: "cross_building_indoor";
  originBuildingCode: string;
  originIndoorRoomQuery: string;
  destinationBuildingCode: string;
  destinationIndoorRoomQuery: string;
  strategy?: RouteStrategy;
  accessibleOnly?: boolean;
  usabilityTaskId?: "task_13" | "task_14";
  usabilityTaskStartedAtMs?: number;
}

export type TransitionPayload =
  | IndoorToOutdoorTransitionPayload
  | CrossBuildingIndoorTripPayload;

export function serializeTransitionPayload(payload: TransitionPayload): string {
  return JSON.stringify(payload);
}

export function parseTransitionPayload(
  raw: string | undefined,
): TransitionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed.mode !== "string") return null;

    if (parsed.mode === "indoor_to_outdoor") {
      if (
        typeof parsed.exitOutdoor?.latitude !== "number" ||
        typeof parsed.exitOutdoor?.longitude !== "number"
      )
        return null;
      return parsed as IndoorToOutdoorTransitionPayload;
    }

    if (parsed.mode === "cross_building_indoor") {
      if (!parsed.originBuildingCode || !parsed.destinationBuildingCode)
        return null;
      if (!parsed.originIndoorRoomQuery || !parsed.destinationIndoorRoomQuery)
        return null;
      return parsed as CrossBuildingIndoorTripPayload;
    }

    return null;
  } catch {
    return null;
  }
}
