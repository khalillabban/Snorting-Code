// components/ScheduleCalendar.tsx
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import type { ScheduleItem } from "../constants/type";

function dayKey(d: Date) {
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

function groupByDay(items: ScheduleItem[]): { title: string; data: ScheduleItem[] }[] {
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
}

function ClassCard({ item }: { item: ScheduleItem }) {
  return (
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
  );
}

interface AccordionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  testID?: string;
}

function AccordionHeader({ title, expanded, onToggle, testID }: AccordionHeaderProps) {
  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        backgroundColor: colors.white,
      }}
    >
      <Pressable
        testID={testID}
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: colors.primaryDark,
          borderRadius: 10,
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={{ ...typography.subtitle, color: colors.white, fontWeight: "600" }}>
          {title}
        </Text>
        <Text style={{ color: colors.white, fontSize: 18 }}>
          {expanded ? "▲" : "▼"}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ScheduleCalendar({ items }: { items: ScheduleItem[] }) {
  const [pastExpanded, setPastExpanded] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);

  const now = new Date();

  const { pastGroups, upcomingGroups } = useMemo(() => {
    const past = items.filter((it) => it.end < now);
    const upcoming = items.filter((it) => it.end >= now);
    return {
      pastGroups: groupByDay(past),
      upcomingGroups: groupByDay(upcoming),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (items.length === 0) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.gray700 }}>No schedule items to display.</Text>
      </View>
    );
  }

  // stickyHeaderIndices: child index 0 = upcoming header, child index 2 = past header
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      stickyHeaderIndices={[0, 2]}
    >
      {/* index 0 — sticky upcoming header */}
      <AccordionHeader
        testID="accordion-upcoming"
        title="Upcoming Classes"
        expanded={upcomingExpanded}
        onToggle={() => setUpcomingExpanded((v) => !v)}
      />

      {/* index 1 — upcoming classes */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xs }}>
        {upcomingExpanded && (
          upcomingGroups.length === 0 ? (
            <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
              No upcoming classes.
            </Text>
          ) : (
            upcomingGroups.map((group) => (
              <View key={group.title}>
                <View
                  style={{
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Text style={{ ...typography.caption, color: colors.white, fontWeight: "600" }}>
                    {group.title}
                  </Text>
                </View>
                {group.data.map((item) => (
                  <ClassCard key={item.id} item={item} />
                ))}
              </View>
            ))
          )
        )}
      </View>

      {/* index 2 — sticky past header */}
      <AccordionHeader
        testID="accordion-past"
        title="Past Classes"
        expanded={pastExpanded}
        onToggle={() => setPastExpanded((v) => !v)}
      />

      {/* index 3 — past classes */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        {pastExpanded && (
          pastGroups.length === 0 ? (
            <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
              No past classes.
            </Text>
          ) : (
            pastGroups.map((group) => (
              <View key={group.title}>
                <View
                  style={{
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                    backgroundColor: colors.gray300,
                    borderRadius: 8,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Text style={{ ...typography.caption, color: colors.gray700, fontWeight: "600" }}>
                    {group.title}
                  </Text>
                </View>
                {group.data.map((item) => (
                  <ClassCard key={item.id} item={item} />
                ))}
              </View>
            ))
          )
        )}
      </View>
    </ScrollView>
  );
}
