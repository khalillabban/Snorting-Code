// utils/parseCourseSchedule.ts
import type { ScheduleItem } from "./parseCourseEvents";

export interface CourseSlot {
  recurringEventId: string;
  iCalUID: string | null;
  courseName: string;
  description: string;
  location: string;
  colorId: string | null;
  dayOfWeek: number;        // 0 = Sunday, 1 = Monday … 6 = Saturday
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export function deriveWeeklySchedule(items: ScheduleItem[]): CourseSlot[] {
  const seen = new Set<string>();
  const slots: CourseSlot[] = [];

  for (const item of items) {
    // Use recurringEventId as the dedup key — all instances of the same
    // weekly class share it. Fall back to id for one-off events.
    const key = item.recurringEventId ?? item.id;
    if (seen.has(key)) continue;
    seen.add(key);

    // Use originalStartTime as the canonical anchor if available,
    // otherwise fall back to start — both are already real Date objects.
    const anchor = item.originalStartTime ?? item.start;

    slots.push({
      recurringEventId: key,
      iCalUID:          item.iCalUID,
      courseName:       item.courseName,
      description:      item.description,
      location:         item.location,
      colorId:          item.colorId,
      dayOfWeek:        anchor.getDay(),
      startHour:        item.start.getHours(),
      startMinute:      item.start.getMinutes(),
      endHour:          item.end.getHours(),
      endMinute:        item.end.getMinutes(),
    });
  }

  // Sort by day then time so the stored array is human-readable
  return slots.sort((a, b) =>
    a.dayOfWeek !== b.dayOfWeek
      ? a.dayOfWeek - b.dayOfWeek
      : (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute)
  );
}