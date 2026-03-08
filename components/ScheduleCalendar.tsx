// components/ScheduleCalendar.tsx
import React, { useMemo } from "react";
import { SectionList, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import type { ScheduleItem } from "../constants/type";

function dayKey(d: Date) {
  // local day grouping
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeRange(start: Date, end: Date) {
  const s = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const e = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${s} – ${e}`;
}

export default function ScheduleCalendar({ items }: { items: ScheduleItem[] }) {
  const sections = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const k = dayKey(it.start);
      const arr = map.get(k) ?? [];
      arr.push(it);
      map.set(k, arr);
    }

    return Array.from(map.entries()).map(([title, data]) => ({
      title,
      data: data.sort((a, b) => a.start.getTime() - b.start.getTime()),
    }));
  }, [items]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View
          style={{
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            backgroundColor: colors.primaryDark,
            borderRadius: 10,
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ ...typography.subtitle, color: colors.white }}>
            {section.title}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: colors.offWhite,
            borderRadius: 12,
            padding: spacing.md,
            marginBottom: spacing.sm,
            borderWidth: 1,
            borderColor: colors.gray100,
          }}
        >
          <Text style={{ ...typography.button, color: colors.primaryDark }}>
            {item.courseName}
          </Text>
          <Text style={{ marginTop: 4, color: colors.gray700 }}>
            {timeRange(item.start, item.end)}
          </Text>
          <Text style={{ marginTop: 4, color: colors.gray700 }}>
            {item.location}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={{ color: colors.gray700 }}>
          No schedule items to display.
        </Text>
      }
    />
  );
}
