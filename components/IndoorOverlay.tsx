import { GeoJSONData, parseGeoJSONToFloor } from "@/utils/IndoorMapComposite";
import React, { useMemo } from "react";
import { Polygon } from "react-native-maps";
import type { Buildings } from "../constants/type";
import { pixelToLatLng } from "../utils/pixelToLatLng";

type Feature = {
  properties: { name: string; type: string };
  geometry: { coordinates: number[][][] };
};

type Props = {
  readonly geojson: GeoJSONData;
  readonly building: Buildings;
  readonly highlightedRoom?: string | null;
};

const LAYER_ORDER = ["hallway", "block", "Eblock", "room"];

const ROOM_STYLE = {
  room: {
    fill: "rgba(255,255,255,0.88)",
    stroke: "rgba(120,120,120,0.55)",
    width: 1,
  },
  hallway: {
    fill: "rgba(241,239,232,0.82)",
    stroke: "rgba(160,160,160,0.3)",
    width: 0.5,
  },
  Eblock: {
    fill: "rgba(206,203,246,0.88)",
    stroke: "rgba(127,119,221,0.65)",
    width: 1,
  },
  block: {
    fill: "rgba(211,209,199,0.85)",
    stroke: "rgba(136,135,128,0.5)",
    width: 0.5,
  },
};

const HIGHLIGHTED_STYLE = {
  fill: "rgba(181,212,244,0.92)",
  stroke: "rgba(24,95,165,0.9)",
  width: 2,
};

export function IndoorOverlay({ geojson, building, highlightedRoom }: Props) {
  const floor = useMemo(
    () => parseGeoJSONToFloor(geojson, 1, building.name),
    [geojson, building.name],
  );

  const allNodes = useMemo(() => floor.getChildren(), [floor]);
  // Temporarily at the top of IndoorOverlay component body
  console.log(
    "[IndoorOverlay] mapCorners:",
    JSON.stringify(building.mapCorners),
  );
  console.log(
    "[IndoorOverlay] first node coords:",
    allNodes[0]?.getCoordinates().slice(0, 2),
  );
  return (
    <>
      {allNodes.map((node, index) => {
        const type = node.getType();
        const name = node.getName();
        const isHighlighted = !!highlightedRoom && name === highlightedRoom;
        const baseStyle =
          ROOM_STYLE[type as keyof typeof ROOM_STYLE] ?? ROOM_STYLE.room;

        const coordinates = node
          .getCoordinates()
          .map(([x, y]) => pixelToLatLng(x, y, building));

        return (
          <Polygon
            key={`indoor-${index}-${name}`}
            coordinates={coordinates}
            fillColor={isHighlighted ? HIGHLIGHTED_STYLE.fill : baseStyle.fill}
            strokeColor={
              isHighlighted ? HIGHLIGHTED_STYLE.stroke : baseStyle.stroke
            }
            strokeWidth={
              isHighlighted ? HIGHLIGHTED_STYLE.width : baseStyle.width
            }
            tappable={type === "room"}
            zIndex={LAYER_ORDER.indexOf(type)}
          />
        );
      })}
    </>
  );
}
