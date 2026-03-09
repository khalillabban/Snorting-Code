import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import ScheduleCalendar from "../components/ScheduleCalendar";
import { SEMESTER_END, SEMESTER_START } from "../constants/semesterConfig";
import { colors, spacing, typography } from "../constants/theme";
import { SCHEDULE_ITEMS, ScheduleItem } from "../constants/type";
import {
  getNextClass,
  loadCachedSchedule,
  parseCourseEvents,
  saveSchedule,
} from "../utils/parseCourseEvents";

import { useGoogleCalendarAuth } from "../services/GoogleAuthService";
import {
  fetchCalendarEventsInRange,
  fetchCalendarList,
  type GoogleCalendarEvent,
  type GoogleCalendarListItem,
} from "../services/GoogleCalendarService";
import {
  clearSelectedCalendarIds,
  getSelectedCalendarIds,
  saveSelectedCalendarIds,
} from "../services/SelectedCalendarsStore";
import {
  deleteGoogleAccessToken,
  getGoogleAccessToken,
  isTokenLikelyExpired,
  saveGoogleAccessToken,
} from "../services/TokenStore";

type UiState =
  | { status: "idle" }
  | { status: "connecting" }
  | { status: "loading" }
  | { status: "ready"; items: ScheduleItem[] }
  | { status: "error"; message: string }
  | { status: "empty" };

function getSemesterRange(): { start: Date; end: Date } {
  return { start: SEMESTER_START, end: SEMESTER_END };
}

export default function ScheduleScreen() {
  const { request, promptAsync, getResultFromResponse, response } =
    useGoogleCalendarAuth({ useProxy: false });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ui, setUi] = useState<UiState>({ status: "idle" });
  const [availableCalendars, setAvailableCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);

  const { start, end } = useMemo(() => getSemesterRange(), []);

  useEffect(() => {
    const handleURL = ({ url }: { url: string }) => {
      if (url.includes("oauthredirect")) {
        WebBrowser.maybeCompleteAuthSession();
      }
    };

    const subscription = Linking.addEventListener("url", handleURL);

    Linking.getInitialURL().then((url) => {
      if (url?.includes("oauthredirect")) {
        WebBrowser.maybeCompleteAuthSession();
      }
    });

    return () => subscription.remove();
  }, []);

  // Load a saved token on first mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await loadCachedSchedule();
        if (cached && !cancelled) {
          setUi({ status: "ready", items: cached });
        }
        const saved = await getGoogleAccessToken();
        if (cancelled) return;
        if (saved.accessToken) {
          if (isTokenLikelyExpired(saved.meta)) {
            await deleteGoogleAccessToken();
            setAccessToken(null);
            setUi({ status: "idle" });
            return;
          }
          setAccessToken(saved.accessToken);
        }

        const savedCalendarIds = await getSelectedCalendarIds();
        if (!cancelled) {
          setSelectedCalendarIds(savedCalendarIds);
        }
      } catch (error) {
        if (cancelled) return;
        if (__DEV__) console.error("Schedule init failed:", error);
        setUi({
          status: "error",
          message:
            error instanceof Error ? error.message : "Failed to load schedule",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When OAuth response arrives, extract token + store it
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

    saveGoogleAccessToken(res.accessToken, {
      issuedAt: res.issuedAt,
      expiresIn: res.expiresIn,
    }).catch(() => {});
  }, [response, getResultFromResponse]);

  const connect = useCallback(async () => {
    try {
      setUi({ status: "connecting" });
      await promptAsync();
    } catch (e: any) {
      setUi({
        status: "error",
        message: e?.message ?? "Could not start login.",
      });
    }
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    try {
      await deleteGoogleAccessToken();
      await AsyncStorage.removeItem(SCHEDULE_ITEMS);
      await clearSelectedCalendarIds();
    } finally {
      setAccessToken(null);
      setAvailableCalendars([]);
      setSelectedCalendarIds([]);
      setUi({ status: "idle" });
    }
  }, []);

  const loadCalendars = useCallback(
    async (token: string) => {
      try {
        const calendars = await fetchCalendarList(token);
        setAvailableCalendars(calendars);

        if (calendars.length > 0 && selectedCalendarIds.length === 0) {
          const defaultIds = calendars
            .filter((calendar) => calendar.primary)
            .map((calendar) => calendar.id);

          const idsToUse = defaultIds.length > 0 ? defaultIds : [calendars[0].id];

          setSelectedCalendarIds(idsToUse);
          await saveSelectedCalendarIds(idsToUse);
        }
      } catch (e) {
        if (__DEV__) console.error("Failed to load calendars:", e);
      }
    },
    [selectedCalendarIds],
  );

  const loadSchedule = useCallback(
    async (token: string) => {
      try {
        setUi({ status: "loading" });

        if (selectedCalendarIds.length === 0) {
          await saveSchedule([]);
          setUi({ status: "empty" });
          return;
        }

        const calendarIdsToUse = selectedCalendarIds;

        const rawEventGroups = await Promise.all(
          calendarIdsToUse.map((calendarId) =>
            fetchCalendarEventsInRange({
              accessToken: token,
              timeMin: start,
              timeMax: end,
              calendarId,
            }),
          ),
        );

        const rawEvents: GoogleCalendarEvent[] = rawEventGroups.flat();

        const uniqueEvents = rawEvents.filter(
          (event, index, self) =>
            index ===
            self.findIndex(
              (candidate) =>
                candidate.id === event.id &&
                candidate.start?.dateTime === event.start?.dateTime,
            ),
        );

        const academicRegex = /\b(LEC|TUT|LAB)\b/i;
        const filteredEvents = uniqueEvents.filter((event) => {
          const summary = event.summary || "";

          if (academicRegex.test(summary)) return true;

          if (event.organizer?.email) return true;

          return false;
        });

        const items = parseCourseEvents(filteredEvents);
        //The save in the storage
        await saveSchedule(items);

        //Test to see if I can collect my next class for the dev
        const next = await getNextClass();
        if (__DEV__) {
          console.log("=== Next Class ===");
          console.log("Course:  ", next?.courseName);
          console.log("Start:   ", next?.start);
          console.log("Campus:  ", next?.campus);
          console.log("Building:", next?.building);
          console.log("Room:    ", next?.room);
          console.log("Level:    ", next?.level);
        }

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
    },
    [start, end, selectedCalendarIds],
  );

  // Load calendars whenever we get a new token
  useEffect(() => {
    if (!accessToken) return;
    loadCalendars(accessToken);
  }, [accessToken, loadCalendars]);

  // Load schedule whenever we get a new token
  useEffect(() => {
    if (!accessToken) return;
    loadSchedule(accessToken);
  }, [accessToken, loadSchedule]);

  const toggleCalendarSelection = useCallback(
    async (calendarId: string) => {
      const nextSelected = selectedCalendarIds.includes(calendarId)
        ? selectedCalendarIds.filter((id) => id !== calendarId)
        : [...selectedCalendarIds, calendarId];

      setSelectedCalendarIds(nextSelected);
      await saveSelectedCalendarIds(nextSelected);
    },
    [selectedCalendarIds],
  );

  const header = (
    <View style={{ padding: spacing.lg, paddingBottom: spacing.md }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <Text style={{ ...typography.title, color: colors.primaryDark }}>
          My Schedule
        </Text>
        {accessToken || ui.status === "ready" ? (
          <Pressable
            onPress={disconnect}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.primaryDark,
            }}
          >
            <Text style={{ ...typography.button, color: colors.primaryDark }}>
              Disconnect
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ marginTop: 6, color: colors.gray700 }}>
        Showing events from {start.toLocaleDateString()} to{" "}
        {end.toLocaleDateString()}
      </Text>
      {availableCalendars.length > 0 ? (
        <View style={{ marginTop: spacing.md, gap: 8 }}>
          <Text style={{ color: colors.primaryDark, fontWeight: "600" }}>
            Selected Calendars
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {availableCalendars.map((calendar) => {
              const selected = selectedCalendarIds.includes(calendar.id);

              return (
                <Pressable
                  key={calendar.id}
                  onPress={() => toggleCalendarSelection(calendar.id)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.primaryDark : colors.gray300,
                    backgroundColor: selected ? colors.primaryDark : colors.white,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.white : colors.primaryDark,
                    }}
                  >
                    {calendar.summary}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );

  if (ui.status === "idle" || ui.status === "connecting") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.white }}>
        {header}
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.gray700 }}>
            Connect Google Calendar to import your course schedule (exported
            from Concordia Schedule Builder).
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
            onPress={() =>
              accessToken ? loadSchedule(accessToken) : connect()
            }
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
          {accessToken ? (
            <Pressable
              onPress={disconnect}
              style={{
                marginTop: 8,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.primaryDark,
              }}
            >
              <Text style={{ ...typography.button, color: colors.primaryDark }}>
                Disconnect
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      {header}
      <ScheduleCalendar items={ui.items} />
    </View>
  );
}