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
    return {
      topLeft: { latitude: maxLat, longitude: minLng },
      topRight: { latitude: maxLat, longitude: maxLng },
      bottomLeft: { latitude: minLat, longitude: minLng },
      bottomRight: { latitude: minLat, longitude: maxLng },
    };
  }, [building.boundingBox]);

  if (!geoBounds) return null;

  const overlayBounds: [[number, number], [number, number]] = [
    [geoBounds.topLeft.latitude, geoBounds.topLeft.longitude],
    [geoBounds.bottomRight.latitude, geoBounds.bottomRight.longitude],
  ];

  return <Overlay bounds={overlayBounds} image={source} />;
}
