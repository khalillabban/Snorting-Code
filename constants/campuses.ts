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
      latitude: 45.495,
      longitude: -73.5781,
    },
  },
  loyola: {
    name: "Loyola Campus",
    coordinates: {
      latitude: 45.458,
      longitude: -73.6395,
    },
  },
};
