import React from "react";
import {
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { styles } from "../styles/FloorSwitcher.styles";

type Props = {
  readonly floors: number[];
  readonly activeFloor: number;
  readonly onFloorChange: (floor: number) => void;
  readonly onExit: () => void;
};

export function FloorSwitcher({
  floors,
  activeFloor,
  onFloorChange,
  onExit,
}: Props) {
  return (
    <>
      {/* Floor level pill — right side */}
      <View style={styles.pill}>
        <Text style={styles.pillLabel}>Floor</Text>
        {[...floors].reverse().map((floor) => (
          <TouchableOpacity
            key={floor}
            style={[
              styles.floorBtn,
              activeFloor === floor && styles.floorBtnActive,
            ]}
            onPress={() => onFloorChange(floor)}
            accessibilityLabel={`Switch to floor ${floor}`}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.floorBtnText,
                activeFloor === floor && styles.floorBtnTextActive,
              ]}
            >
              {floor}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}
