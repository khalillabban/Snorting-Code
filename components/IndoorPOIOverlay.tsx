import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { View } from "react-native";
import {
  POI_CATEGORY_MAP,
  type POICategoryId,
} from "../constants/indoorPOI";
import { styles } from "../styles/IndoorPOIOverlay.styles";
import {
  filterPOIsByCategories,
  filterPOIsByFloor,
  type IndoorPOI,
} from "../utils/indoorPOI";

interface FloorStageLayout {
  frameLeft: number;
  frameTop: number;
  scale: number;
}

interface FloorBounds {
  minX: number;
  minY: number;
}

interface IndoorPOIOverlayProps {
  pois: IndoorPOI[];
  floor: number;
  coordinateScale: number;
  stageLayout: FloorStageLayout;
  floorBounds: FloorBounds;
  activeCategories: Set<POICategoryId>;
}

const ICON_CONTAINER_SIZE = 26;
const ICON_SIZE = 16;

export function IndoorPOIOverlay({
  pois,
  floor,
  coordinateScale,
  stageLayout,
  floorBounds,
  activeCategories,
}: Readonly<IndoorPOIOverlayProps>) {
  const activeCategoryIds = useMemo(
    () => Array.from(activeCategories).sort().join(","),
    [activeCategories],
  );

  const visiblePOIs = useMemo(() => {
    const onFloor = filterPOIsByFloor(pois, floor);
    return filterPOIsByCategories(onFloor, activeCategories);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, floor, activeCategoryIds]);

  if (visiblePOIs.length === 0) return null;

  return (
    <View
      style={styles.overlayContainer}
      pointerEvents="none"
      testID="poi-overlay"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {visiblePOIs.map((poi) => {
        const scaledX = poi.x * coordinateScale;
        const scaledY = poi.y * coordinateScale;
        const screenX =
          stageLayout.frameLeft +
          (scaledX - floorBounds.minX) * stageLayout.scale -
          ICON_CONTAINER_SIZE / 2;
        const screenY =
          stageLayout.frameTop +
          (scaledY - floorBounds.minY) * stageLayout.scale -
          ICON_CONTAINER_SIZE / 2;

        const catDef = POI_CATEGORY_MAP[poi.category];
        if (!catDef) return null;

        return (
          <View
            key={poi.id}
            testID={`poi-marker-${poi.id}`}
            style={[
              styles.iconContainer,
              {
                left: screenX,
                top: screenY,
                backgroundColor: catDef.color,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={catDef.icon}
              size={ICON_SIZE}
              color="#fff"
            />
          </View>
        );
      })}
    </View>
  );
}
