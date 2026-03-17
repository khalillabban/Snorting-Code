import React, { useMemo } from "react";
import { Overlay } from "react-native-maps";
import type { Buildings } from "../constants/type";
import type { ImageFloorPlan } from "../hooks/useFloorData";

type Props = {
  readonly source: ImageFloorPlan;
  readonly building: Buildings;
};

export function IndoorSVGOverlay({ source, building }: Props) {
  const geoBounds = useMemo(() => {
    if (!building.boundingBox?.length) return null;
    let minLat = Infinity,
      maxLat = -Infinity;
    let minLng = Infinity,
      maxLng = -Infinity;

    for (const { latitude, longitude } of building.boundingBox) {
      minLat = Math.min(minLat, latitude);
      maxLat = Math.max(maxLat, latitude);
      minLng = Math.min(minLng, longitude);
      maxLng = Math.max(maxLng, longitude);
    }

    if (!isFinite(minLat)) return null;
    return { minLat, maxLat, minLng, maxLng };
  }, [building.boundingBox]);

  if (!geoBounds) return null;

  // southWest first, northEast second — Google Maps requirement
  const overlayBounds: [[number, number], [number, number]] = [
    [geoBounds.minLat, geoBounds.minLng], // SW
    [geoBounds.maxLat, geoBounds.maxLng], // NE
  ];

  return <Overlay bounds={overlayBounds} image={source} />;
}
