import {
  IndoorRoomRecord,
  NormalizedIndoorBuildingPlan,
  getNormalizedBuildingPlan,
} from "../utils/indoorBuildingPlan";
import {
  findIndoorRoomFloor,
  findIndoorRoomMatch,
  findIndoorRoomMatches,
} from "../utils/indoorRoomSearch";

function makeRoom(
  label: string,
  roomNumber: string,
  floor: number,
  roomName?: string,
  aliases: string[] = [],
): IndoorRoomRecord {
  const searchTerms = [label, roomNumber, roomName, ...aliases].filter(
    (value): value is string => Boolean(value),
  );

  return {
    id: `${label}-${floor}`,
    buildingCode: "T",
    floor,
    label,
    roomNumber,
    roomName,
    aliases,
    x: 0,
    y: 0,
    accessible: true,
    searchTerms,
    searchKeys: searchTerms.map((value) =>
      value.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
    ),
  };
}

function makePlan(rooms: IndoorRoomRecord[]): NormalizedIndoorBuildingPlan {
  const floors = [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b);
  const roomsByFloor = floors.reduce<Record<number, IndoorRoomRecord[]>>(
    (acc, floor) => {
      acc[floor] = rooms.filter((room) => room.floor === floor);
      return acc;
    },
    {},
  );

  return {
    buildingCode: "T",
    floors,
    rooms,
    roomsByFloor,
  };
}

describe("utils/indoorRoomSearch", () => {
  it("matches an exact full room label from a normalized plan", () => {
    const plan = getNormalizedBuildingPlan("H");
    expect(plan).not.toBeNull();

    const match = findIndoorRoomMatch(plan!, " h-867 ");
    expect(match).not.toBeNull();
    expect(match?.room.label).toBe("H-867");
    expect(match?.floor).toBe(8);
    expect(match?.matchType).toBe("exact_label");
  });

  it("matches an exact room number without the building prefix", () => {
    const plan = getNormalizedBuildingPlan("H");
    expect(plan).not.toBeNull();

    const match = findIndoorRoomMatch(plan!, "867");
    expect(match).not.toBeNull();
    expect(match?.room.label).toBe("H-867");
    expect(match?.matchType).toBe("exact_room");
  });

  it("matches a compact query without punctuation", () => {
    const plan = getNormalizedBuildingPlan("H");
    expect(plan).not.toBeNull();

    const match = findIndoorRoomMatch(plan!, "h8511");
    expect(match).not.toBeNull();
    expect(match?.room.label).toBe("H-851-1");
    expect(match?.matchType).toBe("exact_compact");
  });

  it("prefers exact matches over partial matches", () => {
    const exactRoom = makeRoom("T-1.210", "1.210", 1);
    const partialRoom = makeRoom("T-1.210A", "1.210A", 1);
    const plan = makePlan([partialRoom, exactRoom]);

    const match = findIndoorRoomMatch(plan, "1.210");
    expect(match).not.toBeNull();
    expect(match?.room.label).toBe("T-1.210");
    expect(match?.matchType).toBe("exact_room");
  });

  it("biases the current floor when multiple exact matches tie", () => {
    const floorOneRoom = makeRoom("T-101", "101", 1);
    const floorTwoRoom = makeRoom("T-101", "101", 2);
    const plan = makePlan([floorOneRoom, floorTwoRoom]);

    const match = findIndoorRoomMatch(plan, "101", { currentFloor: 2 });
    expect(match).not.toBeNull();
    expect(match?.floor).toBe(2);
  });

  it("returns sorted partial matches", () => {
    const first = makeRoom("T-851-1", "851-1", 1);
    const second = makeRoom("T-851-2", "851-2", 1);
    const third = makeRoom("T-1851", "1851", 2);
    const plan = makePlan([third, second, first]);

    const matches = findIndoorRoomMatches(plan, "851");
    expect(matches.map((match) => match.room.label)).toEqual([
      "T-851-1",
      "T-851-2",
      "T-1851",
    ]);
  });

  it("matches human-friendly room names and aliases when metadata exists", () => {
    const namedRoom = makeRoom(
      "T-1.210",
      "1.210",
      1,
      "COMPUTER LAB",
      ["SOEN LAB"],
    );
    const plan = makePlan([namedRoom]);

    expect(findIndoorRoomMatch(plan, "computer lab")?.room.label).toBe("T-1.210");
    expect(findIndoorRoomMatch(plan, "soen lab")?.room.label).toBe("T-1.210");
  });

  it("resolves the destination floor for a matched room", () => {
    const plan = getNormalizedBuildingPlan("MB");
    expect(plan).not.toBeNull();

    expect(findIndoorRoomFloor(plan!, "MB-S2.210")).toBe(-2);
    expect(findIndoorRoomFloor(plan!, "1.210")).toBe(1);
  });

  it("returns no match for missing rooms or blank queries", () => {
    const plan = getNormalizedBuildingPlan("CC");
    expect(plan).not.toBeNull();

    expect(findIndoorRoomMatch(plan!, "DOES-NOT-EXIST")).toBeNull();
    expect(findIndoorRoomMatch(plan!, "   ")).toBeNull();
    expect(findIndoorRoomMatches(plan!, "")).toEqual([]);
    expect(findIndoorRoomFloor(plan!, "DOES-NOT-EXIST")).toBeNull();
  });

  it("returns no match when query becomes empty after compact normalization", () => {
    const plan = makePlan([makeRoom("T-101", "101", 1)]);
    expect(findIndoorRoomMatches(plan, "---")).toEqual([]);
  });

  it("returns no match for a query with no label, room, or compact hits", () => {
    const plan = makePlan([makeRoom("T-101", "101", 1)]);
    expect(findIndoorRoomMatch(plan, "zzzzzz")).toBeNull();
  });

  it("matches partial room-number substrings", () => {
    const plan = makePlan([makeRoom("T-ROOM", "10A", 1)]);
    const match = findIndoorRoomMatch(plan, "0A");
    expect(match?.matchType).toBe("partial_room");
  });

  it("matches exact roomNumber when label differs", () => {
    const plan = makePlan([makeRoom("T-ALIAS", "R-204", 2)]);
    const match = findIndoorRoomMatch(plan, "R-204");
    expect(match).not.toBeNull();
    expect(match?.matchType).toBe("exact_room");
  });

  it("limits results with maxResults and resolves ties by floor then label", () => {
    const floor2 = makeRoom("T-B", "777", 2);
    const floor1A = makeRoom("T-A", "777", 1);
    const floor1B = makeRoom("T-C", "777", 1);
    const plan = makePlan([floor2, floor1B, floor1A]);

    const matches = findIndoorRoomMatches(plan, "777", { maxResults: 2 });
    expect(matches).toHaveLength(2);
    expect(matches.map((match) => `${match.floor}-${match.room.label}`)).toEqual([
      "1-T-A",
      "1-T-C",
    ]);
  });

  it("breaks equal-score ties by shorter room number first", () => {
    const short = makeRoom("T-AB", "AB", 1);
    const long = makeRoom("T-AB1", "AB1", 1);
    const plan = makePlan([long, short]);

    const matches = findIndoorRoomMatches(plan, "A");
    expect(matches[0].room.roomNumber).toBe("AB");
    expect(matches[1].room.roomNumber).toBe("AB1");
  });

  it("matches compact-key prefixes and partial compact keys", () => {
    const compactOnlyRoom = makeRoom("T-ROOM", "R-999", 3, undefined, ["MB-1234-ALIAS"]);
    const plan = makePlan([compactOnlyRoom]);

    const prefixMatch = findIndoorRoomMatch(plan, "mb12");
    expect(prefixMatch).not.toBeNull();
    expect(prefixMatch?.matchType).toBe("prefix_compact");

    const partialMatch = findIndoorRoomMatch(plan, "234A");
    expect(partialMatch).not.toBeNull();
    expect(partialMatch?.matchType).toBe("partial_compact");
  });

  it("matches label prefixes before room/compact partial matches", () => {
    const room = makeRoom("T-ALPHA", "R-991", 1);
    const plan = makePlan([room]);

    const match = findIndoorRoomMatch(plan, "T-AL");
    expect(match).not.toBeNull();
    expect(match?.matchType).toBe("prefix_label");
  });
});
