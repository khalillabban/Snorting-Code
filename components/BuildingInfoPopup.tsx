import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing, typography } from "../constants/theme";
import { Buildings } from "../constants/type";
import { BuildingIcons } from "./AccessibilityIcons";

type TabKey = "departments" | "services";

interface BuildingInfoPopupProps {
  building: Buildings | null;
  onClose: () => void;
}

export const BuildingInfoPopup = ({ building, onClose }: BuildingInfoPopupProps) => {
  const [activeTab, setActiveTab] = useState<TabKey | null>(null);

  // reset active tab when building changes
  useEffect(() => {
    setActiveTab(null);
  }, [building]);

  if (!building) return null;

  const hasDepartments = !!building.departments && building.departments.length > 0;
  const hasServices = !!building.services && building.services.length > 0;
  const hasTabs = hasDepartments || hasServices;

  const handleTabPress = (tab: TabKey) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  const activeList =
    activeTab === "departments"
      ? building.departments
      : activeTab === "services"
        ? building.services
        : undefined;

  return (
    <View style={styles.overlayWrapper} pointerEvents="box-none">
      <View style={styles.card}>
        {/* Top Handle Bar (add or remove later)
        <View style={styles.dragHandle} />*/}

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{building.displayName}</Text>
            <Text style={styles.address}>{building.address}</Text>
          </View>
          
          <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={10}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <View style={styles.infoLeft}>
            <Text style={styles.label}>Campus:</Text>
            <Text style={styles.value}>{building.campusName.toUpperCase()}</Text>
          </View>
          {building.icons && building.icons.length > 0 && (
            <BuildingIcons icons={building.icons} />
          )}
        </View>

        {hasTabs && (
          <>
            <View style={styles.tabRow}>
              {hasDepartments && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.tab,
                    !hasServices && styles.tabFull,
                    activeTab === "departments" && styles.tabActive,
                  ]}
                  onPress={() => handleTabPress("departments")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "departments" && styles.tabTextActive,
                    ]}
                  >
                    Departments
                  </Text>
                </TouchableOpacity>
              )}
              {hasServices && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[
                    styles.tab,
                    !hasDepartments && styles.tabFull,
                    activeTab === "services" && styles.tabActive,
                  ]}
                  onPress={() => handleTabPress("services")}
                >
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === "services" && styles.tabTextActive,
                    ]}
                  >
                    Services
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {activeTab && activeList && activeList.length > 0 && (
              <ScrollView style={styles.tabContent} nestedScrollEnabled>
                {activeList.map((item, index) => (
                  <Text key={index} style={styles.tabItem}>
                    {item}
                  </Text>
                ))}
              </ScrollView>
            )}
          </>
        )}

        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.actionButton}
          onPress={() => {/* Add navigation logic in epic2*/}}
        >
          <Text style={styles.actionButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({
  overlayWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    padding: spacing.md,
    zIndex: 1000,
    elevation: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20, 
    marginBottom: spacing.lg,
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: colors.gray300,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    color: colors.primary,
  },
  address: {
    ...typography.caption,
    color: colors.gray500,
    marginTop: 4,
  },
  closeButton: {
    backgroundColor: colors.offWhite,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
  },
  closeText: {
    fontSize: 16,
    color: colors.gray700,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray100,
    marginBottom: spacing.md,
    marginTop: -spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  infoLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  label: {
    ...typography.body,
    fontWeight: "600",
    marginRight: 8,
  },
  value: {
    ...typography.body,
    color: colors.gray700,
  },
  actionButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  actionButtonText: {
    ...typography.button,
    color: colors.white,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.offWhite,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.gray100,
  },
  tabFull: {
    flex: 1,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    fontWeight: "600",
    color: colors.gray700,
  },
  tabTextActive: {
    color: colors.white,
  },
  tabContent: {
    maxHeight: 110,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  tabItem: {
    ...typography.body,
    color: colors.gray700,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryTransparent,
    backgroundColor: colors.offWhite,
    borderRadius: borderRadius.sm,
    textAlign: "left",
  },
});