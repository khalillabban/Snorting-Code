import React, { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Buildings } from "../constants/type";
import { styles } from "../styles/BuildingInfoPopup.styles";
import { BuildingIcons } from "./AccessibilityIcons";

type TabKey = "departments" | "services";

interface BuildingInfoPopupProps {
  building: Buildings | null;
  onClose: () => void;
  onSetAsStart?: (building: Buildings) => void;
  onSetAsDestination?: (building: Buildings) => void;
  onSetAsMyLocation?: (building: Buildings) => void;
  hasIndoorMap?: boolean;
  onViewIndoorMap?: () => void;
}

export const BuildingInfoPopup = ({
  building,
  onClose,
  onSetAsStart,
  onSetAsDestination,
  onSetAsMyLocation,
  hasIndoorMap,
  onViewIndoorMap,
}: BuildingInfoPopupProps) => {
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

  let activeList: string[];
  if (activeTab === "departments") {
    activeList = building.departments ?? [];
  } else if (activeTab === "services") {
    activeList = building.services ?? [];
  } else {
    activeList = [];
  }

  return (
    <View style={styles.overlayWrapper} pointerEvents="box-none">
      <View style={styles.card}>
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
                {activeList.map((item) => (
                  <Text key={item} style={styles.tabItem}>
                    {item}
                  </Text>
                ))}
              </ScrollView>
            )}
          </>
        )}

        <View style={styles.navButtonsRow}>
          <TouchableOpacity
            testID="popup-set-as-start"
            activeOpacity={0.8}
            style={[styles.actionButton, styles.actionButtonHalf]}
            onPress={() => onSetAsStart?.(building)}
            accessibilityRole="button"
            accessibilityLabel={`Set ${building.displayName} as starting point`}
          >
            <Text style={styles.actionButtonText}>Set as start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="popup-set-as-destination"
            activeOpacity={0.8}
            style={[styles.actionButton, styles.actionButtonHalf]}
            onPress={() => onSetAsDestination?.(building)}
            accessibilityRole="button"
            accessibilityLabel={`Set ${building.displayName} as destination`}
          >
            <Text style={styles.actionButtonText}>Set as destination</Text>
          </TouchableOpacity>
        </View>
        {onSetAsMyLocation && (
          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.actionButton, styles.demoButton]}
            onPress={() => onSetAsMyLocation(building)}
            accessibilityRole="button"
            accessibilityLabel={`Use ${building.displayName} as my location (demo)`}
          >
            <Text style={styles.demoButtonText}>Set as my location (demo)</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
