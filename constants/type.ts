export type BuildingService = 'information' | 'printer' | 'bike' | 'parking' | 'wheelchair';

export interface Buildings {
  name: string;
  campusName: string;
  displayName: string;
  address: string;
  coordinates: Location;
  services?: BuildingService[];
  boundingBox: Location[];
}

export interface Location {
  latitude: number;
  longitude: number;
}
