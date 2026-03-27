import { useCallback, useState } from "react";
import type { OutdoorPOICategoryId } from "../constants/outdoorPOI";
import {
  fetchNearbyPOIsForCategories,
  type PlacePOI,
} from "../services/GooglePlacesService";

export function useNearbyPOIs() {
  const [pois, setPois] = useState<PlacePOI[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (
      location: { latitude: number; longitude: number },
      radiusMeters: number,
      categories: OutdoorPOICategoryId[],
    ) => {
      if (categories.length === 0) {
        setPois([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const results = await fetchNearbyPOIsForCategories(
          location.latitude,
          location.longitude,
          radiusMeters,
          categories,
        );
        setPois(results);
      } catch (err) {
        setPois([]);
        setError(
          err instanceof Error ? err.message : "Failed to fetch nearby places",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clear = useCallback(() => {
    setPois([]);
    setError(null);
  }, []);

  return { pois, loading, error, search, clear };
}
