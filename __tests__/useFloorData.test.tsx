import { renderHook } from "@testing-library/react-native";
import { getRegisteredFloors, useFloorData } from "../hooks/useFloorData";

jest.mock("../utils/mapAssets", () => ({
  getAvailableFloors: jest.fn(),
  getBuildingPlanAsset: jest.fn(),
  getFloorImageAsset: jest.fn(),
}));

import {
    getAvailableFloors,
    getBuildingPlanAsset,
    getFloorImageAsset,
} from "../utils/mapAssets";

const mockedGetAvailableFloors = getAvailableFloors as jest.Mock;
const mockedGetBuildingPlanAsset = getBuildingPlanAsset as jest.Mock;
const mockedGetFloorImageAsset = getFloorImageAsset as jest.Mock;

describe("hooks/useFloorData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null values when building name is missing", () => {
    const { result } = renderHook(() => useFloorData(null, 1));
    expect(result.current.floorPlan).toBeNull();
    expect(result.current.graphData).toBeNull();
    expect(mockedGetFloorImageAsset).not.toHaveBeenCalled();
    expect(mockedGetBuildingPlanAsset).not.toHaveBeenCalled();
  });

  it("returns floor plan and graph data when available", () => {
    mockedGetFloorImageAsset.mockReturnValue("asset://h1.svg");
    mockedGetBuildingPlanAsset.mockReturnValue({ meta: { buildingId: "H" }, nodes: [], edges: [] });

    const { result } = renderHook(() => useFloorData("H", 1));
    expect(result.current.floorPlan).toBe("asset://h1.svg");
    expect(result.current.graphData).toEqual({
      meta: { buildingId: "H" },
      nodes: [],
      edges: [],
    });
  });

  it("returns null when map asset helpers return undefined", () => {
    mockedGetFloorImageAsset.mockReturnValue(undefined);
    mockedGetBuildingPlanAsset.mockReturnValue(undefined);

    const { result } = renderHook(() => useFloorData("H", 9));
    expect(result.current.floorPlan).toBeNull();
    expect(result.current.graphData).toBeNull();
  });

  it("delegates getRegisteredFloors to map assets", () => {
    mockedGetAvailableFloors.mockReturnValue([1, 2, 8, 9]);
    expect(getRegisteredFloors("H")).toEqual([1, 2, 8, 9]);
    expect(mockedGetAvailableFloors).toHaveBeenCalledWith("H");
  });
});