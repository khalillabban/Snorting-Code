//IndoorRouteOverlay.tsx
import React from "react";
import { View } from "react-native";
import { Marker, Polyline } from "react-native-maps";
import type { IndoorPathResult } from "../hooks/useIndoorPath";

type Props = {
  pathResult: IndoorPathResult;
  color?: string;
  showEndpoints?: boolean;
};

export function IndoorRouteOverlay({
  pathResult,
  color = "#1E90FF",
  showEndpoints = true,
}: Props) {
  const { coordinates } = pathResult;
  if (!coordinates || coordinates.length < 2) return null;

  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  return (
    <>
      {/* Shadow/border line */}
      <Polyline
        coordinates={coordinates}
        strokeWidth={7}
        strokeColor="rgba(0,0,0,0.25)"
        lineJoin="round"
        lineCap="round"
        zIndex={10}
      />
      {/* Main path line */}
      <Polyline
        coordinates={coordinates}
        strokeWidth={5}
        strokeColor={color}
        lineJoin="round"
        lineCap="round"
        zIndex={11}
      />

      {/* Start dot (green) */}
      {showEndpoints && start && (
        <Marker
          coordinate={start}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={12}
          tracksViewChanges={false}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#22c55e",
              borderWidth: 2,
              borderColor: "white",
            }}
          />
        </Marker>
      )}

      {/* End dot (red) */}
      {showEndpoints && end && (
        <Marker
          coordinate={end}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={12}
          tracksViewChanges={false}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: "#ef4444",
              borderWidth: 2,
              borderColor: "white",
            }}
          />
        </Marker>
      )}
    </>
  );
}
