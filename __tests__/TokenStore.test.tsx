// __tests__/TokenStore.test.ts
import {
    deleteGoogleAccessToken,
    getGoogleAccessToken,
    isTokenLikelyExpired,
    saveGoogleAccessToken,
} from "../services/TokenStore";

const mockSetItemAsync = jest.fn();
const mockGetItemAsync = jest.fn();
const mockDeleteItemAsync = jest.fn();

jest.mock("expo-secure-store", () => ({
  setItemAsync: (...args: any[]) => mockSetItemAsync(...args),
  getItemAsync: (...args: any[]) => mockGetItemAsync(...args),
  deleteItemAsync: (...args: any[]) => mockDeleteItemAsync(...args),
}));

describe("services/TokenStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe("saveGoogleAccessToken", () => {
    it("stores the access token and meta when meta provided", async () => {
      mockSetItemAsync.mockResolvedValueOnce(undefined); // token
      mockSetItemAsync.mockResolvedValueOnce(undefined); // meta

      await saveGoogleAccessToken("TOKEN", { issuedAt: 123, expiresIn: 456 });

      expect(mockSetItemAsync).toHaveBeenCalledTimes(2);

      // token first
      expect(mockSetItemAsync.mock.calls[0]).toEqual([
        "google_access_token",
        "TOKEN",
      ]);

      // meta second
      expect(mockSetItemAsync.mock.calls[1][0]).toBe("google_access_token_meta");
      expect(mockSetItemAsync.mock.calls[1][1]).toBe(
        JSON.stringify({ issuedAt: 123, expiresIn: 456 }),
      );

      expect(mockDeleteItemAsync).not.toHaveBeenCalled();
    });

    it("stores the access token and deletes meta when meta not provided", async () => {
      mockSetItemAsync.mockResolvedValueOnce(undefined);
      mockDeleteItemAsync.mockResolvedValueOnce(undefined);

      await saveGoogleAccessToken("TOKEN");

      expect(mockSetItemAsync).toHaveBeenCalledTimes(1);
      expect(mockSetItemAsync).toHaveBeenCalledWith(
        "google_access_token",
        "TOKEN",
      );

      expect(mockDeleteItemAsync).toHaveBeenCalledTimes(1);
      expect(mockDeleteItemAsync).toHaveBeenCalledWith(
        "google_access_token_meta",
      );
    });
  });

  describe("getGoogleAccessToken", () => {
    it("returns accessToken + parsed meta when meta JSON is valid", async () => {
      mockGetItemAsync.mockResolvedValueOnce("TOKEN"); // access token
      mockGetItemAsync.mockResolvedValueOnce(
        JSON.stringify({ issuedAt: 1, expiresIn: 2 }),
      ); // meta

      const res = await getGoogleAccessToken();

      expect(mockGetItemAsync).toHaveBeenCalledTimes(2);
      expect(mockGetItemAsync.mock.calls[0]).toEqual(["google_access_token"]);
      expect(mockGetItemAsync.mock.calls[1]).toEqual(["google_access_token_meta"]);

      expect(res).toEqual({
        accessToken: "TOKEN",
        meta: { issuedAt: 1, expiresIn: 2 },
      });
    });

    it("returns meta null if meta JSON is invalid", async () => {
      mockGetItemAsync.mockResolvedValueOnce("TOKEN");
      mockGetItemAsync.mockResolvedValueOnce("{not-json");

      const res = await getGoogleAccessToken();

      expect(res).toEqual({
        accessToken: "TOKEN",
        meta: null,
      });
    });

    it("returns meta null if meta is missing", async () => {
      mockGetItemAsync.mockResolvedValueOnce("TOKEN");
      mockGetItemAsync.mockResolvedValueOnce(null);

      const res = await getGoogleAccessToken();

      expect(res).toEqual({
        accessToken: "TOKEN",
        meta: null,
      });
    });

    it("returns accessToken null if access token is missing", async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);
      mockGetItemAsync.mockResolvedValueOnce(null);

      const res = await getGoogleAccessToken();

      expect(res).toEqual({
        accessToken: null,
        meta: null,
      });
    });
  });

  describe("deleteGoogleAccessToken", () => {
    it("deletes both token and meta keys", async () => {
      mockDeleteItemAsync.mockResolvedValueOnce(undefined);
      mockDeleteItemAsync.mockResolvedValueOnce(undefined);

      await deleteGoogleAccessToken();

      expect(mockDeleteItemAsync).toHaveBeenCalledTimes(2);
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("google_access_token");
      expect(mockDeleteItemAsync).toHaveBeenCalledWith("google_access_token_meta");
    });
  });

  describe("isTokenLikelyExpired", () => {
    it("returns false when meta is null", () => {
      expect(isTokenLikelyExpired(null)).toBe(false);
    });

    it("returns false when issuedAt missing", () => {
      expect(isTokenLikelyExpired({ expiresIn: 3600 })).toBe(false);
    });

    it("returns false when expiresIn missing", () => {
      expect(isTokenLikelyExpired({ issuedAt: 1000 })).toBe(false);
    });

    it("returns false when token is still valid (with 60s safety buffer)", () => {
      // nowSec = 10000
      jest.spyOn(Date, "now").mockReturnValue(10000 * 1000);

      // expires at issuedAt + expiresIn = 10000
      // with buffer => 9940; now 10000 >= 9940 would be true, so pick a later expiry
      // set expiry at 10100, buffer point 10040, now 10000 < 10040 => false
      const meta = { issuedAt: 10000, expiresIn: 100 };

      expect(isTokenLikelyExpired(meta)).toBe(false);
    });

    it("returns true when token is expired or within buffer window", () => {
      jest.spyOn(Date, "now").mockReturnValue(10000 * 1000);

      // expires at 10000, buffer point 9940, now 10000 >= 9940 => true
      const meta = { issuedAt: 9000, expiresIn: 1000 };

      expect(isTokenLikelyExpired(meta)).toBe(true);
    });
  });
});