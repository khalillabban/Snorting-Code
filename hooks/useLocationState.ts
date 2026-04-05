import { useState } from "react";
import { Buildings } from "../constants/type";
import { IndoorRoomRecord } from "../utils/indoorBuildingPlan";

interface UseLocationStateReturn {
  startLoc: string;
  setStartLoc: (value: string) => void;
  destLoc: string;
  setDestLoc: (value: string) => void;
  startBuilding: Buildings | null;
  setStartBuilding: (value: Buildings | null) => void;
  destBuilding: Buildings | null;
  setDestBuilding: (value: Buildings | null) => void;
  startRoom: IndoorRoomRecord | null;
  setStartRoom: (value: IndoorRoomRecord | null) => void;
  endRoom: IndoorRoomRecord | null;
  setEndRoom: (value: IndoorRoomRecord | null) => void;
}

export function useLocationState(): UseLocationStateReturn {
  const [startLoc, setStartLoc] = useState("");
  const [destLoc, setDestLoc] = useState("");
  const [startBuilding, setStartBuilding] = useState<Buildings | null>(null);
  const [destBuilding, setDestBuilding] = useState<Buildings | null>(null);
  const [startRoom, setStartRoom] = useState<IndoorRoomRecord | null>(null);
  const [endRoom, setEndRoom] = useState<IndoorRoomRecord | null>(null);

  return {
    startLoc,
    setStartLoc,
    destLoc,
    setDestLoc,
    startBuilding,
    setStartBuilding,
    destBuilding,
    setDestBuilding,
    startRoom,
    setStartRoom,
    endRoom,
    setEndRoom,
  };
}
