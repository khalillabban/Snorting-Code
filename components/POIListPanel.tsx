import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { OUTDOOR_POI_CATEGORY_MAP } from "../constants/outdoorPOI";
import { useColorAccessibility } from "../contexts/ColorAccessibilityContext";
import type { PlacePOI } from "../services/GooglePlacesService";
import { styles } from "../styles/POIListPanel.styles";
import { formatDistance, haversineMeters } from "../utils/distance";

interface POIListPanelProps {
  pois: PlacePOI[];
  origin: { latitude: number; longitude: number };
  onClose: () => void;
  onSelect?: (poi: PlacePOI) => void;
  loading?: boolean;
  error?: string | null;
  locationUnavailable?: boolean;
  onRetry?: () => void;
}

type POIWithDistance = PlacePOI & { distance: number };

export function POIListPanel({
  pois,
  origin,
  onClose,
  onSelect,
  loading = false,
  error = null,
  locationUnavailable = false,
  onRetry,
}: Readonly<POIListPanelProps>) {
  const { colors } = useColorAccessibility();
  const sorted = useMemo<POIWithDistance[]>(() => {
    return pois
      .map((poi) => ({
        ...poi,
        distance: haversineMeters(
          origin.latitude,
          origin.longitude,
          poi.latitude,
          poi.longitude,
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [pois, origin]);

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer} testID="poi-list-loading">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { marginTop: 12 }]}>
            Searching nearby places…
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer} testID="poi-list-error">
          <MaterialIcons name="error-outline" size={36} color={colors.error} />
          <Text style={[styles.emptyText, { marginTop: 8, color: colors.error, textAlign: "center" }]}>
            {error}
          </Text>
          {onRetry && (
            <Pressable
              onPress={onRetry}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Retry search"
              testID="poi-list-retry"
            >
              <Text style={[styles.retryButtonText, { color: colors.white }]}>Try Again</Text>
            </Pressable>
          )}
        </View>
      );
    }

    if (sorted.length === 0) {
      return (
        <View style={styles.emptyContainer} testID="poi-list-empty">
          <MaterialCommunityIcons name="map-search-outline" size={36} color={colors.gray500} />
          <Text style={[styles.emptyText, { marginTop: 8, color: colors.gray700, textAlign: "center" }]}>
            No places found nearby.
          </Text>
          <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4, color: colors.gray500, textAlign: "center" }]}>
            Try selecting a different category or increasing the search range.
          </Text>
        </View>
      );
    }

    return (
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.placeId}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
        renderItem={({ item }) => {
          const catDef = OUTDOOR_POI_CATEGORY_MAP[item.categoryId];
          return (
            <Pressable
              style={[styles.row, { backgroundColor: colors.offWhite, marginVertical: 6 }]}
              onPress={() => onSelect?.(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatDistance(item.distance)} away`}
              testID={`poi-list-row-${item.placeId}`}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: catDef?.color ?? "#737373" },
                ]}
              >
                <MaterialCommunityIcons
                  name={catDef?.icon ?? "map-marker"}
                  size={16}
                  color={colors.white}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, { color: colors.gray700 }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.vicinity ? (
                  <Text style={[styles.rowVicinity, { color: colors.gray500 }]} numberOfLines={1}>
                    {item.vicinity}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.rowDistance, { color: colors.gray700 }]}>
                {formatDistance(item.distance)}
              </Text>
            </Pressable>
          );
        }}
      />
    );
  };

  return (
    <View style={styles.panel} testID="poi-list-panel">
      <View style={[styles.card, { backgroundColor: colors.white }]}>
        <View
          style={[
            styles.header,
            { backgroundColor: colors.white, borderBottomColor: colors.gray100 },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={[styles.headerTitle, { color: colors.gray700 }]}>Nearby Places</Text>
            {!loading && !error && (
              <Text style={[styles.headerCount, { color: colors.gray500 }]}>({sorted.length})</Text>
            )}
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.gray100, borderRadius: 8 }]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close nearby places list"
            testID="poi-list-close"
          >
            <Text style={[styles.closeText, { color: colors.gray700 }]}>✕</Text>
          </Pressable>
        </View>

        {locationUnavailable && !error && (
          <View style={styles.locationBanner} testID="poi-list-location-banner">
            <MaterialIcons name="location-off" size={14} color={colors.gray500} />
            <Text style={[styles.locationBannerText, { color: colors.gray500 }]}>
              Location unavailable — showing results near campus center
            </Text>
          </View>
        )}

        {renderBody()}
      </View>
    </View>
  );
}
