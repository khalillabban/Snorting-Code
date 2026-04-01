import { getSessionId } from "@/constants/usabilityConfig";
import { logUsabilityEvent } from "@/utils/usabilityAnalytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Pressable, Text, View } from "react-native";
import ScheduleCalendar from "../components/ScheduleCalendar";
import { SEMESTER_END, SEMESTER_START } from "../constants/semesterConfig";
import { colors, spacing, typography } from "../constants/theme";
import { SCHEDULE_ITEMS, ScheduleItem } from "../constants/type";
import { useGoogleCalendarAuth } from "../services/GoogleAuthService";
import {
  clearCachedGoogleCalendarEvents,
  clearGoogleCalendarCache,
  filterVisibleCachedCalendars,
  isGoogleCalendarEventsCacheStale,
  isGoogleCalendarListCacheStale,
  loadCachedGoogleCalendarEvents,
  loadCachedGoogleCalendarEventsForIds,
  loadCachedGoogleCalendarList,
  mergeCachedCalendarEvents,
  mergeCachedCalendarListItems,
  saveCachedGoogleCalendarEvents,
  saveCachedGoogleCalendarList,
} from "../services/GoogleCalendarCacheStore";
import {
  GoogleCalendarApiError,
  GoogleCalendarEvent,
  GoogleCalendarListItem,
  syncCalendarEvents,
  syncCalendarList,
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
import {
  getNextClass,
  loadCachedSchedule,
  parseCourseEvents,
  saveSchedule,
} from "../utils/parseCourseEvents";

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

export function parseCalendarDate(value?: {
  date?: string;
  dateTime?: string;
}): Date | null {
  const raw = value?.dateTime ?? value?.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function eventOverlapsRange(
  event: GoogleCalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const start = parseCalendarDate(event.start);
  if (!start) return false;
  const end = parseCalendarDate(event.end) ?? start;
  return end > rangeStart && start < rangeEnd;
}

export function getEventDedupKey(event: GoogleCalendarEvent): string | null {
  if (!event.id) return null;
  const occurrenceKey =
    event.originalStartTime?.dateTime ??
    event.originalStartTime?.date ??
    event.start?.dateTime ??
    event.start?.date ??
    "";
  return occurrenceKey ? `${event.id}::${occurrenceKey}` : event.id;
}

export function buildScheduleItems(
  events: GoogleCalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): ScheduleItem[] {
  const deduped = new Map<string, GoogleCalendarEvent>();
  for (const event of events) {
    if (event.status === "cancelled") continue;
    if (!eventOverlapsRange(event, rangeStart, rangeEnd)) continue;
    const key = getEventDedupKey(event);
    if (!key) continue;
    deduped.set(key, event);
  }
  return parseCourseEvents(Array.from(deduped.values()));
}

export function getUiStateForItems(items: ScheduleItem[]): UiState {
  return items.length > 0 ? { status: "ready", items } : { status: "empty" };
}

export function pickDefaultCalendarIds(
  calendars: GoogleCalendarListItem[],
): string[] {
  if (calendars.length === 0) return [];
  const primaryIds = calendars.filter((c) => c.primary).map((c) => c.id);
  return primaryIds.length > 0 ? primaryIds : [calendars[0].id];
}

export function applyCachedSchedule(
  cancelledRef: { current: boolean },
  cachedSchedule: ScheduleItem[] | null,
  setUi: React.Dispatch<React.SetStateAction<UiState>>,
) {
  if (cancelledRef.current || !cachedSchedule) return;
  setUi(getUiStateForItems(cachedSchedule));
}

export async function resolveAccessToken(
  saved: Awaited<ReturnType<typeof getGoogleAccessToken>>,
): Promise<string | null> {
  if (!saved.accessToken || !isTokenLikelyExpired(saved.meta))
    return saved.accessToken;
  await deleteGoogleAccessToken();
  return null;
}

export async function loadCalendarsAndMaybeAutoSelect(
  cancelledRef: { current: boolean },
  accessToken: string | null,
  shouldAutoSelectDefaultRef: { current: boolean },
  setSelectedCalendarIds: React.Dispatch<React.SetStateAction<string[]>>,
  setAvailableCalendars: React.Dispatch<
    React.SetStateAction<GoogleCalendarListItem[]>
  >,
) {
  const savedCalendarIds = await getSelectedCalendarIds();
  if (cancelledRef.current) return;
  shouldAutoSelectDefaultRef.current = savedCalendarIds.length === 0;
  setSelectedCalendarIds(savedCalendarIds);

  const cachedCalendarList = await loadCachedGoogleCalendarList();
  if (cancelledRef.current) return;
  const visibleCalendars = filterVisibleCachedCalendars(
    cachedCalendarList?.items ?? [],
  );
  setAvailableCalendars(visibleCalendars);

  const shouldAutoSelect =
    accessToken &&
    shouldAutoSelectDefaultRef.current &&
    visibleCalendars.length > 0;
  if (!shouldAutoSelect) return;

  const defaultIds = pickDefaultCalendarIds(visibleCalendars);
  setSelectedCalendarIds(defaultIds);
  await saveSelectedCalendarIds(defaultIds);
  shouldAutoSelectDefaultRef.current = false;
}

export function setIdleIfNoData(
  accessToken: string | null,
  cachedSchedule: ScheduleItem[] | null,
  setUi: React.Dispatch<React.SetStateAction<UiState>>,
) {
  if (!accessToken && !cachedSchedule) setUi({ status: "idle" });
}

export function handleScheduleInitError(
  cancelledRef: { current: boolean },
  error: unknown,
  setUi: React.Dispatch<React.SetStateAction<UiState>>,
) {
  if (cancelledRef.current) return;
  if (__DEV__) console.error("Schedule init failed:", error);
  setUi({
    status: "error",
    message: error instanceof Error ? error.message : "Failed to load schedule",
  });
}

export default function ScheduleScreen() {
  const sessionId = useRef(getSessionId());

  const { request, promptAsync, getResultFromResponse, response } =
    useGoogleCalendarAuth({ useProxy: false });

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ui, setUi] = useState<UiState>({ status: "idle" });
  const [availableCalendars, setAvailableCalendars] = useState<
    GoogleCalendarListItem[]
  >([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);

  const { start, end } = useMemo(() => getSemesterRange(), []);
  const appStateRef = useRef(AppState.currentState);
  const accessTokenRef = useRef<string | null>(null);
  const selectedCalendarIdsRef = useRef<string[]>([]);
  const scheduleSyncRequestRef = useRef(0);
  const shouldAutoSelectDefaultRef = useRef(true);

  //  Usability Testing: Task 8 timers
  const scheduleScreenLoadTime = useRef<number>(Date.now());
  const connectStartTime = useRef<number | null>(null);
  useEffect(() => {
    scheduleScreenLoadTime.current = Date.now();
    const run = async () => {
      await logUsabilityEvent("schedule_screen_loaded", {
        session_id: sessionId.current,
        timestamp: new Date().toISOString(),
      });
    };
    run();
  }, []);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);
  useEffect(() => {
    selectedCalendarIdsRef.current = selectedCalendarIds;
  }, [selectedCalendarIds]);

  const applyItemsToUi = useCallback(async (items: ScheduleItem[]) => {
    await saveSchedule(items);
    setUi(getUiStateForItems(items));
  }, []);

  const loadItemsFromRawCache = useCallback(
    async (calendarIds: string[]) => {
      const cachedEntries =
        await loadCachedGoogleCalendarEventsForIds(calendarIds);
      const rawEvents = cachedEntries.flatMap((entry) => entry.events);
      const items = buildScheduleItems(rawEvents, start, end);
      return { cachedEntries, items };
    },
    [start, end],
  );

  const syncSingleCalendar = useCallback(
    async (token: string, calendarId: string, force = false) => {
      const cachedEntry = force
        ? null
        : await loadCachedGoogleCalendarEvents(calendarId);
      const useIncremental = !force && Boolean(cachedEntry?.syncToken);

      const runSync = async (syncToken?: string) => {
        const result = await syncCalendarEvents({
          accessToken: token,
          calendarId,
          syncToken,
        });
        const nextEvents = syncToken
          ? mergeCachedCalendarEvents(
              cachedEntry?.events ?? [],
              result.items,
              calendarId,
            )
          : mergeCachedCalendarEvents([], result.items, calendarId);
        await saveCachedGoogleCalendarEvents({
          calendarId,
          events: nextEvents,
          lastSyncedAt: Date.now(),
          syncToken: result.nextSyncToken,
          windowStart: start.toISOString(),
          windowEnd: end.toISOString(),
        });
      };

      try {
        await runSync(
          useIncremental ? (cachedEntry?.syncToken ?? undefined) : undefined,
        );
      } catch (error) {
        if (
          error instanceof GoogleCalendarApiError &&
          error.status === 410 &&
          !force
        ) {
          await clearCachedGoogleCalendarEvents(calendarId);
          await runSync();
          return;
        }
        throw error;
      }
    },
    [start, end],
  );

  const loadAndDisplayCache = useCallback(
    async (calendarIds: string[], background: boolean) => {
      const result = await loadItemsFromRawCache(calendarIds);
      if (!background && result.cachedEntries.length > 0) {
        await applyItemsToUi(result.items);
      } else if (!background) {
        setUi({ status: "loading" });
      }
      return result;
    },
    [loadItemsFromRawCache, applyItemsToUi],
  );

  const getCalendarIdsToSync = useCallback(
    (
      calendarIds: string[],
      cachedEntries: Awaited<
        ReturnType<typeof loadItemsFromRawCache>
      >["cachedEntries"],
      force: boolean,
    ) => {
      if (force) return calendarIds;
      const cachedEntryMap = new Map(
        cachedEntries.map((entry) => [entry.calendarId, entry] as const),
      );
      return calendarIds.filter((calendarId) => {
        const entry = cachedEntryMap.get(calendarId) ?? null;
        return !entry?.syncToken || isGoogleCalendarEventsCacheStale(entry);
      });
    },
    [],
  );

  const syncAndRefresh = useCallback(
    async (
      token: string,
      calendarIds: string[],
      calendarIdsToSync: string[],
      force: boolean,
      requestId: number,
    ) => {
      await Promise.all(
        calendarIdsToSync.map((calendarId) =>
          syncSingleCalendar(token, calendarId, force),
        ),
      );
      if (scheduleSyncRequestRef.current !== requestId) return;

      const refreshed = await loadItemsFromRawCache(calendarIds);
      if (scheduleSyncRequestRef.current !== requestId) return;

      await applyItemsToUi(refreshed.items);

      if (__DEV__) {
        const next = await getNextClass();
        console.log("=== Next Class ===");
        console.log("Course:  ", next?.courseName);
        console.log("Start:   ", next?.start);
        console.log("Campus:  ", next?.campus);
        console.log("Building:", next?.building);
        console.log("Room:    ", next?.room);
        console.log("Level:   ", next?.level);
      }
    },
    [syncSingleCalendar, loadItemsFromRawCache, applyItemsToUi],
  );

  const syncScheduleForSelection = useCallback(
    async (
      token: string,
      calendarIds: string[],
      options?: { force?: boolean; background?: boolean },
    ) => {
      const force = options?.force ?? false;
      const background = options?.background ?? false;
      const requestId = ++scheduleSyncRequestRef.current;

      if (calendarIds.length === 0) {
        await applyItemsToUi([]);
        return;
      }

      const { cachedEntries, items: cachedItems } = await loadAndDisplayCache(
        calendarIds,
        background,
      );
      if (scheduleSyncRequestRef.current !== requestId) return;

      const calendarIdsToSync = getCalendarIdsToSync(
        calendarIds,
        cachedEntries,
        force,
      );

      if (calendarIdsToSync.length === 0) {
        if (background && cachedEntries.length > 0)
          await applyItemsToUi(cachedItems);
        return;
      }

      try {
        await syncAndRefresh(
          token,
          calendarIds,
          calendarIdsToSync,
          force,
          requestId,
        );
      } catch (error: any) {
        if (scheduleSyncRequestRef.current !== requestId) return;
        if (cachedEntries.length > 0) {
          if (__DEV__) console.error("Failed to refresh schedule:", error);
          return;
        }
        setUi({
          status: "error",
          message: error?.message ?? "Failed to load your schedule.",
        });
      }
    },
    [applyItemsToUi, loadAndDisplayCache, getCalendarIdsToSync, syncAndRefresh],
  );

  const applyCalendarSelection = useCallback(
    async (calendars: GoogleCalendarListItem[]) => {
      const visibleCalendars = filterVisibleCachedCalendars(calendars);
      setAvailableCalendars(visibleCalendars);

      const validSelected = selectedCalendarIdsRef.current.filter((id) =>
        visibleCalendars.some((c) => c.id === id),
      );

      if (validSelected.length !== selectedCalendarIdsRef.current.length) {
        setSelectedCalendarIds(validSelected);
        await saveSelectedCalendarIds(validSelected);
        return;
      }

      if (
        shouldAutoSelectDefaultRef.current &&
        validSelected.length === 0 &&
        visibleCalendars.length > 0
      ) {
        const defaultIds = pickDefaultCalendarIds(visibleCalendars);
        setSelectedCalendarIds(defaultIds);
        await saveSelectedCalendarIds(defaultIds);
        shouldAutoSelectDefaultRef.current = false;
      }
    },
    [],
  );

  const syncCalendarListData = useCallback(
    async (token: string, force = false) => {
      const cachedList = await loadCachedGoogleCalendarList();
      if (cachedList)
        setAvailableCalendars(filterVisibleCachedCalendars(cachedList.items));

      const shouldSync =
        force ||
        !cachedList?.syncToken ||
        isGoogleCalendarListCacheStale(cachedList);
      if (!shouldSync) return;

      const syncAndPersist = async (syncToken?: string) => {
        const result = await syncCalendarList({
          accessToken: token,
          syncToken,
        });
        const nextItems = syncToken
          ? mergeCachedCalendarListItems(cachedList?.items ?? [], result.items)
          : mergeCachedCalendarListItems([], result.items);
        await saveCachedGoogleCalendarList({
          items: nextItems,
          lastSyncedAt: Date.now(),
          syncToken: result.nextSyncToken,
        });
        await applyCalendarSelection(nextItems);

        // Task 8: Calendars loaded successfully
        await logUsabilityEvent("calendar_list_loaded", {
          session_id: sessionId.current,
          calendar_count: nextItems.length,
          time_since_screen_load_ms:
            Date.now() - scheduleScreenLoadTime.current,
        });
      };

      try {
        await syncAndPersist(
          !force && cachedList?.syncToken ? cachedList.syncToken : undefined,
        );
      } catch (error) {
        if (
          error instanceof GoogleCalendarApiError &&
          error.status === 410 &&
          !force
        ) {
          await syncAndPersist();
          return;
        }
        if (__DEV__) console.error("Failed to load calendars:", error);
      }
    },
    [applyCalendarSelection],
  );

  useEffect(() => {
    const handleURL = ({ url }: { url: string }) => {
      if (url.includes("oauthredirect")) WebBrowser.maybeCompleteAuthSession();
    };
    const subscription = Linking.addEventListener("url", handleURL);
    Linking.getInitialURL().then((url) => {
      if (url?.includes("oauthredirect")) WebBrowser.maybeCompleteAuthSession();
    });
    return () => subscription.remove();
  }, []);

  const initializeSchedule = useCallback(
    async (cancelledRef: { current: boolean }) => {
      let cachedSchedule: ScheduleItem[] | null = null;
      try {
        cachedSchedule = await loadCachedSchedule();
        applyCachedSchedule(cancelledRef, cachedSchedule, setUi);
        if (cancelledRef.current) return;
        const saved = await getGoogleAccessToken();
        if (cancelledRef.current) return;
        const token = await resolveAccessToken(saved);
        setAccessToken(token);
        await loadCalendarsAndMaybeAutoSelect(
          cancelledRef,
          token,
          shouldAutoSelectDefaultRef,
          setSelectedCalendarIds,
          setAvailableCalendars,
        );
        if (cancelledRef.current) return;
        setIdleIfNoData(token, cachedSchedule, setUi);
      } catch (error) {
        handleScheduleInitError(cancelledRef, error, setUi);
      } finally {
        if (!cancelledRef.current) setHasHydratedStorage(true);
      }
    },
    [],
  );

  useEffect(() => {
    const cancelledRef = { current: false };
    initializeSchedule(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [initializeSchedule]);

  useEffect(() => {
    const run = async () => {
      const res = getResultFromResponse();
      if (!res) return;

      if (!res.ok) {
        if (res.reason === "cancelled") {
          // Task 8: User cancelled Google sign-in
          void logUsabilityEvent("google_signin_cancelled", {
            session_id: sessionId.current,
            time_spent_ms: connectStartTime.current
              ? Date.now() - connectStartTime.current
              : 0,
          });

          if (ui.status === "ready" || ui.status === "empty") return;
          setUi({ status: "idle" });
          return;
        }

        // Task 8: Sign-in failed
        void logUsabilityEvent("google_signin_failed", {
          session_id: sessionId.current,
          reason: res.message ?? "unknown",
        });

        setUi({ status: "error", message: res.message ?? "Login failed." });
        return;
      }

      // Task 8: Sign-in succeeded
      void logUsabilityEvent("google_signin_success", {
        session_id: sessionId.current,
        time_to_connect_ms: connectStartTime.current
          ? Date.now() - connectStartTime.current
          : 0,
        time_since_screen_load_ms: Date.now() - scheduleScreenLoadTime.current,
      });
      connectStartTime.current = null;

      setAccessToken(res.accessToken);
      saveGoogleAccessToken(res.accessToken, {
        issuedAt: res.issuedAt,
        expiresIn: res.expiresIn,
      }).catch(() => {});
    };
    run();
  }, [response, getResultFromResponse, ui.status]);

  const connect = useCallback(async () => {
    //  Task 8: Connect button tapped
    connectStartTime.current = Date.now();
    void logUsabilityEvent("google_connect_tapped", {
      session_id: sessionId.current,
      time_since_screen_load_ms: Date.now() - scheduleScreenLoadTime.current,
    });
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

  const refresh = useCallback(async () => {
    if (!accessTokenRef.current) {
      await connect();
      return;
    }
    await syncCalendarListData(accessTokenRef.current, true);
    await syncScheduleForSelection(
      accessTokenRef.current,
      selectedCalendarIdsRef.current,
      { force: true },
    );
  }, [connect, syncCalendarListData, syncScheduleForSelection]);

  const disconnect = useCallback(async () => {
    //Task 8: Disconnect tapped
    await logUsabilityEvent("google_calendar_disconnected", {
      session_id: sessionId.current,
    });

    try {
      await deleteGoogleAccessToken();
      await AsyncStorage.removeItem(SCHEDULE_ITEMS);
      await clearSelectedCalendarIds();
      await clearGoogleCalendarCache();
    } finally {
      shouldAutoSelectDefaultRef.current = true;
      setAccessToken(null);
      setAvailableCalendars([]);
      setSelectedCalendarIds([]);
      setUi({ status: "idle" });
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage || !accessToken) return;
    void syncCalendarListData(accessToken);
  }, [accessToken, hasHydratedStorage, syncCalendarListData]);

  useEffect(() => {
    if (!hasHydratedStorage || !accessToken) return;
    if (selectedCalendarIds.length === 0 && availableCalendars.length === 0)
      return;
    void syncScheduleForSelection(accessToken, selectedCalendarIds);
  }, [
    accessToken,
    availableCalendars.length,
    hasHydratedStorage,
    selectedCalendarIds,
    syncScheduleForSelection,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (
        previousState.match(/inactive|background/) &&
        nextState === "active" &&
        accessTokenRef.current
      ) {
        void syncCalendarListData(accessTokenRef.current);
        if (
          selectedCalendarIdsRef.current.length > 0 ||
          availableCalendars.length > 0
        ) {
          void syncScheduleForSelection(
            accessTokenRef.current,
            selectedCalendarIdsRef.current,
            { background: true },
          );
        }
      }
    });
    return () => subscription.remove();
  }, [
    availableCalendars.length,
    syncCalendarListData,
    syncScheduleForSelection,
  ]);

  const toggleCalendarSelection = useCallback(
    async (calendarId: string, calendarName: string) => {
      shouldAutoSelectDefaultRef.current = false;

      const isCurrentlySelected = selectedCalendarIds.includes(calendarId);
      const nextSelected = isCurrentlySelected
        ? selectedCalendarIds.filter((id) => id !== calendarId)
        : [...selectedCalendarIds, calendarId];

      // Task 8: Calendar toggled
      await logUsabilityEvent("calendar_toggled", {
        session_id: sessionId.current,
        calendar_name: calendarName,
        action: isCurrentlySelected ? "deselected" : "selected",
        selected_count: nextSelected.length,
        time_since_screen_load_ms: Date.now() - scheduleScreenLoadTime.current,
      });

      setSelectedCalendarIds(nextSelected);
      await saveSelectedCalendarIds(nextSelected);
    },
    [selectedCalendarIds],
  );

  // Task 8: Log when schedule items are displayed
  const itemCount = ui.status === "ready" ? ui.items.length : 0;
  useEffect(() => {
    if (ui.status !== "ready" && ui.status !== "empty") return;
    const run = async () => {
      await logUsabilityEvent("schedule_displayed", {
        session_id: sessionId.current,
        item_count: itemCount,
        status: ui.status,
        time_since_screen_load_ms: Date.now() - scheduleScreenLoadTime.current,
      });
    };
    run();
  }, [ui.status, itemCount]);

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
                  testID={`calendar-toggle-${calendar.summary?.replaceAll(/\s+/g, "-").toLowerCase()}`}
                  // ── Pass calendar name so the event knows which was tapped ──
                  onPress={() =>
                    toggleCalendarSelection(
                      calendar.id,
                      calendar.summary ?? "unknown",
                    )
                  }
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? colors.primaryDark : colors.gray300,
                    backgroundColor: selected
                      ? colors.primaryDark
                      : colors.white,
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
                ? "Connecting..."
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
          <Text style={{ color: colors.gray700 }}>
            Loading your schedule...
          </Text>
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
            onPress={refresh}
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
            onPress={refresh}
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
