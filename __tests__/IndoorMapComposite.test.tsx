import {
    Building,
    Floor,
    Hallway,
    POI,
    Room,
    parseGeoJSONToBuilding,
    parseGeoJSONToFloor,
} from "../utils/IndoorMapComposite";

describe("IndoorMapComposite", () => {
  describe("Room", () => {
    it("creates a room with correct properties", () => {
      const coords = [[0, 0], [10, 0], [10, 10], [0, 10]];
      const centroid = [5, 5];
      const room = new Room("MB 1.210", "1.210", coords, centroid);

      expect(room.getName()).toBe("MB 1.210");
      expect(room.getType()).toBe("room");
      expect(room.getRoomNumber()).toBe("1.210");
      expect(room.getCoordinates()).toEqual(coords);
      expect(room.getCentroid()).toEqual(centroid);
    });

    it("returns itself in getRooms", () => {
      const room = new Room("Test Room", "101", [[0, 0]], [0, 0]);
      expect(room.getRooms()).toEqual([room]);
    });

    it("returns empty arrays for getFloors and getPOIs", () => {
      const room = new Room("Test Room", "101", [[0, 0]], [0, 0]);
      expect(room.getFloors()).toEqual([]);
      expect(room.getPOIs()).toEqual([]);
    });
  });

  describe("POI", () => {
    it("creates a POI with correct properties", () => {
      const coords = [[5, 5], [6, 5], [6, 6], [5, 6]];
      const centroid = [5.5, 5.5];
      const poi = new POI("Elevator", "elevator", coords, centroid);

      expect(poi.getName()).toBe("Elevator");
      expect(poi.getType()).toBe("elevator");
      expect(poi.getPOIType()).toBe("elevator");
      expect(poi.getCoordinates()).toEqual(coords);
      expect(poi.getCentroid()).toEqual(centroid);
    });

    it("returns itself in getPOIs", () => {
      const poi = new POI("Stairs", "stairs", [[0, 0]], [0, 0]);
      expect(poi.getPOIs()).toEqual([poi]);
    });

    it("returns empty arrays for getFloors and getRooms", () => {
      const poi = new POI("Stairs", "stairs", [[0, 0]], [0, 0]);
      expect(poi.getFloors()).toEqual([]);
      expect(poi.getRooms()).toEqual([]);
    });
  });

  describe("Hallway", () => {
    it("creates a hallway with correct properties", () => {
      const coords = [[0, 0], [20, 0], [20, 5], [0, 5]];
      const centroid = [10, 2.5];
      const hallway = new Hallway("Main Hallway", coords, centroid);

      expect(hallway.getName()).toBe("Main Hallway");
      expect(hallway.getType()).toBe("hallway");
      expect(hallway.getCoordinates()).toEqual(coords);
      expect(hallway.getCentroid()).toEqual(centroid);
    });

    it("returns empty arrays for all collection methods", () => {
      const hallway = new Hallway("Hallway", [[0, 0]], [0, 0]);
      expect(hallway.getFloors()).toEqual([]);
      expect(hallway.getRooms()).toEqual([]);
      expect(hallway.getPOIs()).toEqual([]);
    });
  });

  describe("Floor", () => {
    it("creates a floor with correct properties", () => {
      const floor = new Floor(1, "MB");

      expect(floor.getName()).toBe("Floor 1");
      expect(floor.getType()).toBe("floor");
      expect(floor.getFloorNumber()).toBe(1);
      expect(floor.getChildren()).toEqual([]);
    });

    it("adds children and retrieves them", () => {
      const floor = new Floor(1, "MB");
      const room = new Room("Room 101", "101", [[0, 0]], [0, 0]);
      const hallway = new Hallway("Hallway", [[1, 1]], [1, 1]);

      floor.addChild(room);
      floor.addChild(hallway);

      expect(floor.getChildren().length).toBe(2);
      expect(floor.getChildren()).toContain(room);
      expect(floor.getChildren()).toContain(hallway);
    });

    it("aggregates rooms from children", () => {
      const floor = new Floor(1, "MB");
      const room1 = new Room("Room 101", "101", [[0, 0]], [0, 0]);
      const room2 = new Room("Room 102", "102", [[1, 1]], [1, 1]);

      floor.addChild(room1);
      floor.addChild(room2);

      const rooms = floor.getRooms();
      expect(rooms.length).toBe(2);
      expect(rooms).toContain(room1);
      expect(rooms).toContain(room2);
    });

    it("aggregates POIs from children", () => {
      const floor = new Floor(1, "MB");
      const poi1 = new POI("Elevator", "elevator", [[0, 0]], [0, 0]);
      const poi2 = new POI("Stairs", "stairs", [[1, 1]], [1, 1]);

      floor.addChild(poi1);
      floor.addChild(poi2);

      const pois = floor.getPOIs();
      expect(pois.length).toBe(2);
      expect(pois).toContain(poi1);
      expect(pois).toContain(poi2);
    });

    it("returns itself in getFloors", () => {
      const floor = new Floor(1, "MB");
      expect(floor.getFloors()).toEqual([floor]);
    });

    it("returns default empty coordinates and centroid", () => {
      const floor = new Floor(2, "MB");
      expect(floor.getCoordinates()).toEqual([]);
      expect(floor.getCentroid()).toEqual([0, 0]);
    });
  });

  describe("Building", () => {
    it("creates a building with correct properties", () => {
      const building = new Building("MB");

      expect(building.getName()).toBe("MB");
      expect(building.getType()).toBe("building");
      expect(building.getBuildingCode()).toBe("MB");
      expect(building.getFloors()).toEqual([]);
    });

    it("adds floors and retrieves them", () => {
      const building = new Building("MB");
      const floor1 = new Floor(1, "MB");
      const floor2 = new Floor(2, "MB");

      building.addFloor(floor1);
      building.addFloor(floor2);

      expect(building.getFloors().length).toBe(2);
      expect(building.getFloors()).toContain(floor1);
      expect(building.getFloors()).toContain(floor2);
    });

    it("aggregates rooms from all floors", () => {
      const building = new Building("MB");
      const floor1 = new Floor(1, "MB");
      const floor2 = new Floor(2, "MB");
      
      const room1 = new Room("Room 101", "101", [[0, 0]], [0, 0]);
      const room2 = new Room("Room 201", "201", [[1, 1]], [1, 1]);
      
      floor1.addChild(room1);
      floor2.addChild(room2);
      
      building.addFloor(floor1);
      building.addFloor(floor2);

      const rooms = building.getRooms();
      expect(rooms.length).toBe(2);
      expect(rooms).toContain(room1);
      expect(rooms).toContain(room2);
    });

    it("aggregates POIs from all floors", () => {
      const building = new Building("MB");
      const floor1 = new Floor(1, "MB");
      const floor2 = new Floor(2, "MB");
      
      const poi1 = new POI("Elevator 1", "elevator", [[0, 0]], [0, 0]);
      const poi2 = new POI("Elevator 2", "elevator", [[1, 1]], [1, 1]);
      
      floor1.addChild(poi1);
      floor2.addChild(poi2);
      
      building.addFloor(floor1);
      building.addFloor(floor2);

      const pois = building.getPOIs();
      expect(pois.length).toBe(2);
      expect(pois).toContain(poi1);
      expect(pois).toContain(poi2);
    });

    it("returns default empty coordinates and centroid", () => {
      const building = new Building("MB");
      expect(building.getCoordinates()).toEqual([]);
      expect(building.getCentroid()).toEqual([0, 0]);
    });
  });

  describe("parseGeoJSONToFloor", () => {
    it("parses GeoJSON with rooms, hallways, and POIs", () => {
      const geoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Room 101", type: "room", centroid: [5, 5] },
            geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10]]] },
          },
          {
            type: "Feature",
            properties: { name: "Main Hallway", type: "hallway", centroid: [15, 5] },
            geometry: { type: "Polygon", coordinates: [[[10, 0], [20, 0], [20, 10], [10, 10]]] },
          },
          {
            type: "Feature",
            properties: { name: "Elevator", type: "POI", centroid: [25, 5] },
            geometry: { type: "Polygon", coordinates: [[[20, 0], [30, 0], [30, 10], [20, 10]]] },
          },
        ],
      };

      const floor = parseGeoJSONToFloor(geoJSON, 1, "MB");

      expect(floor.getFloorNumber()).toBe(1);
      expect(floor.getChildren().length).toBe(3);
      expect(floor.getRooms().length).toBe(1);
      expect(floor.getPOIs().length).toBe(1);
    });

    it("calculates centroid when not provided", () => {
      const geoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Room 101", type: "room" },
            geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10]]] },
          },
        ],
      };

      const floor = parseGeoJSONToFloor(geoJSON, 1, "MB");
      const room = floor.getRooms()[0];
      
      expect(room.getCentroid()[0]).toBeCloseTo(5, 1);
      expect(room.getCentroid()[1]).toBeCloseTo(5, 1);
    });

    it("uses provided centroid from GeoJSON properties", () => {
      const geoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { name: "Room 101", type: "room", centroid: [100, 200] },
            geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10]]] },
          },
        ],
      };

      const floor = parseGeoJSONToFloor(geoJSON, 1, "MB");
      const room = floor.getRooms()[0];
      
      expect(room.getCentroid()).toEqual([100, 200]);
    });
  });

  describe("parseGeoJSONToBuilding", () => {
    it("parses multiple floors into a building", () => {
      const floorData = {
        "MB-1": {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "Room 101", type: "room", centroid: [5, 5] },
              geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10]]] },
            },
          ],
        },
        "MB-2": {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "Room 201", type: "room", centroid: [5, 5] },
              geometry: { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10]]] },
            },
          ],
        },
      };

      const building = parseGeoJSONToBuilding("MB", floorData);

      expect(building.getBuildingCode()).toBe("MB");
      expect(building.getFloors().length).toBe(2);
      expect(building.getRooms().length).toBe(2);
    });
  });
});
