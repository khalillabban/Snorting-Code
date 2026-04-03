import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Pressable, View } from "react-native";
import { POI_CATEGORIES, type POICategoryId } from "../constants/indoorPOI";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { styles } from "../styles/IndoorPOIFilter.styles";

interface IndoorPOIFilterProps {
  activeCategories: Set<POICategoryId>;
  onToggle: (categoryId: POICategoryId) => void;
  onFirstInteraction?: () => void;
}

export function IndoorPOIFilter({
  activeCategories,
  onToggle,
  onFirstInteraction,
}: Readonly<IndoorPOIFilterProps>) {
  const { colors, mode } = useColorAccessibility();
  const hasInteracted = useRef(false);

  const getCategoryColor = (originalColor: string): string => {
    if (mode === "classic") return originalColor;
    const colorMap: Record<string, string> = {
      "#1565c0": colors.route2,
      "#0097a7": colors.info,
      "#6a1b9a": colors.routeShuttle,
      "#2e7d32": colors.routeTransit,
      "#e65100": colors.warning,
    };
    return colorMap[originalColor] || colors.primary;
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.white }]} testID="poi-filter-bar">
      <View style={styles.row}>
        {POI_CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.id);
          const categoryColor = getCategoryColor(cat.color);
          return (
            <Pressable
              key={cat.id}
              testID={`poi-filter-chip-${cat.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${isActive ? "Hide" : "Show"} ${cat.label}`}
              accessibilityHint="Toggles this point of interest category on the map"
              onPress={() => {
                // ── Task 11: fire once on first ever tap
                if (!hasInteracted.current) {
                  hasInteracted.current = true;
                  onFirstInteraction?.();
                }
                onToggle(cat.id);
              }}
              style={[
                styles.chip,
                { borderColor: colors.gray300, backgroundColor: colors.white },
                isActive && {
                  backgroundColor: categoryColor,
                  borderColor: categoryColor,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={14}
                color={isActive ? colors.white : categoryColor}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
