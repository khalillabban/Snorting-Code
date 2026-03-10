import AsyncStorage from "@react-native-async-storage/async-storage";
import { SCHEDULE_ITEMS, ScheduleItem } from "../constants/type";
import type { GoogleCalendarEvent } from "../services/GoogleCalendarService";
type SerializedScheduleItem = Omit<ScheduleItem, "start" | "end" | "kind"> & {
  start: string;
  end: string;
  kind?: ScheduleItem["kind"];
};

const CLASS_KEYWORD_REGEX = /\b(LEC|TUT|LAB)\b/i;

function parseGoogleDateTime(ev: GoogleCalendarEvent, which: "start" | "end") {
  const obj = which === "start" ? ev.start : ev.end;
  const raw = obj?.dateTime ?? obj?.date;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

const CAMPUSES = ["SGW", "LOY"] as const;

function parseLocation(raw: string): {
  campus: string;
  building: string;
  room: string;
} {
  const trimmed = raw.trim().toUpperCase();

  for (const campus of CAMPUSES) {
    if (!trimmed.startsWith(campus)) continue;

    const rest = trimmed.slice(campus.length).replace(/^[\s-]+/, "");

    const withRoom = rest.match(/^([\w-]+)\s+(.+)$/);
    if (withRoom) {
      return {
        campus,
        building: withRoom[1].trim(),
        room: withRoom[2].trim(),
      };
    }

    const noRoom = rest.match(/^([A-Z]+)-(.+)$/);
    if (noRoom) {
      return {
        campus,
        building: noRoom[1].trim(),
        room: noRoom[2].trim(),
      };
    }

    if (rest.length > 0) {
      return { campus, building: rest, room: "" };
    }
  }

  if (__DEV__) console.warn("parseLocation: unexpected format:", raw);
  return { campus: "", building: raw, room: "" };
}
function splitRoom(room: string): { level: string; room: string } {
  const dotMatch = room.match(/^([A-Z0-9]+)\.(\d+)$/i);
  if (dotMatch) {
    return { level: dotMatch[1].toUpperCase(), room: dotMatch[2] };
  }

  const digitMatch = room.match(/^(\d)(\d+)$/);
  if (digitMatch) {
    return { level: digitMatch[1], room: room };
  }

  return { level: "", room };
}

export function classifyScheduleItemKind(courseName: string): ScheduleItem["kind"] {
  return CLASS_KEYWORD_REGEX.test(courseName) ? "class" : "event";
}

function getScheduleItemKind(
  item: Pick<ScheduleItem, "courseName" | "kind">,
): ScheduleItem["kind"] {
  return item.kind ?? classifyScheduleItemKind(item.courseName);
}

export function parseCourseEvents(
  events: GoogleCalendarEvent[],
): ScheduleItem[] {
  return events
    .map((ev) => {
      const start = parseGoogleDateTime(ev, "start");
      const end = parseGoogleDateTime(ev, "end");
      if (!ev.id || !start || !end) return null;

      const location = (ev.location ?? "").trim() || "Location not provided";
      const { campus, building, room: rawRoom } = parseLocation(location);
      const { level, room } = splitRoom(rawRoom);
      const courseName = (ev.summary ?? "").trim() || "Untitled class";

      return {
        id: ev.id,
        kind: classifyScheduleItemKind(courseName),
        courseName,
        start,
        end,
        location,
        campus,
        building,
        room,
        level,
      };
    })
    .filter((x): x is ScheduleItem => Boolean(x))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

// Save items to AsyncStorage (call this after parseCourseEvents)
export async function saveSchedule(items: ScheduleItem[]): Promise<void> {
  await AsyncStorage.setItem(SCHEDULE_ITEMS, JSON.stringify(items));
  if (__DEV__) {
    console.log(`Saved ${items.length} items to AsyncStorage`);
  }
}

// Load and revive Date objects on app start
export async function loadCachedSchedule(): Promise<ScheduleItem[] | null> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_ITEMS);
    if (!raw) return null;

    return JSON.parse(raw).map((item: SerializedScheduleItem) => ({
      ...item,
      kind: item.kind ?? classifyScheduleItemKind(item.courseName),
      start: new Date(item.start),
      end: new Date(item.end),
    }));
  } catch (error) {
    if (__DEV__)
      console.warn("Failed to load cached schedule, clearing cache:", error);
    await AsyncStorage.removeItem(SCHEDULE_ITEMS);
    return null;
  }
}

function getSortedClassItems(items: ScheduleItem[]): ScheduleItem[] {
  return items
    .filter((item) => getScheduleItemKind(item) === "class")
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export async function getNextClass(): Promise<ScheduleItem | null> {
  const items = await loadCachedSchedule();
  if (!items || items.length === 0) return null;

  const now = new Date();
  const sorted = getSortedClassItems(items);
  if (sorted.length === 0) return null;

  // Find the next class whose start time is after current time
  // Handle overlapping classes – the soonest upcoming start wins
  const upcoming = sorted.find((item) => item.start > now);
  if (upcoming) return upcoming;

  // No future classes left → wrap around to the earliest class in schedule
  return sorted[0];
}

/**
 * Synchronous version: receives items directly instead of reading AsyncStorage.
 * Useful from components that already hold the schedule in state.
 */
export function getNextClassFromItems(
  items: ScheduleItem[],
): ScheduleItem | null {
  if (items.length === 0) return null;

  const now = new Date();
  const sorted = getSortedClassItems(items);
  if (sorted.length === 0) return null;

  const upcoming = sorted.find((item) => item.start > now);
  if (upcoming) return upcoming;

  // Wrap around
  return sorted[0];
}
