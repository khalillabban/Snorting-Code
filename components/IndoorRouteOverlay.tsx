import React, { useEffect, useMemo, useState } from "react";
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
    const polylineStr = screenPts.map((point) => `${point.x},${point.y}`).join(" ");

    return {
      points: polylineStr,
      originPoint: screenPts[0] ?? null,
      destPoint: screenPts.at(-1) ?? null,
    };
  }, [route, floor, coordinateScale, stageLayout, floorBounds]);

  if (!points || !originPoint) return null;

  const mainColor = accessibleOnly ? colors.routeTransit : colors.routeDrive;
  const alphaColor = accessibleOnly
    ? colors.secondaryTransparent
    : colors.primaryTransparent;

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
  const [isExpanded, setIsExpanded] = useState(false);
  const segmentCountLabel = `${route.segments.length} step${route.segments.length === 1 ? "" : "s"}`;
  const routeSignature = useMemo(
    () =>
      [
        route.origin.label,
        route.destination.label,
        route.estimatedSeconds,
        route.fullyAccessible,
        route.segments
          .map(
            (segment) =>
              `${segment.kind}|${segment.description}|${segment.floor}|${segment.distance}`,
          )
          .join("||"),
      ].join("::"),
    [route],
  );

  useEffect(() => {
    setIsExpanded(false);
  }, [routeSignature]);

  return (
    <View style={styles.container}>
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
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setIsExpanded((value) => !value)}
            style={styles.toggleButton}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Collapse directions steps" : "Expand directions steps"
            }
          >
            <Text style={styles.toggleButtonText}>{isExpanded ? "Hide" : "Show"}</Text>
          </Pressable>
          {onClose && (
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close directions"
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isExpanded ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {route.segments.map((segment, index) => (
            <SegmentRow
              key={`${segment.kind}-${segment.floor}-${segment.nodeIds.join(">")}-${segment.description}`}
              segment={segment}
              index={index}
            />
          ))}
        </ScrollView>
      ) : (
        <Pressable
          style={styles.preview}
          onPress={() => setIsExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel="Open indoor directions preview"
        >
          <Text style={styles.previewTitle}>{segmentCountLabel} available</Text>
          <Text style={styles.previewText}>
            Expand to view step-by-step directions while keeping more of the map
            visible.
          </Text>
        </Pressable>
      )}
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
  const icon = SEGMENT_ICONS[segment.kind] ?? "•";
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
