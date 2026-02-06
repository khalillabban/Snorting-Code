import React from "react";
import { Image, ImageSourcePropType, View, StyleSheet } from "react-native";
import { BuildingService } from "../constants/type";
import { spacing } from "../constants/theme";

const ICON_SIZE = 24;

// ensures consistent order of icons, same as concordia website
const SERVICE_ORDER: BuildingService[] = [
  "information",
  "printer",
  "bike",
  "parking",
  "wheelchair",
];

const iconMap: Record<BuildingService, ImageSourcePropType> = {
  information: require("../assets/images/information-accessibility-icon.png"),
  printer: require("../assets/images/printer-accessibility-icon.png"),
  bike: require("../assets/images/bike-accessibility-icon.png"),
  parking: require("../assets/images/parking-lot-accessibility-icon.png"),
  wheelchair: require("../assets/images/wheelchair-accessibility-icon.png"),
};

interface ServiceIconsProps {
  services: BuildingService[];
  size?: number;
}

export const ServiceIcons = ({ services, size = ICON_SIZE }: ServiceIconsProps) => {
  const ordered = SERVICE_ORDER.filter((s) => services.includes(s));

  if (ordered.length === 0) return null;

  return (
    <View style={styles.iconRow}>
      {ordered.map((service) => (
        <Image
          key={service}
          source={iconMap[service]}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
