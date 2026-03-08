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

export interface Departure {
  departureTime: string;
  arrivalTime: string;
}

export interface RouteSegment {
  coordinates: LatLng[];
  mode: "walking" | "shuttle";
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteStep {
  instruction: string;
  distance?: string;
  duration?: string;
}

export interface CalendarEvent {
  className: string;
  startTime: Date;
  endTime: Date;
  daysOfWeek: string[];
  endDate: string;
  campus: "SGW" | "Loyola";
  buildingCode: string;
  floorLevel: number;
  roomNumber: string;
  fullLocationString: string;
}

export interface ScheduleItem {
  id: string;
  courseName: string;
  start: Date;
  end: Date;
  location: string;
  campus: string;
  building: string;
  room: string;
  level: string;
}

export const SCHEDULE_ITEMS = "scheduleItems" as const;
