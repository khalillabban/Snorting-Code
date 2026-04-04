import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polyline } from "react-native-svg";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
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
  const { colors } = useColorAccessibility();
  const { points, originPoint, destPoint } = useMemo(() => {
    const waypoints = getRouteWaypointsForFloor(route, floor, coordinateScale);

    const toScreen = (pt: { x: number; y: number }) => ({
      x: stageLayout.frameLeft + (pt.x - floorBounds.minX) * stageLayout.scale,
      y: stageLayout.frameTop + (pt.y - floorBounds.minY) * stageLayout.scale,
    });

    const screenPts = waypoints.map(toScreen);
    const polylineStr = screenPts.map((p) => `${p.x},${p.y}`).join(" ");

    const first = screenPts[0] ?? null;
    const last = screenPts.at(-1) ?? null;

    return {
      points: polylineStr,
      originPoint: first,
      destPoint: last,
    };
  }, [route, floor, coordinateScale, stageLayout, floorBounds]);

  if (!points || !originPoint) return null;

  const mainColor = accessibleOnly ? colors.routeTransit : colors.routeDrive;
  const alphaColor = accessibleOnly ? colors.secondaryTransparent : colors.primaryTransparent;

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
          fill={colors.success}
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
            fill={colors.error}
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
}: Readonly<IndoorDirectionsPanelProps>) {
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
            {route.fullyAccessible
              ? " · fully accessible"
              : " · some inaccessible sections"}
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
          <SegmentRow
            key={`${seg.kind}-${seg.floor}-${seg.nodeIds.join(">")}-${seg.description}`}
            segment={seg}
            index={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function SegmentRow({
  segment,
  index,
}: Readonly<{
  segment: NavigationSegment;
  index: number;
}>) {
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
