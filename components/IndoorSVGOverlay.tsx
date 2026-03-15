import React, { useMemo } from "react";
import { Overlay } from "react-native-maps";
import type { Buildings } from "../constants/type";
import { Floor } from "../utils/IndoorMapComposite";

type Props = {
  floor: Floor;
  building: Buildings;
};

const ROOM_COLORS: Record<string, string> = {
  room: "rgba(255,255,255,0.88)",
  hallway: "rgba(241,239,232,0.82)",
  Eblock: "rgba(206,203,246,0.88)",
  block: "rgba(211,209,199,0.85)",
};

const STROKE_COLORS: Record<string, string> = {
  room: "rgba(120,120,120,0.55)",
  hallway: "rgba(160,160,160,0.3)",
  Eblock: "rgba(127,119,221,0.65)",
  block: "rgba(136,135,128,0.5)",
};

export function IndoorSVGOverlay({ floor, building }: Props) {
  const bounds = useMemo(() => {
    // Get pixel bounds from all coordinates
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    floor.getChildren().forEach((node) => {
      node.getCoordinates().forEach(([x, y]) => {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, [floor]);

  // Get real-world bounds from building boundingBox
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

  // react-native-maps Overlay needs bounds as [topLeft, bottomRight]
  const overlayBounds: [[number, number], [number, number]] = [
    [geoBounds.topLeft.latitude, geoBounds.topLeft.longitude],
    [geoBounds.bottomRight.latitude, geoBounds.bottomRight.longitude],
  ];

  return (
    <Overlay
      bounds={overlayBounds}
      image={{ uri: "data:image/svg+xml;base64,..." }} // we'll fix this below
    />
  );
}
