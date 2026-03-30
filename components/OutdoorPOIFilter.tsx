import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import {
  OUTDOOR_POI_CATEGORIES,
  type OutdoorPOICategoryId,
} from "../constants/outdoorPOI";
import { styles } from "../styles/OutdoorPOIFilter.styles";

interface OutdoorPOIFilterProps {
  activeCategories: Set<OutdoorPOICategoryId>;
  onToggle: (categoryId: OutdoorPOICategoryId) => void;
}

export function OutdoorPOIFilter({
  activeCategories,
  onToggle,
}: Readonly<OutdoorPOIFilterProps>) {
  return (
    <View style={styles.wrapper} testID="outdoor-poi-filter-bar">
      <View style={styles.row}>
        {OUTDOOR_POI_CATEGORIES.map((cat) => {
          const isActive = activeCategories.has(cat.id);
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
                isActive && { backgroundColor: cat.color, borderColor: cat.color },
              ]}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={16}
                color={isActive ? "#fff" : cat.color}
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
