import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { shuttleSchedule } from "../constants/shuttle";
import { colors, spacing, typography } from "../constants/theme";
import { getScheduleKeyForDate, type ScheduleKey } from "../utils/shuttleAvailability";

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

const MINUTES_PER_DAY = 24 * 60;

/** Sort times so the next upcoming departure (closest to now) is first. */
function sortTimesByClosestToNow(
  times: { departureTime: string; arrivalTime: string }[],
  currentMinutes: number
): { departureTime: string; arrivalTime: string }[] {
  return [...times].sort((a, b) => {
    const depA = timeToMinutes(a.departureTime);
    const depB = timeToMinutes(b.departureTime);
    const minsUntilA = depA >= currentMinutes
      ? depA - currentMinutes
      : MINUTES_PER_DAY - currentMinutes + depA;
    const minsUntilB = depB >= currentMinutes
      ? depB - currentMinutes
      : MINUTES_PER_DAY - currentMinutes + depB;
    return minsUntilA - minsUntilB;
  });
}

interface ShuttleSchedulePanelProps {
  onClose: () => void;
}

export function ShuttleSchedulePanel({ onClose }: ShuttleSchedulePanelProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const scheduleKey: ScheduleKey = getScheduleKeyForDate(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeLabel = now.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const isWeekend = scheduleKey === "weekend";

  return (
    <View style={styles.overlay}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        accessibilityLabel="Dismiss schedule"
        accessibilityRole="button"
      />
      <View style={styles.card} collapsable={false}>
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <MaterialCommunityIcons name="bus-clock" size={24} color={colors.primary} />
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
            <Text style={styles.closeText} allowFontScaling={false}>✕</Text>
          </Pressable>
        </View>

        {isWeekend ? (
          <View style={styles.weekendMessage}>
            <Text style={styles.weekendText}>
              {shuttleSchedule.schedule.weekend.info}
            </Text>
            <Text style={styles.weekendSubtext}>Mon–Fri 9:15 AM – 7:00 PM</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <ScheduleSection
              title="SGW → Loyola"
              times={shuttleSchedule.schedule[scheduleKey].SGW_to_Loyola}
              currentMinutes={currentMinutes}
            />
            <ScheduleSection
              title="Loyola → SGW"
              times={shuttleSchedule.schedule[scheduleKey].Loyola_to_SGW}
              currentMinutes={currentMinutes}
            />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function ScheduleSection({
  title,
  times,
  currentMinutes,
}: {
  title: string;
  times: { departureTime: string; arrivalTime: string }[];
  currentMinutes: number;
}) {
  const sortedTimes = sortTimesByClosestToNow(times, currentMinutes);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sortedTimes.map((t, index) => {
        const depMinutes = timeToMinutes(t.departureTime);
        const arrMinutes = timeToMinutes(t.arrivalTime);
        const isCurrent =
          currentMinutes >= depMinutes && currentMinutes <= arrMinutes;
        const isNextUpcoming = index === 0; // first row is always the closest/next
        return (
          <View
            key={`${t.departureTime}-${t.arrivalTime}`}
            style={[styles.row, isCurrent && styles.rowHighlight]}
          >
            <Text style={[styles.timeCell, isCurrent && styles.timeCellHighlight]}>
              {formatTime(t.departureTime)} – {formatTime(t.arrivalTime)}
            </Text>
            <View style={styles.rowBadges}>
              {isCurrent && (
                <View style={styles.nowBadge}>
                  <Text style={styles.nowBadgeText}>Now</Text>
                </View>
              )}
              {isNextUpcoming && !isCurrent && (
                <View style={styles.nextBadge}>
                  <Text style={styles.nextBadgeText}>Next</Text>
                </View>
              )}
            </View>
          </View>
        );
      })}
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
    zIndex: 0,
  },
  card: {
    zIndex: 1,
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "70%",
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    ...typography.heading,
    color: colors.primaryDark,
  },
  currentTimeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 8,
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
    padding: 4,
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
  scroll: {
    maxHeight: 400,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primaryDark,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    marginBottom: 4,
  },
  rowHighlight: {
    backgroundColor: colors.primaryTransparent,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  timeCell: {
    fontSize: 15,
    color: colors.gray700,
  },
  timeCellHighlight: {
    fontWeight: "600",
    color: colors.primaryDark,
  },
  nowBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nowBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },
  rowBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nextBadge: {
    backgroundColor: colors.gray500,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nextBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.white,
  },
});
