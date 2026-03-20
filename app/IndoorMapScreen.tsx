import {
  findIndoorPath,
  getFloorGraphData,
  getRoomsForFloor,
  type FloorGraphData,
  type GraphNode,
} from "@/utils/IndoorNavigationGraph";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { styles } from "../styles/IndoorMapScreen.styles";
import { getFloorPlanAsset } from "../utils/indoorMapAssets";
import { parseFloors } from "../utils/routeParams";

// ─── Room Picker Modal ────────────────────────────────────────────────────────
const FLOOR_PLAN_WIDTH = 1000; // adjust to your actual image pixel width
const FLOOR_PLAN_HEIGHT = 1000; // adjust to your actual image pixel height

type RoomPickerProps = {
  visible: boolean;
  title: string;
  rooms: GraphNode[];
  onSelect: (room: GraphNode) => void;
  onClose: () => void;
};

function RoomPickerModal({
  visible,
  title,
  rooms,
  onSelect,
  onClose,
}: RoomPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>{title}</Text>
            <Pressable onPress={onClose} style={pickerStyles.closeBtn}>
              <Text style={pickerStyles.closeText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ flex: 1 }}>
            {rooms.map((room) => (
              <Pressable
                key={room.id}
                style={pickerStyles.roomRow}
                onPress={() => {
                  onSelect(room);
                  onClose();
                }}
              >
                <Text style={pickerStyles.roomLabel}>{room.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Nav Panel ────────────────────────────────────────────────────────────────

type NavPanelProps = {
  buildingName: string;
  selectedFloor: number;
  onPathFound: (path: string[]) => void;
  onClear: () => void;
};
function findNearestWaypoint(
  graphData: FloorGraphData,
  room: GraphNode,
): GraphNode | null {
  const waypoints = graphData.nodes.filter(
    (n) => n.floor === room.floor && n.type !== "room",
  );
  if (waypoints.length === 0) return null;

  let nearest: GraphNode | null = null;
  let minDist = Infinity;

  for (const wp of waypoints) {
    const d = Math.hypot(wp.x - room.x, wp.y - room.y);
    if (d < minDist) {
      minDist = d;
      nearest = wp;
    }
  }
  return nearest;
}
function NavPanel({
  buildingName,
  selectedFloor,
  onPathFound,
  onClear,
}: NavPanelProps) {
  const graphData = useMemo(
    () => getFloorGraphData(buildingName),
    [buildingName],
  );

  const rooms = useMemo(() => {
    if (!graphData) return [];
    return getRoomsForFloor(graphData, selectedFloor);
  }, [graphData, selectedFloor]);

  const roomEdges = graphData?.edges.filter(
    (e) => e.source.includes("room") || e.target.includes("room"),
  );
  const roomEdgeDetail = graphData?.edges.filter(
    (e) => e.source.includes("room") || e.target.includes("room"),
  );
  console.log("[Nav] room edge detail:", JSON.stringify(roomEdgeDetail));

  console.log("[Nav] edges touching rooms:", roomEdges?.length);
  // ADD HERE
  console.log("[NavPanel] buildingName:", buildingName);
  console.log("[NavPanel] graphData found:", !!graphData);
  console.log("[NavPanel] floors in graph:", [
    ...new Set(graphData?.nodes.map((n) => n.floor)),
  ]);
  console.log("[NavPanel] selectedFloor:", selectedFloor);
  console.log("[NavPanel] rooms found:", rooms.length);

  const [startRoom, setStartRoom] = useState<GraphNode | null>(null);
  const [endRoom, setEndRoom] = useState<GraphNode | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"start" | "end" | null>(
    null,
  );
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear when floor changes
  useEffect(() => {
    setStartRoom(null);
    setEndRoom(null);
    onClear();
    setError(null);
  }, [selectedFloor]);

  const handleGo = () => {
    if (!graphData || !startRoom || !endRoom) return;

    // Snap to nearest connector IN THE SAME BUILDING
    const getSnapNode = (room: GraphNode): GraphNode => {
      const connectors = graphData.nodes.filter(
        (n) => n.floor === room.floor && n.type !== "room"
      );
      if (connectors.length === 0) return room;
      return connectors.reduce((best, n) => {
        const d = Math.hypot(n.x - room.x, n.y - room.y);
        const bd = Math.hypot(best.x - room.x, best.y - room.y);
        return d < bd ? n : best;
      }, connectors[0]);
    };

    const startNode = getSnapNode(startRoom);
    const endNode = getSnapNode(endRoom);

    console.log("[Nav] snapped start:", startNode.id);
    console.log("[Nav] snapped end:", endNode.id);

    const path = findIndoorPath(
      graphData,
      startNode.id,
      endNode.id,
      accessibleOnly,
    );

    if (path.length === 0) {
      setError("No path found between these rooms.");
      onClear();
    } else {
      setError(null);
      // Prepend/append actual room nodes for start/end dots
      onPathFound([startRoom.id, ...path, endRoom.id]);
    }
  };

  const handleClear = () => {
    setStartRoom(null);
    setEndRoom(null);
    setError(null);
    onClear();
  };

  if (!graphData || rooms.length === 0) {
    return (
      <View style={navStyles.container}>
        <Text style={navStyles.noNav}>No navigation data for this floor.</Text>
      </View>
    );
  }

  return (
    <View style={navStyles.container}>
      <View style={navStyles.row}>
        {/* From */}
        <Pressable
          style={navStyles.roomPicker}
          onPress={() => setPickerTarget("start")}
        >
          <Text style={navStyles.pickerLabel}>FROM</Text>
          <Text
            style={[navStyles.pickerValue, !startRoom && navStyles.placeholder]}
            numberOfLines={1}
          >
            {startRoom ? startRoom.label : "Select room…"}
          </Text>
        </Pressable>

        <Text style={navStyles.arrow}>→</Text>

        {/* To */}
        <Pressable
          style={navStyles.roomPicker}
          onPress={() => setPickerTarget("end")}
        >
          <Text style={navStyles.pickerLabel}>TO</Text>
          <Text
            style={[navStyles.pickerValue, !endRoom && navStyles.placeholder]}
            numberOfLines={1}
          >
            {endRoom ? endRoom.label : "Select room…"}
          </Text>
        </Pressable>
      </View>

      <View style={navStyles.controls}>
        {/* Accessible toggle */}
        <Pressable
          style={[
            navStyles.accessBtn,
            accessibleOnly && navStyles.accessBtnActive,
          ]}
          onPress={() => setAccessibleOnly((v) => !v)}
        >
          <Text style={navStyles.accessText}>♿</Text>
        </Pressable>

        {/* Go */}
        <Pressable
          style={[
            navStyles.goBtn,
            !(startRoom && endRoom) && navStyles.goBtnDisabled,
          ]}
          onPress={handleGo}
          disabled={!(startRoom && endRoom)}
        >
          <Text style={navStyles.goText}>Go</Text>
        </Pressable>

        {/* Clear */}
        <Pressable style={navStyles.clearBtn} onPress={handleClear}>
          <Text style={navStyles.clearText}>Clear</Text>
        </Pressable>
      </View>

      {error && <Text style={navStyles.error}>{error}</Text>}

      {/* Pickers */}
      <RoomPickerModal
        visible={pickerTarget === "start"}
        title="Select Start Room"
        rooms={rooms}
        onSelect={setStartRoom}
        onClose={() => setPickerTarget(null)}
      />
      <RoomPickerModal
        visible={pickerTarget === "end"}
        title="Select End Room"
        rooms={rooms}
        onSelect={setEndRoom}
        onClose={() => setPickerTarget(null)}
      />
    </View>
  );
}

// ─── Path Overlay (SVG-like dots on the image) ────────────────────────────────

type PathOverlayProps = {
  path: string[];
  buildingName: string;
  selectedFloor: number;
  imageWidth: number;
  imageHeight: number;
};

function PathOverlay({
  path,
  buildingName,
  selectedFloor,
  imageWidth,
  imageHeight,
}: PathOverlayProps) {
  const graphData = useMemo(
    () => getFloorGraphData(buildingName),
    [buildingName],
  );

  if (!graphData || path.length < 2 || imageWidth === 0) return null;

  const nodeMap: Record<string, GraphNode> = {};
  for (const n of graphData.nodes) nodeMap[n.id] = n;

  const nodes = path.map((id) => nodeMap[id]).filter(Boolean) as GraphNode[];

  // Build SVG polyline points string
  const points = nodes
    .map(
      (n) =>
        `${(n.x / FLOOR_PLAN_WIDTH) * imageWidth},${(n.y / FLOOR_PLAN_HEIGHT) * imageHeight}`,
    )
    .join(" ");
  console.log("[PathOverlay] imageSize:", imageWidth, imageHeight);
  console.log("[PathOverlay] first node:", nodes[0]?.x, nodes[0]?.y);

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: imageWidth,
        height: imageHeight,
        pointerEvents: "none",
      }}
    >
      {/* We use a simple SVG-like approach with absolute View lines */}
      {nodes.slice(0, -1).map((node, i) => {
        const next = nodes[i + 1];
        const x1 = (node.x / FLOOR_PLAN_WIDTH) * imageWidth;
        const y1 = (node.y / FLOOR_PLAN_HEIGHT) * imageHeight;
        const x2 = (next.x / FLOOR_PLAN_WIDTH) * imageWidth;
        const y2 = (next.y / FLOOR_PLAN_HEIGHT) * imageHeight;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        return (
          <View
            key={`seg-${i}`}
            style={{
              position: "absolute",
              left: midX - length / 2,
              top: midY - 2,
              width: length,
              height: 4,
              backgroundColor: "#1E90FF",
              borderRadius: 2,
              opacity: 0.85,
              transform: [{ rotate: `${angle}deg` }],
            }}
          />
        );
      })}

      {/* Start dot (green) */}
      {nodes[0] && (
        <View
          style={{
            position: "absolute",
            left: (nodes[0].x / FLOOR_PLAN_WIDTH) * imageWidth - 8,
            top: (nodes[0].y / FLOOR_PLAN_HEIGHT) * imageHeight - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: "#22c55e",
            borderWidth: 2,
            borderColor: "white",
          }}
        />
      )}

      {/* End dot (red) */}
      {nodes[nodes.length - 1] && (() => {
        const last = nodes[nodes.length - 1];
        return (
          <View
            style={{
              position: "absolute",
              left: (last.x / FLOOR_PLAN_WIDTH) * imageWidth - 8,
              top: (last.y / FLOOR_PLAN_HEIGHT) * imageHeight - 8,
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: "#ef4444",
              borderWidth: 2,
              borderColor: "white",
            }}
          />
        );
      })()}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function IndoorMapScreen() {
  const { buildingName, floors } = useLocalSearchParams<{
    buildingName: string;
    floors: string;
  }>();
  const availableFloors = parseFloors(floors);
  const [selectedFloor, setSelectedFloor] = useState(availableFloors[0] || 1);
  const [navPath, setNavPath] = useState<string[]>([]);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!availableFloors.includes(selectedFloor)) {
      setSelectedFloor(availableFloors[0] || 1);
    }
  }, [availableFloors]);

  const floorImage = getFloorPlanAsset(buildingName, selectedFloor);

  const MIN_SCALE = 1;
  const MAX_SCALE = 5;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏛️ Inside {buildingName} Building</Text>
      </View>

      <View style={styles.floorSelectorWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.floorSelector}
        >
          {availableFloors.map((floor: number) => (
            <Pressable
              key={floor}
              onPress={() => setSelectedFloor(floor)}
              style={[
                styles.floorButton,
                selectedFloor === floor && styles.floorButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.floorButtonText,
                  selectedFloor === floor && styles.floorButtonTextActive,
                ]}
              >
                {floor}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Navigation panel */}
      <NavPanel
        buildingName={buildingName}
        selectedFloor={selectedFloor}
        onPathFound={setNavPath}
        onClear={() => setNavPath([])}
      />

      <View style={styles.mapContainer}>
        {floorImage ? (
          <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={pinchGesture}>
              <Animated.View style={[{ flex: 1 }, animatedStyle]}>
                <ScrollView
                  contentContainerStyle={styles.scrollContent}
                  showsHorizontalScrollIndicator={false}
                  showsVerticalScrollIndicator={false}
                >
                  <View>
                    <Image
                      source={floorImage}
                      style={styles.mapImage}
                      resizeMode="contain"
                      onLayout={(e) => {
                        const { width, height } = e.nativeEvent.layout;
                        setImageSize({ width, height });
                      }}
                    />
                    {navPath.length > 0 && (
                      <PathOverlay
                        path={navPath}
                        buildingName={buildingName}
                        selectedFloor={selectedFloor}
                        imageWidth={imageSize.width}
                        imageHeight={imageSize.height}
                      />
                    )}
                  </View>
                </ScrollView>
              </Animated.View>
            </GestureDetector>
          </GestureHandlerRootView>
        ) : (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <Text>
              No map available for {`${buildingName}-${selectedFloor}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Nav Panel Styles ─────────────────────────────────────────────────────────

import { StyleSheet } from "react-native";

const navStyles = StyleSheet.create({
  container: {
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roomPicker: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pickerLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 1,
    marginBottom: 2,
  },
  pickerValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  placeholder: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  arrow: {
    fontSize: 18,
    color: "#64748b",
  },
  controls: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  accessBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  accessBtnActive: {
    backgroundColor: "#22c55e",
    borderColor: "#16a34a",
  },
  accessText: {
    fontSize: 18,
  },
  goBtn: {
    flex: 1,
    backgroundColor: "#1E90FF",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  goBtnDisabled: {
    backgroundColor: "#93c5fd",
  },
  goText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  clearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
  },
  clearText: {
    color: "#64748b",
    fontWeight: "600",
    fontSize: 13,
  },
  error: {
    color: "#ef4444",
    fontSize: 12,
    textAlign: "center",
  },
  noNav: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 4,
  },
});

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "60%",
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "600",
  },
  roomRow: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  roomLabel: {
    fontSize: 15,
    color: "#1e293b",
  },
});
