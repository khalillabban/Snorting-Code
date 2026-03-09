import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { colors, spacing, typography } from "../constants/theme";
import type { ScheduleItem } from "../constants/type";

type ScheduleFilter = "all" | "class" | "event";

type GroupedItems = {
  title: string;
  data: ScheduleItem[];
};

type SectionConfig = {
  testID: string;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  groups: GroupedItems[];
  emptyMessage: string;
  tone: "upcoming" | "past";
};

function dayKey(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function timeRange(start: Date, end: Date) {
  const startText = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endText = end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${startText} - ${endText}`;
}

function groupByDay(items: ScheduleItem[]): GroupedItems[] {
  const grouped = new Map<string, ScheduleItem[]>();

  for (const item of items) {
    const key = dayKey(item.start);
    const existing = grouped.get(key) ?? [];
    existing.push(item);
    grouped.set(key, existing);
  }

  return Array.from(grouped.entries())
    .map(([title, data]) => ({
      title,
      data: [...data].sort((a, b) => a.start.getTime() - b.start.getTime()),
    }))
    .sort((a, b) => a.data[0].start.getTime() - b.data[0].start.getTime());
}

function getItemKind(item: Pick<ScheduleItem, "courseName" | "kind">): ScheduleItem["kind"] {
  return item.kind ?? (/\b(LEC|TUT|LAB)\b/i.test(item.courseName) ? "class" : "event");
}

function ScheduleCard({ item }: Readonly<{ item: ScheduleItem }>) {
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

function AccordionHeader({
  title,
  expanded,
  onToggle,
  testID,
}: Readonly<AccordionHeaderProps>) {
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
        <Text
          style={{ ...typography.subtitle, color: colors.white, fontWeight: "600" }}
        >
          {title}
        </Text>
        <Text style={{ color: colors.white, fontSize: 18 }}>
          {expanded ? "^" : "v"}
        </Text>
      </Pressable>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  testID,
}: Readonly<{
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}>) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.primaryDark : colors.gray300,
        backgroundColor: selected ? colors.primaryDark : colors.white,
      }}
    >
      <Text
        style={{
          color: selected ? colors.white : colors.primaryDark,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SectionBody({
  expanded,
  groups,
  emptyMessage,
  tone,
}: Readonly<{
  expanded: boolean;
  groups: GroupedItems[];
  emptyMessage: string;
  tone: "upcoming" | "past";
}>) {
  const labelBackgroundColor =
    tone === "upcoming" ? colors.primary : colors.gray300;
  const labelTextColor = tone === "upcoming" ? colors.white : colors.gray700;
  const containerPaddingTop = tone === "upcoming" ? spacing.xs : spacing.md;
  const containerPaddingBottom = tone === "upcoming" ? spacing.xs : spacing.md;

  return (
    <View
      style={{
        paddingHorizontal: spacing.lg,
        paddingTop: containerPaddingTop,
        paddingBottom: containerPaddingBottom,
      }}
    >
      {expanded &&
        (groups.length === 0 ? (
          <Text style={{ color: colors.gray700, paddingHorizontal: spacing.sm }}>
            {emptyMessage}
          </Text>
        ) : (
          groups.map((group) => (
            <View key={group.title}>
              <View
                style={{
                  paddingVertical: spacing.xs,
                  paddingHorizontal: spacing.sm,
                  backgroundColor: labelBackgroundColor,
                  borderRadius: 8,
                  marginBottom: spacing.sm,
                }}
              >
                <Text
                  style={{
                    ...typography.caption,
                    color: labelTextColor,
                    fontWeight: "600",
                  }}
                >
                  {group.title}
                </Text>
              </View>
              {group.data.map((item) => (
                <ScheduleCard key={item.id} item={item} />
              ))}
            </View>
          ))
        ))}
    </View>
  );
}

export default function ScheduleCalendar({
  items,
}: Readonly<{ items: ScheduleItem[] }>) {
  const [visibleFilter, setVisibleFilter] = useState<ScheduleFilter>("all");
  const [upcomingClassesExpanded, setUpcomingClassesExpanded] = useState(true);
  const [pastClassesExpanded, setPastClassesExpanded] = useState(false);
  const [upcomingEventsExpanded, setUpcomingEventsExpanded] = useState(true);
  const [pastEventsExpanded, setPastEventsExpanded] = useState(false);

  const now = useMemo(() => new Date(), []);

  const {
    upcomingClassGroups,
    pastClassGroups,
    upcomingEventGroups,
    pastEventGroups,
  } = useMemo(() => {
    const normalized = items.map((item) => ({
      ...item,
      start: item.start instanceof Date ? item.start : new Date(item.start),
      end: item.end instanceof Date ? item.end : new Date(item.end),
    }));

    const upcoming = normalized.filter((item) => item.end >= now);
    const past = normalized.filter((item) => item.end < now);

    return {
      upcomingClassGroups: groupByDay(
        upcoming.filter((item) => getItemKind(item) === "class"),
      ),
      pastClassGroups: groupByDay(
        past.filter((item) => getItemKind(item) === "class"),
      ),
      upcomingEventGroups: groupByDay(
        upcoming.filter((item) => getItemKind(item) === "event"),
      ),
      pastEventGroups: groupByDay(
        past.filter((item) => getItemKind(item) === "event"),
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const sections = useMemo(() => {
    const classSections =
      visibleFilter !== "event"
        ? [
            {
              testID: "accordion-upcoming-classes",
              title: "Upcoming Classes",
              expanded: upcomingClassesExpanded,
              onToggle: () => setUpcomingClassesExpanded((value) => !value),
              groups: upcomingClassGroups,
              emptyMessage: "No upcoming classes.",
              tone: "upcoming",
            },
            {
              testID: "accordion-past-classes",
              title: "Past Classes",
              expanded: pastClassesExpanded,
              onToggle: () => setPastClassesExpanded((value) => !value),
              groups: pastClassGroups,
              emptyMessage: "No past classes.",
              tone: "past",
            },
          ]
        : [];

    const eventSections =
      visibleFilter !== "class"
        ? [
            {
              testID: "accordion-upcoming-events",
              title: "Upcoming Events",
              expanded: upcomingEventsExpanded,
              onToggle: () => setUpcomingEventsExpanded((value) => !value),
              groups: upcomingEventGroups,
              emptyMessage: "No upcoming events.",
              tone: "upcoming",
            },
            {
              testID: "accordion-past-events",
              title: "Past Events",
              expanded: pastEventsExpanded,
              onToggle: () => setPastEventsExpanded((value) => !value),
              groups: pastEventGroups,
              emptyMessage: "No past events.",
              tone: "past",
            },
          ]
        : [];

    return [...classSections, ...eventSections];
  }, [
    pastClassGroups,
    pastClassesExpanded,
    pastEventGroups,
    pastEventsExpanded,
    upcomingClassGroups,
    upcomingClassesExpanded,
    upcomingEventGroups,
    upcomingEventsExpanded,
    visibleFilter,
  ]);

  const scrollChildren = useMemo(
    () =>
      sections.flatMap((section) => [
        (
          <AccordionHeader
            key={`${section.testID}-header`}
            testID={section.testID}
            title={section.title}
            expanded={section.expanded}
            onToggle={section.onToggle}
          />
        ),
        (
          <SectionBody
            key={`${section.testID}-body`}
            expanded={section.expanded}
            groups={section.groups}
            emptyMessage={section.emptyMessage}
            tone={section.tone}
          />
        ),
      ]),
    [sections],
  );

  const stickyHeaderIndices = useMemo(
    () => sections.map((_, index) => index * 2),
    [sections],
  );

  if (items.length === 0) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text style={{ color: colors.gray700 }}>No schedule items to display.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.xs,
          gap: spacing.sm,
          backgroundColor: colors.white,
        }}
      >
        <Text style={{ color: colors.primaryDark, fontWeight: "600" }}>
          Show
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <FilterChip
            testID="schedule-filter-all"
            label="All"
            selected={visibleFilter === "all"}
            onPress={() => setVisibleFilter("all")}
          />
          <FilterChip
            testID="schedule-filter-classes"
            label="Classes"
            selected={visibleFilter === "class"}
            onPress={() => setVisibleFilter("class")}
          />
          <FilterChip
            testID="schedule-filter-events"
            label="Events"
            selected={visibleFilter === "event"}
            onPress={() => setVisibleFilter("event")}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.lg }}
        stickyHeaderIndices={stickyHeaderIndices}
      >
        {scrollChildren}
      </ScrollView>
    </View>
  );
}