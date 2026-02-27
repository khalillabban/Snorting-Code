// services/GoogleCalendarService.ts
export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

type ListEventsResponse = {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
};

function toISO(d: Date) {
  return d.toISOString();
}

export async function fetchCalendarEventsInRange(args: {
  accessToken: string;
  timeMin: Date;
  timeMax: Date;
  calendarId?: string; // default: primary
}): Promise<GoogleCalendarEvent[]> {
  const { accessToken, timeMin, timeMax, calendarId = "primary" } = args;

  const baseUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId,
  )}/events`;

  const all: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  // Google allows large sets; we’ll page until done.
  for (let i = 0; i < 50; i++) {
    const url = new URL(baseUrl);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", toISO(timeMin));
    url.searchParams.set("timeMax", toISO(timeMax));
    url.searchParams.set("maxResults", "2500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Google Calendar API error (${res.status}): ${text}`);
    }

    const data = (await res.json()) as ListEventsResponse;

    if (data.items?.length) all.push(...data.items);

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return all;
}