jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
}));

describe("usabilityConfig", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns a stable session id until reset", () => {
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    const { randomUUID } = require("expo-crypto") as {
      randomUUID: jest.Mock;
    };
    randomUUID.mockReturnValue("uuid-1");

    jest.isolateModules(() => {
      const { getSessionId } = require("../constants/usabilityConfig") as {
        getSessionId: () => string;
      };

      const first = getSessionId();
      const second = getSessionId();

      expect(first).toBe("session_1700000000000_uuid-1");
      expect(second).toBe(first);
    });

    expect(randomUUID).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it("resetSession returns a new session id and updates the current session", () => {
    const nowSpy = jest.spyOn(Date, "now");
    nowSpy
      .mockReturnValueOnce(1700000000000)
      .mockReturnValueOnce(1700000001000);

    const { randomUUID } = require("expo-crypto") as {
      randomUUID: jest.Mock;
    };
    randomUUID.mockReturnValueOnce("uuid-1").mockReturnValueOnce("uuid-2");

    jest.isolateModules(() => {
      const { getSessionId, resetSession } =
        require("../constants/usabilityConfig") as {
          getSessionId: () => string;
          resetSession: () => string;
        };

      const first = getSessionId();
      const reset = resetSession();
      const current = getSessionId();

      expect(first).toBe("session_1700000000000_uuid-1");
      expect(reset).toBe("session_1700000001000_uuid-2");
      expect(current).toBe(reset);
      expect(current).not.toBe(first);
    });

    nowSpy.mockRestore();
  });
});
