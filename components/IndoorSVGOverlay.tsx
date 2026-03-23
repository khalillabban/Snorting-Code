import React from "react";
import { ImageURISource } from "react-native";
import { Overlay } from "react-native-maps";
import type { Buildings } from "../constants/type";
import type { ImageFloorPlan } from "../hooks/useFloorData";

type Props = {
  readonly source: ImageFloorPlan;
  readonly building: Buildings;
};

type OverlayBounds = { sw: [number, number]; ne: [number, number] };

const CALIBRATED_OVERLAY_BOUNDS: Record<
  string,
  OverlayBounds
> = {
  H: {
    sw: [45.49682818364492, -73.57954223351966],
    ne: [45.497708183281496, -73.57833870872308],
  },
  MB: {
    sw: [45.495026633071944, -73.57962398739532],
    ne: [45.495597256069885, -73.57847600193695],
  },
};

function resolveOverlayBounds(building: Buildings): OverlayBounds | null {
  const calibrated = CALIBRATED_OVERLAY_BOUNDS[building.name];
  if (calibrated) return calibrated;

  const box = building.boundingBox;
  if (!box?.length) return null;

  const lats = box.map((point) => point.latitude);
  const lngs = box.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  if (![minLat, maxLat, minLng, maxLng].every(Number.isFinite)) {
    return null;
  }

  return {
    sw: [minLat, minLng],
    ne: [maxLat, maxLng],
  };
}

export function IndoorSVGOverlay({ source, building }: Props) {
  const bounds = resolveOverlayBounds(building);
  if (!bounds) return null;

  // Convert string URLs to ImageURISource objects for Overlay compatibility
  const imageSource: number | ImageURISource =
    typeof source === "string" ? { uri: source } : source;

  return (
    <Overlay
      bounds={[bounds.sw, bounds.ne]}
      image={imageSource}
      opacity={0.85}
    />
  );
}
