import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, View } from "react-native";
import {
  POI_CATEGORIES,
  type POICategoryId,
} from "../constants/indoorPOI";
import { styles } from "../styles/IndoorPOIFilter.styles";

interface IndoorPOIFilterProps {
  activeCategories: Set<POICategoryId>;
  onToggle: (categoryId: POICategoryId) => void;
}

export function IndoorPOIFilter({
  activeCategories,
  onToggle,
}: IndoorPOIFilterProps) {
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
              onPress={() => onToggle(cat.id)}
              style={[
                styles.chip,
                isActive && { backgroundColor: cat.color, borderColor: cat.color },
              ]}
            >
              <MaterialCommunityIcons
                name={cat.icon as React.ComponentProps<typeof MaterialCommunityIcons>["name"]}
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
