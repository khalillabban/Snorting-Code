import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef } from "react";
import { Pressable, View } from "react-native";
import { POI_CATEGORIES, type POICategoryId } from "../constants/indoorPOI";
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
  const hasInteracted = useRef(false);

  return (
    <View style={styles.wrapper} testID="poi-filter-bar">
      <View style={styles.row}>
        {POI_CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.id);
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
                isActive && {
                  backgroundColor: cat.color,
                  borderColor: cat.color,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={14}
                color={isActive ? "#fff" : cat.color}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
