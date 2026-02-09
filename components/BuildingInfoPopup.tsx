import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Buildings } from "../constants/type";
import { styles } from "../styles/BuildingInfoPopup.styles";
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
    ? building.departments ?? []
    : activeTab === "services"
      ? building.services ?? []
      : [];

  return (
    <View style={styles.overlayWrapper} pointerEvents="box-none">
      <View style={styles.card}>
        
        {/* TODO: Add drag handle if we implement a bottom-sheet interaction.*/}

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{building.displayName}</Text>
            <Text style={styles.address}>{building.address}</Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close building info"
          >
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeTab === "departments" }}
                  accessibilityLabel="Show departments"
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
                  accessibilityState={{ selected: activeTab === "services" }}
                  accessibilityLabel="Show services"
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

            {activeTab && activeList.length > 0 && (
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
          onPress={() => {/* Add navigation logic in epic2*/ }}
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${building.displayName}`}
        >
          <Text style={styles.actionButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};
