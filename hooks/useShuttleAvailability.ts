import { useEffect, useState } from "react";
import type { CampusKey } from "../constants/campuses";
import {
  getShuttleAvailabilityStatus,
  type ShuttleAvailabilityStatus,
} from "../utils/shuttleAvailability";

/** Refresh interval so status updates when crossing into/out of operating hours. */
const REFRESH_MS = 60 * 1000;

/**
 * Hook for time- and location-aware shuttle availability.
 * Updates every minute so status stays correct (e.g. at end of operating hours).
 */
export function useShuttleAvailability(currentCampus: CampusKey | null): ShuttleAvailabilityStatus {
  const [status, setStatus] = useState<ShuttleAvailabilityStatus>(() =>
    getShuttleAvailabilityStatus({ campus: currentCampus }),
  );

  useEffect(() => {
    const update = () => {
      setStatus(getShuttleAvailabilityStatus({ campus: currentCampus }));
    };

    update();
    const interval = setInterval(update, REFRESH_MS);
    return () => clearInterval(interval);
  }, [currentCampus]);

  return status;
}
