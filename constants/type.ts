export interface Buildings {
  name: string;
  campusName: string;
  displayName: string;
  address: string;
  coordinates: Location;
  boundingBox: Location[];
}
//COULD ADD THE SERVICES IN THE BUILDINGS IF YOU WANT

export interface Location {
  latitude: number;
  longitude: number;
}
