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
  return Array.from(map.entries())
    .map(([title, data]) => ({
      title,
      data: data.sort((a, b) => a.start.getTime() - b.start.getTime()),
    }))
    .sort((a, b) => a.data[0].start.getTime() - b.data[0].start.getTime());
}

function isClassItem(item: ScheduleItem) {
  return /\b(LEC|TUT|LAB)\b/i.test(item.courseName);
}

function ClassCard({ item }: Readonly<{ item: ScheduleItem }>) {
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

function AccordionHeader({ title, expanded, onToggle, testID }: Readonly<AccordionHeaderProps>) {
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

export default function ScheduleCalendar({ items }: Readonly<{ items: ScheduleItem[] }>) {
  const [upcomingClassesExpanded, setUpcomingClassesExpanded] = useState(true);
  const [pastClassesExpanded, setPastClassesExpanded] = useState(false);
  const [upcomingEventsExpanded, setUpcomingEventsExpanded] = useState(true);
  const [pastEventsExpanded, setPastEventsExpanded] = useState(false);

  const now = new Date();

  const {
    upcomingClassGroups,
    pastClassGroups,
    upcomingEventGroups,
    pastEventGroups,
  } = useMemo(() => {
    const normalized = items.map((it) => ({
      ...it,
      start: it.start instanceof Date ? it.start : new Date(it.start),
      end: it.end instanceof Date ? it.end : new Date(it.end),
    }));

    const upcoming = normalized.filter((it) => it.end >= now);
    const past = normalized.filter((it) => it.end < now);

    const upcomingClasses = upcoming.filter(isClassItem);
    const pastClasses = past.filter(isClassItem);
    const upcomingEvents = upcoming.filter((it) => !isClassItem(it));
    const pastEvents = past.filter((it) => !isClassItem(it));

    return {
      upcomingClassGroups: groupByDay(upcomingClasses),
      pastClassGroups: groupByDay(pastClasses),
      upcomingEventGroups: groupByDay(upcomingEvents),
      pastEventGroups: groupByDay(pastEvents),
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

  // stickyHeaderIndices:
  // 0 = upcoming classes header
  // 2 = past classes header
  // 4 = upcoming events header
  // 6 = past events header
  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: spacing.lg }}
      stickyHeaderIndices={[0, 2, 4, 6]}
    >
      {/* index 0 — sticky upcoming classes header */}
      <AccordionHeader
        testID="accordion-upcoming-classes"
        title="Upcoming Classes"
        expanded={upcomingClassesExpanded}
        onToggle={() => setUpcomingClassesExpanded((v) => !v)}
      />

      {/* index 1 — upcoming classes */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xs }}>
        {upcomingClassesExpanded && (
          upcomingClassGroups.length === 0 ? (
            <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
              No upcoming classes.
            </Text>
          ) : (
            upcomingClassGroups.map((group) => (
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

      {/* index 2 — sticky past classes header */}
      <AccordionHeader
        testID="accordion-past-classes"
        title="Past Classes"
        expanded={pastClassesExpanded}
        onToggle={() => setPastClassesExpanded((v) => !v)}
      />

      {/* index 3 — past classes */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        {pastClassesExpanded && (
          pastClassGroups.length === 0 ? (
            <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
              No past classes.
            </Text>
          ) : (
            pastClassGroups.map((group) => (
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

      {/* index 4 — sticky upcoming events header */}
      <AccordionHeader
        testID="accordion-upcoming-events"
        title="Upcoming Events"
        expanded={upcomingEventsExpanded}
        onToggle={() => setUpcomingEventsExpanded((v) => !v)}
      />

      {/* index 5 — upcoming events */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, paddingBottom: spacing.xs }}>
        {upcomingEventsExpanded && (
          upcomingEventGroups.length === 0 ? (
            <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
              No upcoming events.
            </Text>
          ) : (
            upcomingEventGroups.map((group) => (
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

      {/* index 6 — sticky past events header */}
      <AccordionHeader
        testID="accordion-past-events"
        title="Past Events"
        expanded={pastEventsExpanded}
        onToggle={() => setPastEventsExpanded((v) => !v)}
      />

      {/* index 7 — past events */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
        {pastEventsExpanded && (
          pastEventGroups.length === 0 ? (
            <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
              No past events.
            </Text>
          ) : (
            pastEventGroups.map((group) => (
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