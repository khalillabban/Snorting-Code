import { useCallback, useMemo, useState } from "react";
import type { Floor, Room } from "../utils/IndoorMapComposite";

export type IndoorRoomSearchQueryMode = "number" | "name" | "auto";

export type IndoorRoomSearchState = Readonly<{
  query: string;
  mode: IndoorRoomSearchQueryMode;
  isSearching: boolean;
  selectedRoom: Room | null;
  selectedFloor: number | null;
  error: string | null;
}>;

export type UseIndoorRoomSearchOptions = Readonly<{
  floorComposite: Floor | null;
  buildingCode: string;
}>;

export type UseIndoorRoomSearchResult = IndoorRoomSearchState & {
  setQuery: (next: string) => void;
  setMode: (next: IndoorRoomSearchQueryMode) => void;
  clearSelection: () => void;
  search: () => void;
};

/**
 * Skeleton hook for US-4.4: locating specific indoor rooms by number or name.
 *
 * This hook will eventually:
 * - Search through indoor map data for a matching room.
 * - Decide which floor the room is on.
 * - Drive highlighting / floor switching in the UI.
 *
 * For now it only manages local state and exposes a no-op `search` function
 * so that screens and components can be wired up without full behavior.
 */
export function useIndoorRoomSearch(
  options: UseIndoorRoomSearchOptions,
): UseIndoorRoomSearchResult {
  const { floorComposite } = options;

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<IndoorRoomSearchQueryMode>("auto");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasData = useMemo(() => Boolean(floorComposite), [floorComposite]);

  const clearSelection = useCallback(() => {
    setSelectedRoom(null);
    setSelectedFloor(null);
    setError(null);
  }, []);

  const search = useCallback(() => {
    // Skeleton implementation for now.
    // Real implementation will:
    // - Inspect `floorComposite` and/or a building-level composite.
    // - Try to match `query` against room number or name.
    // - Set `selectedRoom`, `selectedFloor`, and clear or set `error`.
    if (!hasData) {
      setError("Indoor map data is not available yet.");
      return;
    }

    setIsSearching(true);
    // Placeholder: no-op search. This is where room lookup logic will go.
    setIsSearching(false);
  }, [hasData]);

  return {
    query,
    mode,
    isSearching,
    selectedRoom,
    selectedFloor,
    error,
    setQuery,
    setMode,
    clearSelection,
    search,
  };
}

