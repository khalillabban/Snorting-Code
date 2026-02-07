import React from "react";
import { Image, ImageSourcePropType, StyleSheet, View } from "react-native";
import { spacing } from "../constants/theme";
import { BuildingIcon } from "../constants/type";

const ICON_SIZE = 24;

// ensures consistent order of icons, same as concordia website
const ICON_ORDER: BuildingIcon[] = [
  "information",
  "printer",
  "bike",
  "parking",
  "wheelchair",
];

const iconMap: Record<BuildingIcon, ImageSourcePropType> = {
  information: require("../assets/images/information-accessibility-icon.png"),
  printer: require("../assets/images/printer-accessibility-icon.png"),
  bike: require("../assets/images/bike-accessibility-icon.png"),
  parking: require("../assets/images/parking-lot-accessibility-icon.png"),
  wheelchair: require("../assets/images/wheelchair-accessibility-icon.png"),
};

interface BuildingIconsProps {
  icons: BuildingIcon[];
  size?: number;
}

export const BuildingIcons = ({ icons, size = ICON_SIZE }: BuildingIconsProps) => {
  const ordered = ICON_ORDER.filter((s) => icons.includes(s));

  if (ordered.length === 0) return null;

  return (
    <View style={styles.iconRow} testID="building-icons-row">
      {ordered.map((service) => (
        <Image
          key={service}
          source={iconMap[service]}
          style={{ width: size, height: size }}
          resizeMode="contain"
          testID={`building-icon-${service}`}
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
