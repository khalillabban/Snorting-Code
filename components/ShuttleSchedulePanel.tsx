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
import { colors, spacing, typography } from "../constants/theme";
import {
  getScheduleKeyForDate,
  type ScheduleKey,
} from "../utils/shuttleAvailability";

type Trip = { departureTime: string; arrivalTime: string };
type DirectionKey = "SGW_to_Loyola" | "Loyola_to_SGW";

const MINUTES_PER_DAY = 24 * 60;

/** Format "HH:mm" to "h:mm AM/PM" */
function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
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
  nowMinutes: number
) {
  const crossesMidnight = arrMinutes < depMinutes;
  return crossesMidnight
    ? nowMinutes >= depMinutes || nowMinutes <= arrMinutes
    : nowMinutes >= depMinutes && nowMinutes <= arrMinutes;
}

/** Sort so the closest upcoming departure to now is first. */
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
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  return `${hour12} ${period}`;
}

function buildHourSections(trips: Trip[], nowMinutes: number) {
  // For "All", it’s nicer to show them in time-of-day order (not wrapped by "closest")
  const sorted = [...trips].sort(
    (a, b) => timeToMinutes(a.departureTime) - timeToMinutes(b.departureTime)
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

  // Put the “current/next” hour(s) first if you want by reordering,
  // but keeping natural order is usually easier to scan.
  // We’ll keep natural order and just highlight “Now/Next”.
  return sections;
}

interface ShuttleSchedulePanelProps {
  onClose: () => void;
}

export function ShuttleSchedulePanel({ onClose }: ShuttleSchedulePanelProps) {
  const [now, setNow] = useState(() => new Date());
  const [direction, setDirection] = useState<DirectionKey>("SGW_to_Loyola");
  const [viewMode, setViewMode] = useState<"upcoming" | "all">("upcoming");

  // Update once per minute (smooth enough, less rerendering than every second)
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
    [trips, currentMinutes]
  );

  const nextTrip = closestSorted[0] ?? null;

  const sections = useMemo(() => buildHourSections(trips, currentMinutes), [
    trips,
    currentMinutes,
  ]);

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
                        currentMinutes
                      )
                    )}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* View mode toggles */}
            <View style={styles.modeRow}>
              <Pressable
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

                  return (
                    <TripRow
                      key={`${t.departureTime}-${t.arrivalTime}`}
                      trip={t}
                      currentMinutes={currentMinutes}
                      highlight={nowTrip}
                      badge={
                        nowTrip
                          ? { label: "Now", kind: "now" }
                          : nextUpcoming
                            ? {
                              label: `Next • ` + formatETA(minutesUntilDeparture(dep, currentMinutes)),
                              kind: "next",
                            }
                            : {
                              label: formatETA(minutesUntilDeparture(dep, currentMinutes)),
                              kind: "eta",
                            }
                      }
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
                renderItem={({ item, index, section }) => {
                  const dep = timeToMinutes(item.departureTime);
                  const arr = timeToMinutes(item.arrivalTime);
                  const nowTrip = isTripHappeningNow(dep, arr, currentMinutes);

                  // If the “Next” trip happens to live in this hour group, we’ll show Next there.
                  const isNext =
                    nextTrip?.departureTime === item.departureTime &&
                    nextTrip?.arrivalTime === item.arrivalTime;

                  return (
                    <TripRow
                      trip={item}
                      currentMinutes={currentMinutes}
                      highlight={nowTrip}
                      badge={
                        nowTrip
                          ? { label: "Now", kind: "now" }
                          : isNext
                            ? {
                              label: `Next • ` + formatETA(minutesUntilDeparture(dep, currentMinutes)),
                              kind: "next",
                            }
                            : null
                      }
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
  trip: Trip;
  currentMinutes: number;
  highlight: boolean;
  badge: null | { label: string; kind: "now" | "next" | "eta" };
}) {
  const dep = timeToMinutes(trip.departureTime);
  const eta = minutesUntilDeparture(dep, currentMinutes);

  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.timeCell, highlight && styles.timeCellHighlight]}>
          {formatTime(trip.departureTime)} – {formatTime(trip.arrivalTime)}
        </Text>
        <Text style={styles.subRow}>
          Departs in{" "}
          <Text style={styles.subRowEmph}>
            {formatETA(eta)}
          </Text>
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

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    zIndex: 20,
  },
  backdrop: {
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 0,
  },
  card: {
    zIndex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "80%",
    paddingBottom: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gray100,
    marginTop: 8,
    marginBottom: 6,
  },

  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: spacing.xs,
  },
  title: {
    ...typography.heading,
    color: colors.primaryDark,
  },
  currentTimeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 2,
  },
  currentTimeLabel: {
    fontSize: 10,
    color: colors.white,
    opacity: 0.9,
  },
  currentTimeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
  },
  closeButton: {
    padding: 6,
    marginTop: -2,
  },
  closeText: {
    fontSize: 20,
    color: colors.gray700,
  },

  weekendMessage: {
    padding: spacing.lg,
    alignItems: "center",
  },
  weekendText: {
    ...typography.body,
    color: colors.gray700,
    textAlign: "center",
  },
  weekendSubtext: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.gray500,
  },

  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.gray100,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontWeight: "700",
    color: colors.gray700,
  },
  tabTextActive: {
    color: colors.white,
  },

  nextCard: {
    marginTop: spacing.md,
    marginHorizontal: spacing.md,
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.primaryTransparent,
    borderWidth: 1,
    borderColor: colors.primaryBarelyTransparent ?? colors.gray100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  nextCardLeft: {
    flex: 1,
  },
  nextCardLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDark,
    opacity: 0.9,
    marginBottom: 4,
  },
  nextCardTime: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  nextCardRight: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  nextInLabel: {
    fontSize: 11,
    color: colors.gray500,
    fontWeight: "700",
  },
  nextInValue: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.primaryDark,
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  modePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.gray100,
    alignItems: "center",
  },
  modePillActive: {
    backgroundColor: colors.primary,
  },
  modePillText: {
    fontWeight: "800",
    color: colors.gray700,
  },
  modePillTextActive: {
    color: colors.white,
  },

  scroll: {
    marginTop: spacing.sm,
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.gray700,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  hourHeader: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  hourHeaderText: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.gray500,
    letterSpacing: 0.3,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray100,
    backgroundColor: colors.white,
  },
  rowHighlight: {
    backgroundColor: colors.primaryTransparent,
    borderColor: colors.primary,
  },
  rowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  timeCell: {
    fontSize: 15,
    color: colors.gray700 ?? colors.gray700,
    fontWeight: "700",
  },
  timeCellHighlight: {
    color: colors.primaryDark,
  },
  subRow: {
    marginTop: 4,
    fontSize: 12,
    color: colors.gray500,
    fontWeight: "600",
  },
  subRowEmph: {
    color: colors.primaryDark,
    fontWeight: "900",
  },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeNow: {
    backgroundColor: colors.primary,
  },
  badgeNext: {
    backgroundColor: colors.gray700,
  },
  badgeEta: {
    backgroundColor: colors.gray100,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.white,
  },

  linkButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  linkButtonText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: 14,
  },
});
