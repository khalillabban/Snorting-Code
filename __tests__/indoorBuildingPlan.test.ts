import { getBuildingPlanAsset, normalizeIndoorBuildingCode } from "../utils/mapAssets";
import {
  getNormalizedBuildingPlan,
  normalizeBuildingPlanAsset,
} from "../utils/indoorBuildingPlan";

describe("utils/indoorBuildingPlan", () => {
  it("normalizes indoor building aliases", () => {
    expect(normalizeIndoorBuildingCode("Hall")).toBe("H");
    expect(normalizeIndoorBuildingCode(" mb ")).toBe("MB");
  });

  it("returns null when no building-plan asset exists", () => {
    expect(getNormalizedBuildingPlan("LB")).toBeNull();
    expect(getNormalizedBuildingPlan("UNKNOWN")).toBeNull();
  });

  it("normalizes the Hall plan to building code H", () => {
    const plan = getNormalizedBuildingPlan("H");

    expect(plan).not.toBeNull();
    expect(plan?.buildingCode).toBe("H");
    expect(plan?.floors).toEqual([1, 2, 8, 9]);
  });

  it("uses the explicit floor field even when VE node ids are misleading", () => {
    const plan = getNormalizedBuildingPlan("VE");

    expect(plan).not.toBeNull();

    const room234 = plan?.rooms.find((room) => room.label === "VE-234");
    expect(room234).toBeDefined();
    expect(room234?.floor).toBe(2);
    expect(room234?.id).toContain("VE_F1");
  });

  it("normalizes MB S2 labels onto floor -2", () => {
    const plan = getNormalizedBuildingPlan("MB");

    expect(plan).not.toBeNull();
    expect(plan?.floors).toEqual([-2, 1]);

    const basementRoom = plan?.rooms.find((room) => room.label === "MB-S2.210");
    expect(basementRoom).toBeDefined();
    expect(basementRoom?.floor).toBe(-2);
    expect(basementRoom?.roomNumber).toBe("S2.210");
  });

  it("builds searchable terms and keys from room labels", () => {
    const plan = getNormalizedBuildingPlan("H");

    expect(plan).not.toBeNull();

    const room = plan?.rooms.find((entry) => entry.label === "H-851-1");
    expect(room).toBeDefined();
    expect(room?.roomNumber).toBe("851-1");
    expect(room?.searchTerms).toEqual(["H-851-1", "851-1"]);
    expect(room?.searchKeys).toEqual(["H8511", "8511"]);
  });

  it("groups normalized rooms by floor", () => {
    const plan = getNormalizedBuildingPlan("CC");

    expect(plan).not.toBeNull();
    expect(plan?.floors).toEqual([1]);
    expect(plan?.roomsByFloor[1].length).toBe(plan?.rooms.length);
  });

  it("can normalize a plan directly from an asset", () => {
    const asset = getBuildingPlanAsset("VL");
    expect(asset).toBeDefined();

    const plan = normalizeBuildingPlanAsset(asset!, "VL");
    expect(plan.buildingCode).toBe("VL");
    expect(plan.floors).toEqual([1, 2]);
    expect(plan.rooms.length).toBeGreaterThan(0);
  });
});
