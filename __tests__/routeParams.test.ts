import { describe, expect, it } from "@jest/globals";
import { parseFloors } from "../utils/routeParams";

describe("parseFloors", () => {
  it("returns an empty array for undefined input", () => {
    expect(parseFloors(undefined)).toEqual([]);
  });

  it("returns parsed numbers for valid JSON", () => {
    expect(parseFloors("[1,2,-2]")).toEqual([1, 2, -2]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseFloors("not-json")).toEqual([]);
  });
});
