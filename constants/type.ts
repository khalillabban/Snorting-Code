export type BuildingIcon =
  | "information"
  | "printer"
  | "bike"
  | "parking"
  | "wheelchair";

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

export interface BusStop {
  id: string;
  name: string;
  coordinates: Location;
  address: string;
}

export interface ShuttleSchedule {
  schedule: {
    "monday-thursday": {
      SGW_to_Loyola: ShuttleTime[];
      Loyola_to_SGW: ShuttleTime[];
    };
    friday: {
      SGW_to_Loyola: ShuttleTime[];
      Loyola_to_SGW: ShuttleTime[];
    };
    weekend: {
      info: string;
    };
  };
}

export interface ShuttleTime {
  departureTime: string;
  arrivalTime: string;
}
