import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import {
    OUTDOOR_POI_CATEGORIES,
    type OutdoorPOICategoryId,
} from "../constants/outdoorPOI";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { styles } from "../styles/OutdoorPOIFilter.styles";

interface OutdoorPOIFilterProps {
  activeCategories: Set<OutdoorPOICategoryId>;
  onToggle: (categoryId: OutdoorPOICategoryId) => void;
}

export function OutdoorPOIFilter({
  activeCategories,
  onToggle,
}: Readonly<OutdoorPOIFilterProps>) {
    const { colors, mode } = useColorAccessibility();

    const getCategoryColor = (originalColor: string): string => {
      if (mode === "classic") return originalColor;
      const colorMap: Record<string, string> = {
        "#e65100": colors.accent1,
        "#6d4c41": colors.route1,
        "#1565c0": colors.route2,
        "#2e7d32": colors.route3,
        "#c62828": colors.route4,
        "#0277bd": colors.accent2,
      };
      return colorMap[originalColor] || colors.primary;
    };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.white }]} testID="outdoor-poi-filter-bar">
      <View style={styles.row}>
        {OUTDOOR_POI_CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.id);
                    const categoryColor = getCategoryColor(cat.color);
          return (
            <Pressable
              key={cat.id}
              testID={`outdoor-poi-chip-${cat.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${isActive ? "Hide" : "Show"} ${cat.label}`}
              accessibilityHint="Toggles this point of interest category on the map"
              onPress={() => onToggle(cat.id)}
              style={[
                styles.chip,
                { borderColor: colors.gray300, backgroundColor: colors.white },
                isActive && { backgroundColor: categoryColor, borderColor: categoryColor },
              ]}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={16}
                color={isActive ? colors.white : categoryColor}
              />
              <Text
                style={[
                  styles.chipLabel,
                  isActive && styles.chipLabelActive,
                ]}
                numberOfLines={1}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
