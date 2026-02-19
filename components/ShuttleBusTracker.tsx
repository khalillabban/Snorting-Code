import axios from "axios";
import React, { useEffect, useState } from "react";
import { colors } from "../constants/theme";

import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { BUSSTOP } from "../constants/shuttle";

export interface BusPoint {
  ID: string;
  Latitude: number;
  Longitude: number;
}

export interface BusDataResponse {
  d: {
    Points: BusPoint[];
  };
}

export function useShuttleBus() {
  const [activeBuses, setActiveBuses] = useState<BusPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchBusData = async () => {
      try {
        // Step 1: GET to establish session cookies
        await axios.get(
          "https://shuttle.concordia.ca/concordiabusmap/Map.aspx",
          {
            headers: { Host: "shuttle.concordia.ca" },
          },
        );

        // Step 2: POST with the session now established
        const response = await axios.post<BusDataResponse>(
          "https://shuttle.concordia.ca/concordiabusmap/WebService/GService.asmx/GetGoogleObject",
          {},
          {
            headers: {
              Host: "shuttle.concordia.ca",
              "Content-Length": "0",
              "Content-Type": "application/json; charset=UTF-8",
            },
          },
        );

        if (cancelled) return;

        const buses =
          response.data.d?.Points.filter((point) =>
            point.ID.startsWith("BUS"),
          ) || [];
        setActiveBuses(buses);
      } catch (err) {
        console.warn("Error fetching bus data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBusData();
    const interval = setInterval(fetchBusData, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { activeBuses, loading };
}

export const ShuttleBusTracker = () => {
  const { activeBuses, loading } = useShuttleBus();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* CAMPUS STOPS */}
      <Text style={styles.title}>Campus Stops</Text>
      {BUSSTOP.map((stop) => (
        <View key={stop.id} style={styles.card}>
          <Text style={styles.bold}>{stop.name}</Text>
          <Text style={styles.subtext}>{stop.address}</Text>
        </View>
      ))}

      <View style={{ height: 20 }} />

      {/* LIVE BUSES */}
      <Text style={styles.title}>Live Buses ({activeBuses.length})</Text>
      {activeBuses.length > 0 ? (
        activeBuses.map((bus) => (
          <View key={bus.ID} style={styles.busItem}>
            <Text>Bus ID: {bus.ID}</Text>
            <Text style={styles.coords}>
              Location: {bus.Latitude.toFixed(4)}, {bus.Longitude.toFixed(4)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={styles.emptyText}>No buses currently in service.</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  card: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
  },
  bold: { fontWeight: "bold" },
  subtext: { fontSize: 12, color: "#555" },
  busItem: { padding: 10, borderBottomWidth: 1, borderColor: "#ccc" },
  coords: { fontSize: 10, color: "#888" },
  emptyText: { fontStyle: "italic", color: "#999", marginTop: 10 },
});

export default ShuttleBusTracker;
