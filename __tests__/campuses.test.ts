import { describe, expect, it } from "@jest/globals";
import { CAMPUSES } from "../constants/campuses";

describe("CAMPUSES", () => {
  it("defines both SGW and Loyola campuses with coordinate pairs", () => {
    expect(CAMPUSES.sgw.name).toBe("SGW Campus");
    expect(CAMPUSES.loyola.name).toBe("Loyola Campus");

    expect(CAMPUSES.sgw.coordinates).toEqual(
      expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }),
    );
    expect(CAMPUSES.loyola.coordinates).toEqual(
      expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }),
    );
  });
});
