import { Platform } from "react-native";
import { renderHook } from "@testing-library/react-native";
import { useBottomInset } from "../hooks/useBottomInset";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 24, left: 0, right: 0 })),
}));

describe("useBottomInset", () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatform });
  });

  it("returns bottom inset plus additional padding on Android", () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    const { result } = renderHook(() => useBottomInset(10));
    expect(result.current).toBe(34);
  });

  it("returns only additional padding on iOS", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    const { result } = renderHook(() => useBottomInset(10));
    expect(result.current).toBe(10);
  });

  it("returns just bottom inset when no additional padding specified on Android", () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    const { result } = renderHook(() => useBottomInset());
    expect(result.current).toBe(24);
  });

  it("returns 0 when no additional padding specified on iOS", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    const { result } = renderHook(() => useBottomInset());
    expect(result.current).toBe(0);
  });
});
