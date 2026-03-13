import { act, renderHook } from "@testing-library/react-native";
import { useIndoorRoomSearch } from "../hooks/useIndoorRoomSearch";

describe("useIndoorRoomSearch (skeleton)", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() =>
      useIndoorRoomSearch({
        floorComposite: null,
        buildingCode: "MB",
      }),
    );

    expect(result.current.query).toBe("");
    expect(result.current.selectedRoom).toBeNull();
    expect(result.current.selectedFloor).toBeNull();
  });

  it("updates query via setQuery", () => {
    const { result } = renderHook(() =>
      useIndoorRoomSearch({
        floorComposite: null,
        buildingCode: "MB",
      }),
    );

    act(() => {
      result.current.setQuery("H837");
    });

    expect(result.current.query).toBe("H837");
  });
});

