import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { shuttleSchedule } from "../constants/shuttle";
import { spacing } from "../constants/theme";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { createStyles } from "../styles/ShuttleSchedulePanel.styles";
import {
  getScheduleKeyForDate,
  type ScheduleKey,
} from "../utils/shuttleAvailability";

type Trip = { departureTime: string; arrivalTime: string };
type DirectionKey = "SGW_to_Loyola" | "Loyola_to_SGW";
type TripBadgeKind = "now" | "next" | "eta";

type TripBadge = {
  label: string;
  kind: TripBadgeKind;
};

const MINUTES_PER_DAY = 24 * 60;

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";

  let hour: number;
  if (h === 0) {
    hour = 12;
  } else if (h > 12) {
    hour = h - 12;
  } else {
    hour = h;
  }

  return `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesUntilDeparture(depMinutes: number, nowMinutes: number) {
  return depMinutes >= nowMinutes
    ? depMinutes - nowMinutes
    : MINUTES_PER_DAY - nowMinutes + depMinutes;
}

function formatETA(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

function isTripHappeningNow(
  depMinutes: number,
  arrMinutes: number,
  nowMinutes: number,
) {
  const crossesMidnight = arrMinutes < depMinutes;
  return crossesMidnight
    ? nowMinutes >= depMinutes || nowMinutes <= arrMinutes
    : nowMinutes >= depMinutes && nowMinutes <= arrMinutes;
}

function sortTripsClosestToNow(trips: Trip[], nowMinutes: number) {
  return [...trips].sort((a, b) => {
    const depA = timeToMinutes(a.departureTime);
    const depB = timeToMinutes(b.departureTime);
    return (
      minutesUntilDeparture(depA, nowMinutes) -
      minutesUntilDeparture(depB, nowMinutes)
    );
  });
}

function hourLabelFromMinutes(mins: number) {
  const hour24 = Math.floor(mins / 60);
  const period = hour24 >= 12 ? "PM" : "AM";

  let hour12: number;
  if (hour24 === 0) {
    hour12 = 12;
  } else if (hour24 > 12) {
    hour12 = hour24 - 12;
  } else {
    hour12 = hour24;
  }

  return `${hour12} ${period}`;
}

function buildHourSections(trips: Trip[]) {
  const sorted = [...trips].sort(
    (a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime),
  );

  const map = new Map<string, Trip[]>();
  for (const t of sorted) {
    const dep = timeToMinutes(t.departureTime);
    const key = hourLabelFromMinutes(dep);
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }

  const sections = Array.from(map.entries()).map(([title, data]) => ({
    title,
    data,
  }));

  return sections;
}

interface ShuttleSchedulePanelProps {
  readonly onClose: () => void;
}

export function ShuttleSchedulePanel({ onClose }: ShuttleSchedulePanelProps) {
  const { colors } = useColorAccessibility();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [now, setNow] = useState(() => new Date());
  const [direction, setDirection] = useState<DirectionKey>("SGW_to_Loyola");
  const [viewMode, setViewMode] = useState<"upcoming" | "all">("upcoming");

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { scheduleKey, currentMinutes, currentTimeLabel, isWeekend } =
    useMemo(() => {
      const scheduleKey: ScheduleKey = getScheduleKeyForDate(now);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentTimeLabel = now.toLocaleTimeString("en-CA", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return {
        scheduleKey,
        currentMinutes,
        currentTimeLabel,
        isWeekend: scheduleKey === "weekend",
      };
    }, [now]);

  const trips: Trip[] = useMemo(() => {
    if (scheduleKey === "weekend") return [];

    const daySchedule = shuttleSchedule.schedule[scheduleKey];
    return daySchedule[direction] ?? [];
  }, [direction, scheduleKey]);

  const closestSorted = useMemo(
    () => sortTripsClosestToNow(trips, currentMinutes),
    [trips, currentMinutes],
  );

  const nextTrip = closestSorted[0] ?? null;

  const sections = useMemo(() => buildHourSections(trips), [trips]);

  return (
    <View style={styles.overlay}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityLabel="Dismiss schedule"
        accessibilityRole="button"
      />

      <View style={styles.card} collapsable={false}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons
              name="bus-clock"
              size={22}
              color={colors.primary}
            />
            <Text style={styles.title}>Shuttle Schedule</Text>
          </View>

          <View style={styles.currentTimeBadge}>
            <Text style={styles.currentTimeLabel}>Current time</Text>
            <Text style={styles.currentTimeValue}>{currentTimeLabel}</Text>
          </View>

          <Pressable
            testID="close-schedule-button"
            onPress={onClose}
            hitSlop={20}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close schedule"
          >
            <Text style={styles.closeText} allowFontScaling={false}>
              ✕
            </Text>
          </Pressable>
        </View>

        {/* Weekend */}
        {isWeekend ? (
          <View style={styles.weekendMessage}>
            <Text style={styles.weekendText}>
              {shuttleSchedule.schedule.weekend.info}
            </Text>
            <Text style={styles.weekendSubtext}>Mon–Fri 9:15 AM – 7:00 PM</Text>
          </View>
        ) : (
          <>
            {/* Direction Tabs */}
            <View style={styles.tabsRow}>
              <Pressable
                testID="tab-sgw-to-loyola"
                onPress={() => setDirection("SGW_to_Loyola")}
                style={[
                  styles.tab,
                  direction === "SGW_to_Loyola" && styles.tabActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="SGW to Loyola"
              >
                <Text
                  style={[
                    styles.tabText,
                    direction === "SGW_to_Loyola" && styles.tabTextActive,
                  ]}
                >
                  SGW → Loyola
                </Text>
              </Pressable>

              <Pressable
                testID="tab-loyola-to-sgw"
                onPress={() => setDirection("Loyola_to_SGW")}
                style={[
                  styles.tab,
                  direction === "Loyola_to_SGW" && styles.tabActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Loyola to SGW"
              >
                <Text
                  style={[
                    styles.tabText,
                    direction === "Loyola_to_SGW" && styles.tabTextActive,
                  ]}
                >
                  Loyola → SGW
                </Text>
              </Pressable>
            </View>

            {/* Next Departure Card */}
            <View style={styles.nextCard}>
              <View style={styles.nextCardLeft}>
                <Text style={styles.nextCardLabel}>Next departure</Text>
                {nextTrip ? (
                  <Text style={styles.nextCardTime}>
                    {formatTime(nextTrip.departureTime)} –{" "}
                    {formatTime(nextTrip.arrivalTime)}
                  </Text>
                ) : (
                  <Text style={styles.nextCardTime}>No departures found</Text>
                )}
              </View>

              {nextTrip ? (
                <View style={styles.nextCardRight}>
                  <Text style={styles.nextInLabel}>in</Text>
                  <Text style={styles.nextInValue}>
                    {formatETA(
                      minutesUntilDeparture(
                        timeToMinutes(nextTrip.departureTime),
                        currentMinutes,
                      ),
                    )}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* View mode toggles */}
            <View style={styles.modeRow}>
              <Pressable
                testID="pill-upcoming"
                onPress={() => setViewMode("upcoming")}
                style={[
                  styles.modePill,
                  viewMode === "upcoming" && styles.modePillActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Show upcoming departures"
              >
                <Text
                  style={[
                    styles.modePillText,
                    viewMode === "upcoming" && styles.modePillTextActive,
                  ]}
                >
                  Upcoming
                </Text>
              </Pressable>

              <Pressable
                testID="pill-all-times"
                onPress={() => setViewMode("all")}
                style={[
                  styles.modePill,
                  viewMode === "all" && styles.modePillActive,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Show all departures"
              >
                <Text
                  style={[
                    styles.modePillText,
                    viewMode === "all" && styles.modePillTextActive,
                  ]}
                >
                  All times
                </Text>
              </Pressable>
            </View>

            {/* Content */}
            {viewMode === "upcoming" ? (
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.sectionTitle}>Next departures</Text>
                {closestSorted.slice(0, 6).map((t, index) => {
                  const dep = timeToMinutes(t.departureTime);
                  const arr = timeToMinutes(t.arrivalTime);
                  const nowTrip = isTripHappeningNow(dep, arr, currentMinutes);
                  const nextUpcoming = index === 0;

                  let badge: TripBadge;

                  if (nowTrip) {
                    badge = { label: "Now", kind: "now" };
                  } else if (nextUpcoming) {
                    badge = {
                      label: `Next • ${formatETA(minutesUntilDeparture(dep, currentMinutes))}`,
                      kind: "next",
                    };
                  } else {
                    badge = {
                      label: formatETA(
                        minutesUntilDeparture(dep, currentMinutes),
                      ),
                      kind: "eta",
                    };
                  }

                  return (
                    <TripRow
                      key={`${t.departureTime}-${t.arrivalTime}`}
                      trip={t}
                      currentMinutes={currentMinutes}
                      highlight={nowTrip}
                      badge={badge}
                    />
                  );
                })}

                <View style={{ height: spacing.lg }} />
                <Pressable
                  onPress={() => setViewMode("all")}
                  style={styles.linkButton}
                  accessibilityRole="button"
                  accessibilityLabel="View full schedule"
                >
                  <Text style={styles.linkButtonText}>View full schedule</Text>
                </Pressable>
              </ScrollView>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item) =>
                  `${item.departureTime}-${item.arrivalTime}`
                }
                stickySectionHeadersEnabled
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator
                renderSectionHeader={({ section }) => (
                  <View style={styles.hourHeader}>
                    <Text style={styles.hourHeaderText}>{section.title}</Text>
                  </View>
                )}
                renderItem={({ item }) => {
                  const dep = timeToMinutes(item.departureTime);
                  const arr = timeToMinutes(item.arrivalTime);
                  const nowTrip = isTripHappeningNow(dep, arr, currentMinutes);

                  const isNext =
                    nextTrip?.departureTime === item.departureTime &&
                    nextTrip?.arrivalTime === item.arrivalTime;

                  let badge: TripBadge | null;
                  if (nowTrip) {
                    badge = { label: "Now", kind: "now" };
                  } else if (isNext) {
                    badge = {
                      label: `Next • ${formatETA(minutesUntilDeparture(dep, currentMinutes))}`,
                      kind: "next",
                    };
                  } else {
                    badge = null;
                  }

                  return (
                    <TripRow
                      trip={item}
                      currentMinutes={currentMinutes}
                      highlight={nowTrip}
                      badge={badge}
                    />
                  );
                }}
                ListFooterComponent={<View style={{ height: spacing.xl }} />}
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function TripRow({
  trip,
  currentMinutes,
  highlight,
  badge,
}: {
  readonly trip: Trip;
  readonly currentMinutes: number;
  readonly highlight: boolean;
  readonly badge: TripBadge | null;
}) {
  const { colors } = useColorAccessibility();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dep = timeToMinutes(trip.departureTime);
  const eta = minutesUntilDeparture(dep, currentMinutes);

  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.timeCell, highlight && styles.timeCellHighlight]}>
          {formatTime(trip.departureTime)} – {formatTime(trip.arrivalTime)}
        </Text>
        <Text style={styles.subRow}>
          Departs in <Text style={styles.subRowEmph}>{formatETA(eta)}</Text>
        </Text>
      </View>

      {badge ? (
        <View
          style={[
            styles.badge,
            badge.kind === "now" && styles.badgeNow,
            badge.kind === "next" && styles.badgeNext,
            badge.kind === "eta" && styles.badgeEta,
          ]}
        >
          <Text style={styles.badgeText}>{badge.label}</Text>
        </View>
      ) : null}
    </View>
  );
}
