import {
  fetchCalendarEventsInRange,
  fetchCalendarList,
  syncCalendarEvents,
  syncCalendarList,
} from "../services/GoogleCalendarService";

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: jest.Mock<Promise<any>, any>;
  text: jest.Mock<Promise<string>, any>;
};

function makeRes(overrides: Partial<MockResponse> = {}): MockResponse {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: jest.fn(async () => ({})),
    text: jest.fn(async () => ""),
    ...overrides,
  };
}

function expectMissingToken(
  call: () => Promise<unknown>,
  expectedMessage = "Missing access token.",
) {
  return expect(call()).rejects.toThrow(expectedMessage);
}

function expectInvalidTokenFormat(
  call: () => Promise<unknown>,
  expectedMessage = "Invalid access token format.",
) {
  return expect(call()).rejects.toThrow(expectedMessage);
}

describe("services/GoogleCalendarService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  describe("shared access token validation", () => {
    describe("fetchCalendarList", () => {
      it("throws for a missing token", async () => {
        await expectMissingToken(() => fetchCalendarList("" as any));
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("throws for a non-string token", async () => {
        await expectMissingToken(() => fetchCalendarList(null as any));
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("throws for a token containing whitespace", async () => {
        await expectInvalidTokenFormat(() =>
          fetchCalendarList("TOKEN WITH SPACE"),
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe("fetchCalendarEventsInRange", () => {
      const baseArgs = {
        timeMin: new Date("2026-01-01T00:00:00.000Z"),
        timeMax: new Date("2026-01-02T00:00:00.000Z"),
      };

      it("throws for a missing token", async () => {
        await expectMissingToken(() =>
          fetchCalendarEventsInRange({
            accessToken: "" as any,
            ...baseArgs,
          }),
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("throws for a non-string token", async () => {
        await expectMissingToken(() =>
          fetchCalendarEventsInRange({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            accessToken: null as any,
            ...baseArgs,
          }),
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it("throws for a token containing whitespace", async () => {
        await expectInvalidTokenFormat(() =>
          fetchCalendarEventsInRange({
            accessToken: "TOKEN WITH SPACE",
            ...baseArgs,
          }),
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });
  });

  describe("fetchCalendarList", () => {
    it("calls the calendarList endpoint with Bearer token and returns items", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({
          items: [{ id: "primary", summary: "Primary" }],
        })),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      const items = await fetchCalendarList("TOKEN");

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        {
          headers: {
            Authorization: "Bearer TOKEN",
            Accept: "application/json",
          },
        },
      );

      expect(items).toEqual([{ id: "primary", summary: "Primary" }]);
    });

    it("returns [] when response has no items", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({})),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(fetchCalendarList("TOKEN")).resolves.toEqual([]);
    });

    it("throws with status + error text when response not ok and res.text() returns content", async () => {
      const res = makeRes({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: jest.fn(async () => "invalid token"),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(fetchCalendarList("TOKEN")).rejects.toThrow(
        "Calendar list failed (401): invalid token",
      );
    });

    it("throws with statusText when response not ok and res.text() returns empty string", async () => {
      const res = makeRes({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: jest.fn(async () => ""),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(fetchCalendarList("TOKEN")).rejects.toThrow(
        "Calendar list failed (403): Forbidden",
      );
    });

    it("throws with statusText when response not ok and res.text() throws", async () => {
      const res = makeRes({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: jest.fn(async () => {
          throw new Error("boom");
        }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(fetchCalendarList("TOKEN")).rejects.toThrow(
        "Calendar list failed (500): Server Error",
      );
    });
  });

  describe("fetchCalendarEventsInRange", () => {
    it("throws if timeMin is not a valid Date", async () => {
      await expect(
        fetchCalendarEventsInRange({
          accessToken: "TOKEN",
          timeMin: new Date("not-a-date"),
          timeMax: new Date(),
        }),
      ).rejects.toThrow("timeMin must be a valid Date.");
    });

    it("throws if timeMax is not a valid Date", async () => {
      await expect(
        fetchCalendarEventsInRange({
          accessToken: "TOKEN",
          timeMin: new Date(),
          timeMax: new Date("not-a-date"),
        }),
      ).rejects.toThrow("timeMax must be a valid Date.");
    });

    it("uses default calendarId=primary and default maxResults=2500, returns items", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({
          items: [{ id: "e1", summary: "Event 1" }],
        })),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      const timeMin = new Date("2026-01-06T00:00:00.000Z");
      const timeMax = new Date("2026-01-07T00:00:00.000Z");

      const items = await fetchCalendarEventsInRange({
        accessToken: "TOKEN",
        timeMin,
        timeMax,
      });

      expect(items).toEqual([{ id: "e1", summary: "Event 1" }]);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl, options] = (global.fetch as jest.Mock).mock.calls[0];

      expect(typeof calledUrl).toBe("string");
      expect(calledUrl).toContain(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?",
      );
      expect(calledUrl).toContain(
        `timeMin=${encodeURIComponent(timeMin.toISOString())}`,
      );
      expect(calledUrl).toContain(
        `timeMax=${encodeURIComponent(timeMax.toISOString())}`,
      );
      expect(calledUrl).toContain("singleEvents=true");
      expect(calledUrl).toContain("orderBy=startTime");
      expect(calledUrl).toContain("maxResults=2500");

      expect(options).toEqual({
        headers: {
          Authorization: "Bearer TOKEN",
          Accept: "application/json",
        },
      });
    });

    it("encodes custom calendarId and uses provided maxResults", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({ items: [] })),
      });
      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      const timeMin = new Date("2026-01-06T00:00:00.000Z");
      const timeMax = new Date("2026-01-06T01:00:00.000Z");

      await fetchCalendarEventsInRange({
        accessToken: "TOKEN",
        timeMin,
        timeMax,
        calendarId: "group calendar/with spaces",
        maxResults: 10,
      });

      const [calledUrl] = (global.fetch as jest.Mock).mock.calls[0];
      expect(calledUrl).toContain(
        "calendars/group%20calendar%2Fwith%20spaces/events?",
      );
      expect(calledUrl).toContain("maxResults=10");
    });

    it("returns [] when events response has no items", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({})),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      const items = await fetchCalendarEventsInRange({
        accessToken: "TOKEN",
        timeMin: new Date("2026-01-01T00:00:00.000Z"),
        timeMax: new Date("2026-01-02T00:00:00.000Z"),
      });

      expect(items).toEqual([]);
    });

    it("throws with status + error text when response not ok and res.text() returns content", async () => {
      const res = makeRes({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: jest.fn(async () => "bad query"),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(
        fetchCalendarEventsInRange({
          accessToken: "TOKEN",
          timeMin: new Date("2026-01-01T00:00:00.000Z"),
          timeMax: new Date("2026-01-02T00:00:00.000Z"),
        }),
      ).rejects.toThrow("Events fetch failed (400): bad query");
    });

    it("throws with statusText when response not ok and res.text() returns empty string", async () => {
      const res = makeRes({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: jest.fn(async () => ""),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(
        fetchCalendarEventsInRange({
          accessToken: "TOKEN",
          timeMin: new Date("2026-01-01T00:00:00.000Z"),
          timeMax: new Date("2026-01-02T00:00:00.000Z"),
        }),
      ).rejects.toThrow("Events fetch failed (403): Forbidden");
    });

    it("throws with statusText when response not ok and res.text() throws", async () => {
      const res = makeRes({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: jest.fn(async () => {
          throw new Error("boom");
        }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(
        fetchCalendarEventsInRange({
          accessToken: "TOKEN",
          timeMin: new Date("2026-01-01T00:00:00.000Z"),
          timeMax: new Date("2026-01-02T00:00:00.000Z"),
        }),
      ).rejects.toThrow("Events fetch failed (500): Server Error");
    });

    it("follows nextPageToken and accumulates items across pages", async () => {
      const page1 = makeRes({
        json: jest.fn(async () => ({
          items: [{ id: "e1" }, { id: "e2" }],
          nextPageToken: "token-page-2",
        })),
      });
      const page2 = makeRes({
        json: jest.fn(async () => ({
          items: [{ id: "e3" }],
        })),
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      const items = await fetchCalendarEventsInRange({
        accessToken: "TOKEN",
        timeMin: new Date("2026-01-01T00:00:00.000Z"),
        timeMax: new Date("2026-06-01T00:00:00.000Z"),
      });

      expect(items).toHaveLength(3);
      expect(items.map((i) => i.id)).toEqual(["e1", "e2", "e3"]);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      const [secondUrl] = (global.fetch as jest.Mock).mock.calls[1] as [string];

      const url = new URL(secondUrl);
      const params = new URLSearchParams(url.search);

      expect(params.get("pageToken")).toBe("token-page-2");
    });
  });

  describe("syncCalendarList", () => {
    it("passes syncToken and returns nextSyncToken", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({
          items: [{ id: "primary", summary: "Primary" }],
          nextSyncToken: "next-sync-token",
        })),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      const result = await syncCalendarList({
        accessToken: "TOKEN",
        syncToken: "existing-sync-token",
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl] = (global.fetch as jest.Mock).mock.calls[0];

      expect(calledUrl).toContain(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?",
      );
      expect(calledUrl).toContain("showDeleted=true");
      expect(calledUrl).toContain("showHidden=true");
      expect(calledUrl).toContain("syncToken=existing-sync-token");
      expect(result).toEqual({
        items: [{ id: "primary", summary: "Primary" }],
        nextSyncToken: "next-sync-token",
      });
    });
  });

  describe("syncCalendarEvents", () => {
    it("passes syncToken, returns nextSyncToken, and keeps deleted events enabled", async () => {
      const res = makeRes({
        json: jest.fn(async () => ({
          items: [{ id: "event-1", summary: "COMP 346 LEC" }],
          nextSyncToken: "events-next-sync",
        })),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      const result = await syncCalendarEvents({
        accessToken: "TOKEN",
        calendarId: "primary",
        syncToken: "events-existing-sync",
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [calledUrl] = (global.fetch as jest.Mock).mock.calls[0];

      expect(calledUrl).toContain("calendars/primary/events?");
      expect(calledUrl).toContain("singleEvents=true");
      expect(calledUrl).toContain("showDeleted=true");
      expect(calledUrl).toContain("syncToken=events-existing-sync");
      expect(result).toEqual({
        items: [{ id: "event-1", summary: "COMP 346 LEC" }],
        nextSyncToken: "events-next-sync",
      });
    });

    it("throws with status + error text when sync response is not ok", async () => {
      const res = makeRes({
        ok: false,
        status: 410,
        statusText: "Gone",
        text: jest.fn(async () => "invalid sync token"),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce(res);

      await expect(
        syncCalendarEvents({
          accessToken: "TOKEN",
          calendarId: "primary",
          syncToken: "bad-sync-token",
        }),
      ).rejects.toThrow("Events sync failed (410): invalid sync token");
    });
  });
});
