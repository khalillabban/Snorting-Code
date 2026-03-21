/**
 * IndoorRouteOverlay
 *
 * Drop this component on top of the existing IndoorMapScreen map viewport
 * to render the computed navigation route as an SVG polyline overlay.
 *
 * It also exports <IndoorDirectionsPanel> which shows the turn-by-turn list.
 *
 * Dependencies (already used by the project):
 *   react-native-svg  — add via: npx expo install react-native-svg
 */

import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polyline } from "react-native-svg";
import {
  NavigationRoute,
  NavigationSegment,
  getRouteWaypointsForFloor,
} from "../utils/indoorNavigation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  /** Must match the same layout object computed in IndoorMapScreen. */
  stageLayout: FloorStageLayout;
  floorBounds: FloorBounds;
}

// ---------------------------------------------------------------------------
// Colour tokens — mirror your existing theme or replace with imports
// ---------------------------------------------------------------------------

const ROUTE_COLOR = "#3B82F6"; // blue-500
const ROUTE_COLOR_ALPHA = "#3B82F640"; // blue-500 @ 25%
const DESTINATION_COLOR = "#EF4444"; // red-500
const ORIGIN_COLOR = "#22C55E"; // green-500
const STROKE_WIDTH = 3.5;
const DOT_RADIUS = 5;

// ---------------------------------------------------------------------------
// IndoorRouteOverlay
// ---------------------------------------------------------------------------

/**
 * Renders the route polyline and endpoint markers as an SVG layer that sits
 * exactly on top of the floor plan image inside IndoorMapScreen's mapViewport.
 *
 * Usage inside IndoorMapScreen (inside the <View style={styles.mapViewport}>):
 *
 *   {route && (
 *     <IndoorRouteOverlay
 *       route={route}
 *       floor={selectedFloor}
 *       coordinateScale={coordinateScale}
 *       stageLayout={floorStageLayout}
 *       floorBounds={floorBounds}
 *     />
 *   )}
 */
export function IndoorRouteOverlay({
  route,
  floor,
  coordinateScale,
  stageLayout,
  floorBounds,
}: IndoorRouteOverlayProps) {
  const { points, originPoint, destPoint } = useMemo(() => {
    const waypoints = getRouteWaypointsForFloor(route, floor, coordinateScale);

    // Transform from asset coordinates → screen coordinates
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

  // Nothing to draw for this floor
  if (!points || !originPoint) return null;

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Shadow / halo */}
      <Polyline
        points={points}
        stroke={ROUTE_COLOR_ALPHA}
        strokeWidth={STROKE_WIDTH * 3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Main route line */}
      <Polyline
        points={points}
        stroke={ROUTE_COLOR}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="8,4"
        fill="none"
      />

      {/* Origin marker */}
      <G>
        <Circle
          cx={originPoint.x}
          cy={originPoint.y}
          r={DOT_RADIUS + 3}
          fill={ROUTE_COLOR_ALPHA}
        />
        <Circle
          cx={originPoint.x}
          cy={originPoint.y}
          r={DOT_RADIUS}
          fill={ORIGIN_COLOR}
        />
      </G>

      {/* Destination marker (only if on this floor) */}
      {destPoint && destPoint !== originPoint && (
        <G>
          <Circle
            cx={destPoint.x}
            cy={destPoint.y}
            r={DOT_RADIUS + 3}
            fill={ROUTE_COLOR_ALPHA}
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

// ---------------------------------------------------------------------------
// IndoorDirectionsPanel
// ---------------------------------------------------------------------------

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

/**
 * A scrollable directions panel listing all turn-by-turn segments.
 *
 * Usage:
 *   <IndoorDirectionsPanel route={route} onClose={() => setRoute(null)} />
 */
export function IndoorDirectionsPanel({
  route,
  onClose,
}: IndoorDirectionsPanelProps) {
  return (
    <View style={panelStyles.container}>
      {/* Header */}
      <View style={panelStyles.header}>
        <View style={panelStyles.headerText}>
          <Text style={panelStyles.title} numberOfLines={1}>
            {route.origin.label} → {route.destination.label}
          </Text>
          <Text style={panelStyles.subtitle}>
            {formatTime(route.estimatedSeconds)} walk
            {!route.fullyAccessible
              ? " · some inaccessible sections"
              : " · fully accessible"}
          </Text>
        </View>
        {onClose && (
          <Pressable
            onPress={onClose}
            style={panelStyles.closeButton}
            hitSlop={8}
          >
            <Text style={panelStyles.closeText}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Steps */}
      <ScrollView
        style={panelStyles.list}
        contentContainerStyle={panelStyles.listContent}
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
    <View style={[panelStyles.row, isTransition && panelStyles.rowTransition]}>
      <View style={panelStyles.iconWrapper}>
        <Text style={panelStyles.icon}>{icon}</Text>
      </View>
      <View style={panelStyles.rowContent}>
        <Text style={panelStyles.stepNumber}>Step {index + 1}</Text>
        <Text style={panelStyles.stepText}>{segment.description}</Text>
        {segment.kind === "walk" && segment.distance > 0 && (
          <Text style={panelStyles.stepMeta}>
            Floor {segment.floor} · ~{Math.round(segment.distance / 10)}m
          </Text>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyles = StyleSheet.create({
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: 320,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 2,
  },
  closeButton: {
    marginLeft: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "600",
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowTransition: {
    backgroundColor: "#eff6ff",
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  icon: {
    fontSize: 15,
  },
  rowContent: {
    flex: 1,
  },
  stepNumber: {
    fontSize: 10,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stepText: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 20,
  },
  stepMeta: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },
});
