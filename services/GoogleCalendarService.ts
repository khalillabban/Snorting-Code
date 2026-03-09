// services/GoogleCalendarService.ts

export type GoogleCalendarDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarPerson = {
  email?: string;
  displayName?: string;
};

export type GoogleCalendarAttendee = {
  email?: string;
  responseStatus?: string;
};

export type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleCalendarDateTime;
  end?: GoogleCalendarDateTime;
  recurringEventId?: string;
  originalStartTime?: GoogleCalendarDateTime;
  organizer?: GoogleCalendarPerson;
  creator?: GoogleCalendarPerson;
  attendees?: GoogleCalendarAttendee[];
};

export type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  timeZone?: string;
  hidden?: boolean;
  deleted?: boolean;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

export type GoogleCalendarListSyncResult = {
  items: GoogleCalendarListItem[];
  nextSyncToken: string | null;
};

export type GoogleCalendarEventsSyncResult = {
  items: GoogleCalendarEvent[];
  nextSyncToken: string | null;
};

export class GoogleCalendarApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GoogleCalendarApiError";
    this.status = status;
  }
}

async function readErrorText(res: Response) {
  try {
    const text = await res.text();
    return text || res.statusText;
  } catch {
    return res.statusText;
  }
}

function assertToken(accessToken: string) {
  if (typeof accessToken !== "string") {
    throw new Error("Missing access token.");
  }

  const normalizedToken = accessToken.trim();

  if (!normalizedToken) {
    throw new Error("Missing access token.");
  }

  if (/\s/.test(normalizedToken)) {
    throw new Error("Invalid access token format.");
  }
}

function buildHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

export async function fetchCalendarList(
  accessToken: string,
): Promise<GoogleCalendarListItem[]> {
  assertToken(accessToken);

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    {
      headers: buildHeaders(accessToken),
    },
  );

  if (!res.ok) {
    const text = await readErrorText(res);
    throw new Error(`Calendar list failed (${res.status}): ${text}`);
  }

  const data: GoogleCalendarListResponse = await res.json();
  return data.items ?? [];
}

export async function syncCalendarList(params: {
  accessToken: string;
  syncToken?: string;
  maxResults?: number;
}): Promise<GoogleCalendarListSyncResult> {
  const { accessToken, syncToken } = params;
  const maxResults = params.maxResults ?? 250;

  assertToken(accessToken);

  const items: GoogleCalendarListItem[] = [];
  let nextPageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const qs = new URLSearchParams({
      maxResults: String(maxResults),
      showDeleted: "true",
      showHidden: "true",
    });

    if (syncToken) {
      qs.set("syncToken", syncToken);
    }

    if (nextPageToken) {
      qs.set("pageToken", nextPageToken);
    }

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/users/me/calendarList?${qs.toString()}`,
      {
        headers: buildHeaders(accessToken),
      },
    );

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new GoogleCalendarApiError(
        `Calendar list sync failed (${res.status}): ${text}`,
        res.status,
      );
    }

    const data: GoogleCalendarListResponse = await res.json();
    items.push(...(data.items ?? []));
    nextPageToken = data.nextPageToken;
    if (!nextPageToken) {
      nextSyncToken = data.nextSyncToken ?? null;
    }
  } while (nextPageToken);

  return {
    items,
    nextSyncToken,
  };
}

export async function fetchCalendarEventsInRange(params: {
  accessToken: string;
  timeMin: Date;
  timeMax: Date;
  calendarId?: string;
  maxResults?: number;
}): Promise<GoogleCalendarEvent[]> {
  const { accessToken, timeMin, timeMax } = params;
  const calendarId = params.calendarId ?? "primary";
  const maxResults = params.maxResults ?? 2500;

  assertToken(accessToken);

  if (!(timeMin instanceof Date) || isNaN(timeMin.getTime())) {
    throw new Error("timeMin must be a valid Date.");
  }
  if (!(timeMax instanceof Date) || isNaN(timeMax.getTime())) {
    throw new Error("timeMax must be a valid Date.");
  }

  const items: GoogleCalendarEvent[] = [];
  let nextPageToken: string | undefined;

  do {
    const qs = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults),
    });

    if (nextPageToken) {
      qs.set("pageToken", nextPageToken);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?${qs.toString()}`;

    const res = await fetch(url, {
      headers: buildHeaders(accessToken),
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new Error(`Events fetch failed (${res.status}): ${text}`);
    }

    const data: GoogleCalendarEventsResponse = await res.json();
    items.push(...(data.items ?? []));
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return items;
}

export async function syncCalendarEvents(params: {
  accessToken: string;
  calendarId?: string;
  syncToken?: string;
  maxResults?: number;
}): Promise<GoogleCalendarEventsSyncResult> {
  const { accessToken, syncToken } = params;
  const calendarId = params.calendarId ?? "primary";
  const maxResults = params.maxResults ?? 2500;

  assertToken(accessToken);

  const items: GoogleCalendarEvent[] = [];
  let nextPageToken: string | undefined;
  let nextSyncToken: string | null = null;

  do {
    const qs = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: String(maxResults),
    });

    if (syncToken) {
      qs.set("syncToken", syncToken);
    }

    if (nextPageToken) {
      qs.set("pageToken", nextPageToken);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?${qs.toString()}`;

    const res = await fetch(url, {
      headers: buildHeaders(accessToken),
    });

    if (!res.ok) {
      const text = await readErrorText(res);
      throw new GoogleCalendarApiError(
        `Events sync failed (${res.status}): ${text}`,
        res.status,
      );
    }

    const data: GoogleCalendarEventsResponse = await res.json();
    items.push(...(data.items ?? []));
    nextPageToken = data.nextPageToken;
    if (!nextPageToken) {
      nextSyncToken = data.nextSyncToken ?? null;
    }
  } while (nextPageToken);

  return {
    items,
    nextSyncToken,
  };
}
