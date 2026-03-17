import React from "react";
import { Overlay } from "react-native-maps";
import type { Buildings } from "../constants/type";
import type { ImageFloorPlan } from "../hooks/useFloorData";

type Props = {
  readonly source: ImageFloorPlan;
  readonly building: Buildings;
};

const OVERLAY_BOUNDS: Record<
  string,
  { sw: [number, number]; ne: [number, number] }
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

export function IndoorSVGOverlay({ source, building }: Props) {
  const box = building.boundingBox;
  if (!box?.length) return null;

  const cal = OVERLAY_BOUNDS[building.name];

  let sw: [number, number];
  let ne: [number, number];

  if (cal) {
    sw = cal.sw;
    ne = cal.ne;
  } else {
    const lats = box.map((p) => p.latitude);
    const lngs = box.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    if (!isFinite(minLat)) return null;
    sw = [minLat, minLng];
    ne = [maxLat, maxLng];
  }

  return <Overlay bounds={[sw, ne]} image={source} opacity={0.85} />;
}
