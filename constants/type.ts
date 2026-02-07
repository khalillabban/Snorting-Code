export type BuildingIcon = 'information' | 'printer' | 'bike' | 'parking' | 'wheelchair';

export interface Buildings {
  name: string;
  campusName: string;
  displayName: string;
  address: string;
  coordinates: Location;
  icons?: BuildingIcon[];
  departments?: string[];
  services?: string[];
  boundingBox: Location[];
}

export interface Location {
  latitude: number;
  longitude: number;
}
