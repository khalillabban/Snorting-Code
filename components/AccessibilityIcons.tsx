import React, { useMemo } from "react";
import { Image, ImageSourcePropType, View } from "react-native";
import { BuildingIcon } from "../constants/type";
import { styles } from "../styles/AccessibilityIcons.styles";

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

interface AccessibilityIconsProps {
  icons: BuildingIcon[];
  size?: number;
}

/**
 * Displays building service icons in a fixed, Concordia-approved order.
 * Icons render only if present in the `icons` prop.
 */
export const BuildingIcons = ({ icons, size = ICON_SIZE }: AccessibilityIconsProps) => {
  const ordered = useMemo(
    () => ICON_ORDER.filter((s) => icons.includes(s)),
    [icons]
  );

  if (ordered.length === 0) return null;

  return (
    <View style={styles.iconRow} testID="building-icons-row">
      {ordered.map((service) => (
        <Image
          key={service}
          source={iconMap[service]}
          style={{ width: size, height: size }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel={`${service} available`}
          testID={`building-icon-${service}`}
        />
      ))}
    </View>
  );
};

