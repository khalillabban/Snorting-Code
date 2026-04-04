import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    clearSelectedCalendarIds,
    getSelectedCalendarIds,
    saveSelectedCalendarIds,
} from "../services/SelectedCalendarsStore";

describe("SelectedCalendarsStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty array when no selected ids are persisted", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(null);

    await expect(getSelectedCalendarIds()).resolves.toEqual([]);
  });

  it("returns parsed ids when valid JSON is persisted", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce(
      JSON.stringify(["primary", "work"]),
    );

    await expect(getSelectedCalendarIds()).resolves.toEqual(["primary", "work"]);
  });

  it("returns an empty array when persisted JSON is malformed", async () => {
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValueOnce("{bad-json");

    await expect(getSelectedCalendarIds()).resolves.toEqual([]);
  });

  it("saves selected ids as JSON", async () => {
    await saveSelectedCalendarIds(["primary", "work"]);

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      "selectedGoogleCalendars",
      JSON.stringify(["primary", "work"]),
    );
  });

  it("clears selected ids", async () => {
    await clearSelectedCalendarIds();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith("selectedGoogleCalendars");
  });
});
