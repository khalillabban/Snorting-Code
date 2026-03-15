export interface IndoorMapNode {
  getName(): string;
  getType(): string;
  getFloors(): Floor[];
  getRooms(): Room[];
  getPOIs(): POI[];
  getCoordinates(): number[][];
  getCentroid(): number[];
}

// Leaf: Room
export class Room implements IndoorMapNode {
  constructor(
    private name: string,
    private roomNumber: string,
    private coordinates: number[][],
    private centroid: number[],
  ) {}

  getName(): string {
    return this.name;
  }
  getType(): string {
    return "room";
  }
  getFloors(): Floor[] {
    return [];
  }
  getRooms(): Room[] {
    return [this];
  }
  getPOIs(): POI[] {
    return [];
  }
  getCoordinates(): number[][] {
    return this.coordinates;
  }
  getCentroid(): number[] {
    return this.centroid;
  }
  getRoomNumber(): string {
    return this.roomNumber;
  }
}

// Leaf: POI (Point of Interest)
export class POI implements IndoorMapNode {
  constructor(
    private name: string,
    private poiType: string,
    private coordinates: number[][],
    private centroid: number[],
  ) {}

  getName(): string {
    return this.name;
  }
  getType(): string {
    return this.poiType;
  }
  getFloors(): Floor[] {
    return [];
  }
  getRooms(): Room[] {
    return [];
  }
  getPOIs(): POI[] {
    return [this];
  }
  getCoordinates(): number[][] {
    return this.coordinates;
  }
  getCentroid(): number[] {
    return this.centroid;
  }
  getPOIType(): string {
    return this.poiType;
  }
}

// Leaf: Hallway
export class Hallway implements IndoorMapNode {
  constructor(
    private name: string,
    private coordinates: number[][],
    private centroid: number[],
  ) {}

  getName(): string {
    return this.name;
  }
  getType(): string {
    return "hallway";
  }
  getFloors(): Floor[] {
    return [];
  }
  getRooms(): Room[] {
    return [];
  }
  getPOIs(): POI[] {
    return [];
  }
  getCoordinates(): number[][] {
    return this.coordinates;
  }
  getCentroid(): number[] {
    return this.centroid;
  }
}

// Composite: Floor
export class Floor implements IndoorMapNode {
  private children: IndoorMapNode[] = [];

  constructor(
    private floorNumber: number,
    private buildingCode: string,
  ) {}

  addChild(node: IndoorMapNode): void {
    this.children.push(node);
  }

  getName(): string {
    return `Floor ${this.floorNumber}`;
  }
  getType(): string {
    return "floor";
  }
  getFloors(): Floor[] {
    return [this];
  }

  getRooms(): Room[] {
    return this.children.flatMap((child) => child.getRooms());
  }

  getPOIs(): POI[] {
    return this.children.flatMap((child) => child.getPOIs());
  }

  getCoordinates(): number[][] {
    return [];
  }
  getCentroid(): number[] {
    return [0, 0];
  }
  getFloorNumber(): number {
    return this.floorNumber;
  }
  getChildren(): IndoorMapNode[] {
    return this.children;
  }
}

// Composite: Building
export class Building implements IndoorMapNode {
  private floors: Floor[] = [];

  constructor(private buildingCode: string) {}

  addFloor(floor: Floor): void {
    this.floors.push(floor);
  }

  getName(): string {
    return this.buildingCode;
  }
  getType(): string {
    return "building";
  }
  getFloors(): Floor[] {
    return this.floors;
  }

  getRooms(): Room[] {
    return this.floors.flatMap((floor) => floor.getRooms());
  }

  getPOIs(): POI[] {
    return this.floors.flatMap((floor) => floor.getPOIs());
  }

  getCoordinates(): number[][] {
    return [];
  }
  getCentroid(): number[] {
    return [0, 0];
  }
  getBuildingCode(): string {
    return this.buildingCode;
  }
}

// GeoJSON interfaces
interface GeoJSONFeature {
  type?: string;
  properties: { name: string; type: string; centroid?: number[] };
  geometry: { type: string; coordinates: number[][][] };
}

export interface GeoJSONData {
  type?: string;
  features: GeoJSONFeature[];
}

// Parser: Convert GeoJSON to Composite tree
export function parseGeoJSONToFloor(
  geoJSON: GeoJSONData,
  floorNumber: number,
  buildingCode: string,
): Floor {
  const floor = new Floor(floorNumber, buildingCode);

  geoJSON.features.forEach((feature) => {
    const coords = feature.geometry.coordinates[0];
    const centroid =
      feature.properties.centroid ||
      coords.reduce(
        (acc, [x, y]) => [
          acc[0] + x / coords.length,
          acc[1] + y / coords.length,
        ],
        [0, 0],
      );

    const type = feature.properties.type;
    const name = feature.properties.name;

    if (type === "hallway") {
      floor.addChild(new Hallway(name, coords, centroid));
    } else if (type === "POI") {
      floor.addChild(new POI(name, type, coords, centroid));
    } else {
      floor.addChild(new Room(name, name, coords, centroid));
    }
  });

  return floor;
}

export function parseGeoJSONToBuilding(
  buildingCode: string,
  floorData: Record<string, GeoJSONData>,
): Building {
  const building = new Building(buildingCode);

  Object.entries(floorData).forEach(([key, geoJSON]) => {
    const floorNumber = parseInt(key.split("-")[1]);
    const floor = parseGeoJSONToFloor(geoJSON, floorNumber, buildingCode);
    building.addFloor(floor);
  });

  return building;
}
