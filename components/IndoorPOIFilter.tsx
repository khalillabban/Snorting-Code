import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
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
                size={16}
                color={isActive ? "#fff" : cat.color}
              />
              <Text
                style={[
                  styles.chipLabel,
                  isActive && styles.chipLabelActive,
                ]}
              >
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
