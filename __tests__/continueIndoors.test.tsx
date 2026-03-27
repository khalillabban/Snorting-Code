import {
  buildContinueIndoorsStep,
  getContinueIndoorsBuildingCode,
} from "../utils/continueIndoors";

describe("utils/continueIndoors", () => {
  describe("getContinueIndoorsBuildingCode", () => {
    it("prefers selected outdoor destination name", () => {
      expect(
        getContinueIndoorsBuildingCode({
          selectedDest: { name: " CC " } as any,
          transitionPayload: {
            mode: "indoor_to_outdoor",
            exitOutdoor: { lat: 1, lng: 2 },
            destinationBuildingCode: "MB",
          } as any,
        }),
      ).toBe("CC");
    });

    it("falls back to indoor_to_outdoor payload destinationBuildingCode", () => {
      expect(
        getContinueIndoorsBuildingCode({
          selectedDest: null,
          transitionPayload: {
            mode: "indoor_to_outdoor",
            exitOutdoor: { lat: 1, lng: 2 },
            destinationBuildingCode: " MB ",
          } as any,
        }),
      ).toBe("MB");
    });

    it("returns empty string when nothing is available", () => {
      expect(
        getContinueIndoorsBuildingCode({
          selectedDest: null,
          transitionPayload: null,
        }),
      ).toBe("");

      expect(
        getContinueIndoorsBuildingCode({
          selectedDest: { name: "  " } as any,
          transitionPayload: {
            mode: "cross_building_indoor",
            originBuildingCode: "MB",
            originRoomQuery: "MB-1",
            destinationBuildingCode: "CC",
            destinationRoomQuery: "CC-124",
          } as any,
        }),
      ).toBe("");
    });

    it("ignores non-indoor_to_outdoor payload modes", () => {
      expect(
        getContinueIndoorsBuildingCode({
          selectedDest: null,
          transitionPayload: {
            mode: "cross_building_indoor",
            originBuildingCode: "MB",
            originRoomQuery: "MB-1",
            destinationBuildingCode: "CC",
            destinationRoomQuery: "CC-124",
          } as any,
        }),
      ).toBe("");
    });
  });

  describe("buildContinueIndoorsStep", () => {
    const baseSteps = [{ instruction: "Step 1" }, { instruction: "Step 2" }];

    it("returns null if destinationBuildingCode is empty", () => {
      expect(
        buildContinueIndoorsStep({
          baseSteps,
          destinationBuildingCode: " ",
          destinationRoomQuery: "CC-124",
        }),
      ).toBeNull();
    });

    it("appends a room-specific instruction when destinationRoomQuery is present", () => {
      const result = buildContinueIndoorsStep({
        baseSteps,
        destinationBuildingCode: "CC",
        destinationRoomQuery: " CC-124 ",
      });

      expect(result).not.toBeNull();
      expect(result!.steps).toHaveLength(3);
      expect(result!.steps[2].instruction).toBe("Continue indoors to CC-124");
      expect(result!.openArgs).toEqual({
        buildingCode: "CC",
        navOrigin: "ENTRANCE",
        navDest: "CC-124",
      });
    });

    it("appends a building-only instruction when destinationRoomQuery is blank", () => {
      const result = buildContinueIndoorsStep({
        baseSteps,
        destinationBuildingCode: "CC",
        destinationRoomQuery: "   ",
      });

      expect(result).not.toBeNull();
      expect(result!.steps).toHaveLength(3);
      expect(result!.steps[2].instruction).toBe("Continue indoors in CC");
      expect(result!.openArgs).toEqual({
        buildingCode: "CC",
        navOrigin: "ENTRANCE",
      });
    });

    it("uses the trimmed destinationBuildingCode when building-only", () => {
      const result = buildContinueIndoorsStep({
        baseSteps,
        destinationBuildingCode: "  cc ",
        destinationRoomQuery: "",
      });

      expect(result).not.toBeNull();
      expect(result!.steps[result!.steps.length - 1].instruction).toBe(
        "Continue indoors in cc",
      );
      expect(result!.openArgs.buildingCode).toBe("cc");
    });
  });
});
