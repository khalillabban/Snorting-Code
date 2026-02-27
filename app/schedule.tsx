// app/schedule.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import ScheduleCalendar from "../components/ScheduleCalendar";
import { colors, spacing, typography } from "../constants/theme";
import { useGoogleCalendarAuth } from "../services/GoogleAuthService";
import { fetchCalendarEventsInRange } from "../services/GoogleCalendarService";
import { parseCourseEvents, type ScheduleItem } from "../utils/parseCourseEvents";

type UiState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "loading" }
  | { status: "ready"; items: ScheduleItem[] }
  | { status: "error"; message: string }
  | { status: "empty" };

function getSemesterRange(): { start: Date; end: Date } {
  // ✅ Adjust these two dates to your actual semester.
  // Example: Winter term (Jan 6 → Apr 30)
  const start = new Date("2026-01-06T00:00:00");
  const end = new Date("2026-04-30T23:59:59");
  return { start, end };
}

export default function ScheduleScreen() {
  const { request, promptAsync, getResultFromResponse, response } =
    useGoogleCalendarAuth();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ui, setUi] = useState<UiState>({ status: "idle" });

  const { start, end } = useMemo(() => getSemesterRange(), []);

  // When OAuth response arrives, extract the token
  useEffect(() => {
    const res = getResultFromResponse();
    if (!res) return;

    if (!res.ok) {
      if (res.reason === "cancelled") {
        setUi({ status: "idle" });
        return;
      }
      setUi({ status: "error", message: res.message ?? "Login failed." });
      return;
    }

    setAccessToken(res.accessToken);
  }, [response, getResultFromResponse]);

  const connect = async () => {
    try {
      setUi({ status: "connecting" });
      // Expo Go friendly
      await promptAsync();
    } catch (e: any) {
      setUi({ status: "error", message: e?.message ?? "Could not start login." });
    }
  };

  const loadSchedule = async (token: string) => {
    try {
      setUi({ status: "loading" });

      const rawEvents = await fetchCalendarEventsInRange({
        accessToken: token,
        timeMin: start,
        timeMax: end,
      });

      const items = parseCourseEvents(rawEvents);

      if (items.length === 0) {
        setUi({ status: "empty" });
        return;
      }

      setUi({ status: "ready", items });
    } catch (e: any) {
      setUi({
        status: "error",
        message: e?.message ?? "Failed to load your schedule.",
      });
    }
  };

  // Load schedule whenever we get a new token
  useEffect(() => {
    if (!accessToken) return;
    loadSchedule(accessToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const header = (
    <View style={{ padding: spacing.lg, paddingBottom: spacing.md }}>
      <Text style={{ ...typography.title, color: colors.primaryDark }}>
        My Schedule
      </Text>
      <Text style={{ marginTop: 6, color: colors.gray700 }}>
        Showing events from {start.toLocaleDateString()} to{" "}
        {end.toLocaleDateString()}
      </Text>
    </View>
  );

  if (ui.status === "idle" || ui.status === "connecting") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        {header}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.gray700 }}>
            Connect Google Calendar to import your course schedule (exported from
            Concordia Schedule Builder).
          </Text>

          <Pressable
            disabled={!request || ui.status === "connecting"}
            onPress={connect}
            style={{
              backgroundColor: colors.primaryDark,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
              opacity: !request || ui.status === "connecting" ? 0.7 : 1,
            }}
          >
            <Text style={{ ...typography.button, color: colors.white }}>
              {ui.status === "connecting"
                ? "Connecting…"
                : "Connect Google Calendar"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (ui.status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        {header}
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: colors.gray700 }}>Loading your schedule…</Text>
        </View>
      </View>
    );
  }

  if (ui.status === "empty") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        {header}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.gray700 }}>
            No events found in this semester window.
          </Text>
          <Text style={{ color: colors.gray700 }}>
            Make sure you exported your Concordia schedule to Google Calendar.
          </Text>

          <Pressable
            onPress={() => accessToken && loadSchedule(accessToken)}
            style={{
              backgroundColor: colors.primaryDark,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ ...typography.button, color: colors.white }}>
              Refresh
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (ui.status === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        {header}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.error }}>{ui.message}</Text>

          <Pressable
            onPress={() => (accessToken ? loadSchedule(accessToken) : connect())}
            style={{
              backgroundColor: colors.primaryDark,
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ ...typography.button, color: colors.white }}>
              {accessToken ? "Try Again" : "Connect Google Calendar"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ready
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      {header}
      <ScheduleCalendar items={ui.items} />
    </View>
  );
}