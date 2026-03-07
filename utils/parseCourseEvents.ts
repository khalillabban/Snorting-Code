import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GoogleCalendarEvent } from "../services/GoogleCalendarService";
import {ScheduleItem} from "../constants/type"


function parseGoogleDateTime(ev: GoogleCalendarEvent, which: "start" | "end") {
  const obj = which === "start" ? ev.start : ev.end;
  const raw = obj?.dateTime ?? obj?.date;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function parseLocation(raw: string): { campus: string; building: string; room: string } {
  const match = raw.trim().match(/^(\w+)\s*-\s*(\w+)\s+(.+)$/);
  if (!match) return { campus: "", building: "", room: "" };

  return {
    campus:   match[1].trim(),
    building: match[2].trim(),
    room:     match[3].trim(),
  };
}

export function parseCourseEvents(events: GoogleCalendarEvent[]): ScheduleItem[] {
  return events
    .map((ev) => {
      const start = parseGoogleDateTime(ev, "start");
      const end = parseGoogleDateTime(ev, "end");
      if (!ev.id || !start || !end) return null;

      const location = (ev.location ?? "").trim() || "Location not provided";
      const { campus, building, room } = parseLocation(location);

      return {
        id:         ev.id,
        courseName: (ev.summary ?? "").trim() || "Untitled class",
        start,
        end,
        location,
        campus,
        building,
        room,
      };
    })
    .filter((x): x is ScheduleItem => Boolean(x))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

// Save items to AsyncStorage (call this after parseCourseEvents)
export async function saveSchedule(items: ScheduleItem[]): Promise<void> {
  await AsyncStorage.setItem("scheduleItems", JSON.stringify(items));
  console.log(`Saved ${items.length} items to AsyncStorage`);
}

// Load and revive Date objects on app start
export async function loadCachedSchedule(): Promise<ScheduleItem[] | null> {
  const raw = await AsyncStorage.getItem("scheduleItems");
  if (!raw) return null;

  return JSON.parse(raw).map((item: any) => ({
    ...item,
    start: new Date(item.start),
    end:   new Date(item.end),
  }));
}

export async function getNextClass(): Promise<ScheduleItem | null> {
  const items = await loadCachedSchedule();
  if (!items) return null;

  const now = new Date();
  return items.find(item => item.start > now) ?? null;
}