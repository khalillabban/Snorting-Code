export type TransportMode = 'walking' | 'bicycling' | 'driving' | 'transit';

// The Strategy Interface
export interface RouteStrategy {
  mode: TransportMode;
  label: string;
  icon: string; 
  extraParams?: Record<string, string>; // might use for transit (choose option: less walking, fewer transfer, etc.)
}