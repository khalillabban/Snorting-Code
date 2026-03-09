import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  GoogleCalendarEvent,
  GoogleCalendarListItem,
} from "./GoogleCalendarService";

const GOOGLE_CALENDAR_LIST_CACHE_KEY = "googleCalendarCache:list:v1";
const GOOGLE_CALENDAR_EVENTS_CACHE_PREFIX = "googleCalendarCache:events:v1:";
const GOOGLE_CALENDAR_IDS_KEY = "googleCalendarCache:calendarIds:v1";

export const GOOGLE_CALENDAR_EVENTS_TTL_MS = 15 * 60 * 1000;
export const GOOGLE_CALENDAR_LIST_TTL_MS = 24 * 60 * 60 * 1000;

export type CachedGoogleCalendarEvent = GoogleCalendarEvent & {
  sourceCalendarId: string;
};

export type CachedGoogleCalendarList = {
  items: GoogleCalendarListItem[];
  lastSyncedAt: number;
  syncToken: string | null;
};

export type CachedGoogleCalendarEvents = {
  calendarId: string;
  events: CachedGoogleCalendarEvent[];
  lastSyncedAt: number;
  syncToken: string | null;
  windowStart: string;
  windowEnd: string;
};

function getCalendarEventsCacheKey(calendarId: string): string {
  return `${GOOGLE_CALENDAR_EVENTS_CACHE_PREFIX}${encodeURIComponent(calendarId)}`;
}

function getEventCacheIdentity(
  event: Pick<
    GoogleCalendarEvent,
    "id" | "originalStartTime" | "start"
  >,
): string | null {
  if (!event.id) return null;

  const occurrenceKey =
    event.originalStartTime?.dateTime ??
    event.originalStartTime?.date ??
    event.start?.dateTime ??
    event.start?.date ??
    "";

  return occurrenceKey ? `${event.id}::${occurrenceKey}` : event.id;
}

async function loadCalendarIdsIndex(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(GOOGLE_CALENDAR_IDS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

async function saveCalendarIdsIndex(ids: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(ids));
  await AsyncStorage.setItem(GOOGLE_CALENDAR_IDS_KEY, JSON.stringify(uniqueIds));
}

export function isGoogleCalendarListCacheStale(
  cache: CachedGoogleCalendarList | null,
  now = Date.now(),
): boolean {
  if (!cache) return true;
  return now - cache.lastSyncedAt >= GOOGLE_CALENDAR_LIST_TTL_MS;
}

export function isGoogleCalendarEventsCacheStale(
  cache: CachedGoogleCalendarEvents | null,
  now = Date.now(),
): boolean {
  if (!cache) return true;
  return now - cache.lastSyncedAt >= GOOGLE_CALENDAR_EVENTS_TTL_MS;
}

export function filterVisibleCachedCalendars(
  items: GoogleCalendarListItem[],
): GoogleCalendarListItem[] {
  return items.filter((item) => !item.deleted && !item.hidden);
}

export function mergeCachedCalendarListItems(
  existing: GoogleCalendarListItem[],
  incoming: GoogleCalendarListItem[],
): GoogleCalendarListItem[] {
  const merged = new Map(existing.map((item) => [item.id, item]));

  for (const item of incoming) {
    if (!item.id) continue;

    if (item.deleted) {
      merged.delete(item.id);
      continue;
    }

    merged.set(item.id, item);
  }

  return Array.from(merged.values());
}

export function mergeCachedCalendarEvents(
  existing: CachedGoogleCalendarEvent[],
  incoming: GoogleCalendarEvent[],
  calendarId: string,
): CachedGoogleCalendarEvent[] {
  const merged = new Map(
    existing.map((event) => [getEventCacheIdentity(event), event] as const),
  );

  for (const event of incoming) {
    const identity = getEventCacheIdentity(event);
    if (!identity) continue;

    if (event.status === "cancelled") {
      merged.delete(identity);
      continue;
    }

    merged.set(identity, {
      ...event,
      sourceCalendarId: calendarId,
    });
  }

  return Array.from(merged.values());
}

export async function loadCachedGoogleCalendarList(): Promise<CachedGoogleCalendarList | null> {
  try {
    const raw = await AsyncStorage.getItem(GOOGLE_CALENDAR_LIST_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedGoogleCalendarList;
    if (!Array.isArray(parsed.items) || typeof parsed.lastSyncedAt !== "number") {
      await AsyncStorage.removeItem(GOOGLE_CALENDAR_LIST_CACHE_KEY);
      return null;
    }

    return {
      items: parsed.items,
      lastSyncedAt: parsed.lastSyncedAt,
      syncToken: parsed.syncToken ?? null,
    };
  } catch {
    await AsyncStorage.removeItem(GOOGLE_CALENDAR_LIST_CACHE_KEY);
    return null;
  }
}

export async function saveCachedGoogleCalendarList(
  cache: CachedGoogleCalendarList,
): Promise<void> {
  await AsyncStorage.setItem(GOOGLE_CALENDAR_LIST_CACHE_KEY, JSON.stringify(cache));
}

export async function loadCachedGoogleCalendarEvents(
  calendarId: string,
): Promise<CachedGoogleCalendarEvents | null> {
  try {
    const raw = await AsyncStorage.getItem(getCalendarEventsCacheKey(calendarId));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedGoogleCalendarEvents;
    if (!Array.isArray(parsed.events) || typeof parsed.lastSyncedAt !== "number") {
      await AsyncStorage.removeItem(getCalendarEventsCacheKey(calendarId));
      return null;
    }

    return {
      calendarId: parsed.calendarId ?? calendarId,
      events: parsed.events,
      lastSyncedAt: parsed.lastSyncedAt,
      syncToken: parsed.syncToken ?? null,
      windowStart: parsed.windowStart ?? "",
      windowEnd: parsed.windowEnd ?? "",
    };
  } catch {
    await AsyncStorage.removeItem(getCalendarEventsCacheKey(calendarId));
    return null;
  }
}

export async function loadCachedGoogleCalendarEventsForIds(
  calendarIds: string[],
): Promise<CachedGoogleCalendarEvents[]> {
  const entries = await Promise.all(
    calendarIds.map((calendarId) => loadCachedGoogleCalendarEvents(calendarId)),
  );

  return entries.filter(
    (entry): entry is CachedGoogleCalendarEvents => Boolean(entry),
  );
}

export async function saveCachedGoogleCalendarEvents(
  cache: CachedGoogleCalendarEvents,
): Promise<void> {
  await AsyncStorage.setItem(
    getCalendarEventsCacheKey(cache.calendarId),
    JSON.stringify(cache),
  );

  const ids = await loadCalendarIdsIndex();
  if (!ids.includes(cache.calendarId)) {
    await saveCalendarIdsIndex([...ids, cache.calendarId]);
  }
}

export async function clearCachedGoogleCalendarEvents(
  calendarId: string,
): Promise<void> {
  await AsyncStorage.removeItem(getCalendarEventsCacheKey(calendarId));

  const ids = await loadCalendarIdsIndex();
  if (ids.includes(calendarId)) {
    await saveCalendarIdsIndex(ids.filter((id) => id !== calendarId));
  }
}

export async function clearGoogleCalendarCache(): Promise<void> {
  await AsyncStorage.removeItem(GOOGLE_CALENDAR_LIST_CACHE_KEY);

  const ids = await loadCalendarIdsIndex();
  await Promise.all(
    ids.map((calendarId) =>
      AsyncStorage.removeItem(getCalendarEventsCacheKey(calendarId)),
    ),
  );
  await AsyncStorage.removeItem(GOOGLE_CALENDAR_IDS_KEY);
}
