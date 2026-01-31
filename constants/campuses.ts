export type CampusKey = "sgw" | "loyola";

export const CAMPUSES: Record<
  CampusKey,
  {
    name: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  }
> = {
  sgw: {
    name: "SGW Campus",
    coordinates: {
      latitude: 45.4973,
      longitude: -73.5790,
    },
  },
  loyola: {
    name: "Loyola Campus",
    coordinates: {
      latitude: 45.4582,
      longitude: -73.6405,
    },
  },
};
