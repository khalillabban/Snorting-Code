import {
    parseTransitionPayload,
    serializeTransitionPayload,
    type CrossBuildingIndoorTripPayload,
    type IndoorToOutdoorTransitionPayload,
} from "../utils/routeTransition";

describe("routeTransition", () => {
  it("serializes and parses indoor_to_outdoor payload", () => {
    const payload: IndoorToOutdoorTransitionPayload = {
      mode: "indoor_to_outdoor",
      originBuildingCode: "MB",
      exitNodeId: "exit-node-1",
      exitIndoor: { buildingCode: "MB", floor: 1, x: 10, y: 20 },
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      destinationBuildingCode: "CC",
      destinationCampus: "sgw",
      strategy: { mode: "walking", label: "Walk", icon: "walk" } as any,
      accessibleOnly: true,
      destinationIndoorRoomQuery: "CC-124",
    };

    const raw = serializeTransitionPayload(payload);
    const parsed = parseTransitionPayload(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe("indoor_to_outdoor");
    expect((parsed as any).exitOutdoor.latitude).toBe(45.0);
    expect((parsed as any).destinationIndoorRoomQuery).toBe("CC-124");
  });

  it("parses a minimal valid indoor_to_outdoor payload", () => {
    const payload = {
      mode: "indoor_to_outdoor",
      originBuildingCode: "MB",
      exitNodeId: "exit-node-1",
      exitIndoor: { buildingCode: "MB", floor: 1, x: 10, y: 20 },
      exitOutdoor: { latitude: 45.0, longitude: -73.0 },
      destinationBuildingCode: "CC",
    };

    const parsed = parseTransitionPayload(JSON.stringify(payload));
    expect(parsed).toEqual(payload);
  });

  it("parses cross_building_indoor payload", () => {
    const payload: CrossBuildingIndoorTripPayload = {
      mode: "cross_building_indoor",
      originBuildingCode: "MB",
      originIndoorRoomQuery: "MB-1.210",
      destinationBuildingCode: "CC",
      destinationIndoorRoomQuery: "CC-124",
      accessibleOnly: false,
    };

    const parsed = parseTransitionPayload(JSON.stringify(payload));
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe("cross_building_indoor");
    expect((parsed as any).destinationBuildingCode).toBe("CC");
  });

  it("returns null for undefined and invalid JSON", () => {
    expect(parseTransitionPayload(undefined)).toBeNull();
    expect(parseTransitionPayload("not-json")).toBeNull();
  });

  it("returns null for JSON without a mode", () => {
    expect(parseTransitionPayload(JSON.stringify({ foo: "bar" }))).toBeNull();
  });

  it("returns null for indoor_to_outdoor missing exitOutdoor", () => {
    const bad = {
      mode: "indoor_to_outdoor",
      originBuildingCode: "MB",
      exitNodeId: "x",
      exitIndoor: { buildingCode: "MB", floor: 1, x: 0, y: 0 },
      exitOutdoor: { latitude: "45", longitude: -73 },
      destinationBuildingCode: "CC",
    };

    expect(parseTransitionPayload(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for indoor_to_outdoor when exitOutdoor is missing longitude", () => {
    const bad = {
      mode: "indoor_to_outdoor",
      originBuildingCode: "MB",
      exitNodeId: "x",
      exitIndoor: { buildingCode: "MB", floor: 1, x: 0, y: 0 },
      exitOutdoor: { latitude: 45 },
      destinationBuildingCode: "CC",
    };

    expect(parseTransitionPayload(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for cross_building_indoor missing required fields", () => {
    expect(
      parseTransitionPayload(
        JSON.stringify({
          mode: "cross_building_indoor",
          originBuildingCode: "MB",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for cross_building_indoor missing building codes", () => {
    expect(
      parseTransitionPayload(
        JSON.stringify({
          mode: "cross_building_indoor",
          originBuildingCode: "",
          originIndoorRoomQuery: "MB-1.210",
          destinationBuildingCode: "CC",
          destinationIndoorRoomQuery: "CC-124",
        }),
      ),
    ).toBeNull();

    expect(
      parseTransitionPayload(
        JSON.stringify({
          mode: "cross_building_indoor",
          originBuildingCode: "MB",
          originIndoorRoomQuery: "MB-1.210",
          destinationBuildingCode: "",
          destinationIndoorRoomQuery: "CC-124",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for unsupported mode values", () => {
    expect(
      parseTransitionPayload(
        JSON.stringify({
          mode: "outdoor_to_indoor",
          originBuildingCode: "H",
          destinationBuildingCode: "MB",
        }),
      ),
    ).toBeNull();
  });

  it("returns null for cross_building_indoor when room queries are empty", () => {
    expect(
      parseTransitionPayload(
        JSON.stringify({
          mode: "cross_building_indoor",
          originBuildingCode: "H",
          originIndoorRoomQuery: "",
          destinationBuildingCode: "MB",
          destinationIndoorRoomQuery: "MB-1.210",
        }),
      ),
    ).toBeNull();

    expect(
      parseTransitionPayload(
        JSON.stringify({
          mode: "cross_building_indoor",
          originBuildingCode: "H",
          originIndoorRoomQuery: "H-110",
          destinationBuildingCode: "MB",
          destinationIndoorRoomQuery: "",
        }),
      ),
    ).toBeNull();
  });
});
