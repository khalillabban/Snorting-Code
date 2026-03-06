// services/GoogleCalendarService.ts

export type GoogleCalendarDateTime = {
  date?: string; // all-day events
  dateTime?: string; // timed events
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
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[];
  nextPageToken?: string;
};

type GoogleCalendarEventsResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};

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

/**
 * Fetch calendars available to the signed-in user.
 * Useful to debug “events are on a different calendar”.
 */
export async function fetchCalendarList(
  accessToken: string,
): Promise<GoogleCalendarListItem[]> {
  assertToken(accessToken);

  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await readErrorText(res);
    throw new Error(`Calendar list failed (${res.status}): ${text}`);
  }

  const data: GoogleCalendarListResponse = await res.json();
  return data.items ?? [];
}

/**
 * Fetch events for a given calendar within a time range.
 * Default calendarId is "primary".
 * Supports pagination because Google Calendar may return a nextPageToken
 * when the result set exceeds the maxResults limit.
 */
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
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
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