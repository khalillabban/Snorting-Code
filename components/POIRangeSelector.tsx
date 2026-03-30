import { Pressable, Text, View } from "react-native";
import { POI_RANGE_OPTIONS, type POIRangeOption } from "../constants/poiRange";
import { styles } from "../styles/POIRangeSelector.styles";

interface POIRangeSelectorProps {
  selected: POIRangeOption;
  onSelect: (option: POIRangeOption) => void;
}

export function POIRangeSelector({
  selected,
  onSelect,
}: Readonly<POIRangeSelectorProps>) {
  return (
    <View style={styles.wrapper} testID="poi-range-selector">
      <Text style={styles.label}>Range:</Text>
      <View style={styles.buttonsRow}>
        {POI_RANGE_OPTIONS.map((opt) => {
          const isActive = selected.id === opt.id;
          return (
            <Pressable
              key={opt.id}
              testID={`poi-range-${opt.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Set search radius to ${opt.label}`}
              onPress={() => onSelect(opt)}
              style={[styles.button, isActive && styles.buttonActive]}
            >
              <Text
                style={[
                  styles.buttonLabel,
                  isActive && styles.buttonLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
