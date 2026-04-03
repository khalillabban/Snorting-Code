import { Pressable, Text, View } from "react-native";
import { POI_RANGE_OPTIONS, type POIRangeOption } from "../constants/poiRange";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import { styles } from "../styles/POIRangeSelector.styles";

interface POIRangeSelectorProps {
  selected: POIRangeOption;
  onSelect: (option: POIRangeOption) => void;
}

export function POIRangeSelector({
  selected,
  onSelect,
}: Readonly<POIRangeSelectorProps>) {
    const { colors } = useColorAccessibility();

  return (
    <View style={[styles.wrapper, { backgroundColor: colors.white }]} testID="poi-range-selector">
      <Text style={[styles.label, { color: colors.gray500 }]}>Range:</Text>
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
              style={[
                styles.button,
                { borderColor: colors.gray300, backgroundColor: colors.white },
                isActive && { 
                  backgroundColor: colors.primary, 
                  borderColor: colors.primary 
                },
              ]}
            >
              <Text
                style={[
                  styles.buttonLabel,
                                    { color: colors.gray700 },
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
