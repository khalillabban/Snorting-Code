import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polyline } from "react-native-svg";
import { styles } from "../styles/IndoorRouteOverlay.styles";
import {
  NavigationRoute,
  NavigationSegment,
  getRouteWaypointsForFloor,
} from "../utils/indoorNavigation";

interface FloorStageLayout {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  scale: number;
}

interface FloorBounds {
  minX: number;
  minY: number;
}

interface IndoorRouteOverlayProps {
  route: NavigationRoute;
  floor: number;
  coordinateScale: number;
  stageLayout: FloorStageLayout;
  floorBounds: FloorBounds;
  accessibleOnly?: boolean;
}

const ROUTE_COLOR = "#3B82F6";
const ROUTE_COLOR_ALPHA = "#3B82F640";
const ACCESSIBLE_ROUTE_COLOR = "#2563eb"; // blue-600
const ACCESSIBLE_ROUTE_COLOR_ALPHA = "#2563eb40";
const DESTINATION_COLOR = "#EF4444";
const ORIGIN_COLOR = "#22C55E";
const STROKE_WIDTH = 3.5;
const DOT_RADIUS = 5;

export function IndoorRouteOverlay({
  route,
  floor,
  coordinateScale,
  stageLayout,
  floorBounds,
  accessibleOnly,
}: Readonly<IndoorRouteOverlayProps>) {
  const { points, originPoint, destPoint } = useMemo(() => {
    const waypoints = getRouteWaypointsForFloor(route, floor, coordinateScale);

    const toScreen = (pt: { x: number; y: number }) => ({
      x: stageLayout.frameLeft + (pt.x - floorBounds.minX) * stageLayout.scale,
      y: stageLayout.frameTop + (pt.y - floorBounds.minY) * stageLayout.scale,
    });

    const screenPts = waypoints.map(toScreen);
    const polylineStr = screenPts.map((p) => `${p.x},${p.y}`).join(" ");

    const first = screenPts[0] ?? null;
    const last = screenPts[screenPts.length - 1] ?? null;

    return {
      points: polylineStr,
      originPoint: first,
      destPoint: last,
    };
  }, [route, floor, coordinateScale, stageLayout, floorBounds]);

  if (!points || !originPoint) return null;

  const mainColor = accessibleOnly ? ACCESSIBLE_ROUTE_COLOR : ROUTE_COLOR;
  const alphaColor = accessibleOnly ? ACCESSIBLE_ROUTE_COLOR_ALPHA : ROUTE_COLOR_ALPHA;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Polyline
        points={points}
        stroke={alphaColor}
        strokeWidth={STROKE_WIDTH * 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Polyline
        points={points}
        stroke={mainColor}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8,4"
        fill="none"
      />

      <G>
        <Circle
          cx={originPoint.x}
          cy={originPoint.y}
          r={DOT_RADIUS + 3}
          fill={alphaColor}
        />
        <Circle
          cx={originPoint.x}
          cy={originPoint.y}
          r={DOT_RADIUS}
          fill={ORIGIN_COLOR}
        />
      </G>

      {destPoint &&
        (destPoint.x !== originPoint.x || destPoint.y !== originPoint.y) && (
        <G>
          <Circle
            cx={destPoint.x}
            cy={destPoint.y}
            r={DOT_RADIUS + 3}
            fill={alphaColor}
          />
          <Circle
            cx={destPoint.x}
            cy={destPoint.y}
            r={DOT_RADIUS}
            fill={DESTINATION_COLOR}
          />
        </G>
      )}
    </Svg>
  );
}

interface IndoorDirectionsPanelProps {
  route: NavigationRoute;
  onClose?: () => void;
}

const SEGMENT_ICONS: Record<string, string> = {
  walk: "→",
  exit_room: "🚪",
  enter_room: "📍",
  stairs: "🪜",
  elevator: "🛗",
};

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function IndoorDirectionsPanel({
  route,
  onClose,
}: IndoorDirectionsPanelProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {route.origin.label} → {route.destination.label}
          </Text>
          <Text style={styles.subtitle}>
            {formatTime(route.estimatedSeconds)} walk
            {!route.fullyAccessible
              ? " · some inaccessible sections"
              : " · fully accessible"}
          </Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Steps */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {route.segments.map((seg, index) => (
          <SegmentRow key={index} segment={seg} index={index} />
        ))}
      </ScrollView>
    </View>
  );
}

function SegmentRow({
  segment,
  index,
}: {
  segment: NavigationSegment;
  index: number;
}) {
  const icon = SEGMENT_ICONS[segment.kind] ?? "·";
  const isTransition = segment.kind === "stairs" || segment.kind === "elevator";

  return (
    <View style={[styles.row, isTransition && styles.rowTransition]}>
      <View style={styles.iconWrapper}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.stepNumber}>Step {index + 1}</Text>
        <Text style={styles.stepText}>{segment.description}</Text>
        {segment.kind === "walk" && segment.distance > 0 && (
          <Text style={styles.stepMeta}>
            Floor {segment.floor} · ~{Math.round(segment.distance / 10)}m
          </Text>
        )}
      </View>
    </View>
  );
}
