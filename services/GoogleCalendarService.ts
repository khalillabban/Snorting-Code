// services/GoogleCalendarService.ts

export type GoogleCalendarDateTime = {
  date?: string; // all-day events
  dateTime?: string; // timed events
  timeZone?: string;
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

  organizer?: { email?: string; displayName?: string };
  creator?: { email?: string; displayName?: string };

  attendees?: Array<{ email?: string; responseStatus?: string }>;

  // Allow extra fields without TypeScript complaining
  [key: string]: any;
};

export type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  description?: string;
  primary?: boolean;
  accessRole?: string;
  timeZone?: string;
  [key: string]: any;
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
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Missing access token.");
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

  const data = await res.json();
  return data?.items ?? [];
}

/**
 * Fetch events for a given calendar within a time range.
 * Default calendarId is "primary".
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

  const qs = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(maxResults),
  });

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

  const data = await res.json();
  return data?.items ?? [];
}