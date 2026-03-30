export interface POIRangeOption {
  id: string;
  label: string;
  meters: number;
}

export const POI_RANGE_OPTIONS: POIRangeOption[] = [
  { id: "200", label: "200m", meters: 200 },
  { id: "500", label: "500m", meters: 500 },
  { id: "1000", label: "1 km", meters: 1000 },
  { id: "2000", label: "2 km", meters: 2000 },
];

export const DEFAULT_POI_RANGE = POI_RANGE_OPTIONS[1]; // 500m
