import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { borderRadius, colors, spacing, typography } from "../constants/theme";
import { Buildings } from "../constants/type";
import { ServiceIcons } from "./AccessibilityIcons";

interface BuildingInfoPopupProps {
  building: Buildings | null;
  onClose: () => void;
}

export const BuildingInfoPopup = ({ building, onClose }: BuildingInfoPopupProps) => {
  if (!building) return null;

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
          {building.services && building.services.length > 0 && (
            <ServiceIcons services={building.services} />
          )}
        </View>

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
    marginVertical: spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
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
});