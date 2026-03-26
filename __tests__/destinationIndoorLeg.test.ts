import {
  isDestinationLegOrigin,
  pickClosestEntryExitNodeId,
} from "../utils/destinationIndoorLeg";

describe("utils/destinationIndoorLeg", () => {
  describe("isDestinationLegOrigin", () => {
    it("matches ENTRANCE case-insensitively and with spaces", () => {
      expect(isDestinationLegOrigin("entrance")).toBe(true);
      expect(isDestinationLegOrigin(" ENTRANCE ")).toBe(true);
      expect(isDestinationLegOrigin("EnTrAnCe")).toBe(true);
    });

    it("returns false for other values", () => {
      expect(isDestinationLegOrigin("")).toBe(false);
      expect(isDestinationLegOrigin("MB")).toBe(false);
      expect(isDestinationLegOrigin("ENTRANCE-1")).toBe(false);
    });
  });

  describe("pickClosestEntryExitNodeId", () => {
    it("returns null when there is no destination room", () => {
      expect(
        pickClosestEntryExitNodeId({
          entryNodes: [{ id: "a", x: 0, y: 0, type: "building_entry_exit" }],
          destinationRoom: null,
        }),
      ).toBeNull();
    });

    it("returns null when there are no entry nodes", () => {
      expect(
        pickClosestEntryExitNodeId({
          entryNodes: [],
          destinationRoom: { x: 1, y: 1 },
        }),
      ).toBeNull();
    });

    it("picks the closest node; breaks ties deterministically (first)", () => {
      const result = pickClosestEntryExitNodeId({
        entryNodes: [
          { id: "a", x: 0, y: 0, type: "building_entry_exit" },
          { id: "b", x: 0, y: 0, type: "building_entry_exit" },
          { id: "c", x: 10, y: 10, type: "building_entry_exit" },
        ],
        destinationRoom: { x: 1, y: 1 },
      });
      expect(result).toBe("a");
    });

    it("handles missing coordinates by treating them as 0", () => {
      const result = pickClosestEntryExitNodeId({
        entryNodes: [
          { id: "a", type: "building_entry_exit" },
          { id: "b", x: 5, y: 5, type: "building_entry_exit" },
        ],
        destinationRoom: { x: 1, y: 1 },
      });
      expect(result).toBe("a");
    });

    it("falls back to the first node id when sorting yields no best result", () => {
      // Force the map stage to produce an undefined first element.
      const entryNodes = [
        { id: "a", x: NaN, y: NaN, type: "building_entry_exit" },
        { id: "b", x: NaN, y: NaN, type: "building_entry_exit" },
      ];
      expect(
        pickClosestEntryExitNodeId({
          entryNodes,
          destinationRoom: { x: 1, y: 1 },
        }),
      ).toBe("a");
    });
  });
});
