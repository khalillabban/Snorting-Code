import type { Buildings, RouteStep } from "../constants/type";
import type { TransitionPayload } from "./routeTransition";

export const DESTINATION_LEG_ORIGIN_SENTINEL = "ENTRANCE";

export type OpenIndoorNavArgs = {
  buildingCode: string;
  navOrigin: string;
  navDest?: string;
};

export function getContinueIndoorsBuildingCode(opts: {
  selectedDest?: Buildings | null;
  transitionPayload?: TransitionPayload | null;
}): string {
  const selected = opts.selectedDest?.name?.trim();
  if (selected) return selected;

  if (opts.transitionPayload?.mode === "indoor_to_outdoor") {
    const payloadCode = opts.transitionPayload.destinationBuildingCode?.trim();
    if (payloadCode) return payloadCode;
  }

  return "";
}

export function buildContinueIndoorsStep(opts: {
  baseSteps: RouteStep[];
  destinationBuildingCode: string;
  destinationRoomQuery: string;
}): { steps: (RouteStep & { onPress?: () => void })[]; openArgs: OpenIndoorNavArgs } | null {
  const destCode = opts.destinationBuildingCode.trim();
  if (!destCode) return null;

  const roomQuery = opts.destinationRoomQuery.trim();
  const instruction = "Continue indoors";

  const openArgs: OpenIndoorNavArgs = {
    buildingCode: destCode,
    navOrigin: DESTINATION_LEG_ORIGIN_SENTINEL,
    ...(roomQuery ? { navDest: roomQuery } : {}),
  };

  const step = {
    instruction,
  };

  return {
    steps: [...opts.baseSteps, step],
    openArgs,
  };
}
