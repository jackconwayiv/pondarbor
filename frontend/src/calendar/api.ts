import type {
  CalendarEvent,
  CalendarOwnerRow,
  CalendarSource,
  EventWritePayload,
  SourceCreatePayload,
  SourceSyncSummary,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function authHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) {
    throw new Error(
      "Missing API access token. Refresh your session and try again.",
    );
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown> & {
      detail?: unknown;
    };
    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail;
    }
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim().length > 0) return value;
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0] as string;
      }
    }
  } catch {
    // Fall through to raw text.
  }
  return text || `Request failed (${response.status})`;
}

export type OwnerQuery = "me" | "all" | number;

function ownerParam(value: OwnerQuery): string {
  if (value === "me" || value === "all") return value;
  return String(value);
}

export type FetchEventsParams = {
  /** Inclusive ISO date (YYYY-MM-DD). */
  start_date: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  end_date: string;
  /** "all", "me", or a single user id. Defaults to "all". */
  owner?: OwnerQuery;
  /**
   * Optional comma-separated allow-list of approved user ids. When supplied,
   * the server only returns events for these owners (in addition to the
   * `owner` filter above). If the list is empty after filtering to approved
   * owners, the server returns an empty result.
   */
  ownerIds?: number[];
};

export async function fetchCalendarEvents(
  accessToken: string | null,
  params: FetchEventsParams,
): Promise<CalendarEvent[]> {
  const query = new URLSearchParams({
    start_date: params.start_date,
    end_date: params.end_date,
    owner: ownerParam(params.owner ?? "all"),
  });
  if (params.ownerIds !== undefined) {
    // Send the list explicitly even when empty so the server can return [].
    query.set("owner_ids", params.ownerIds.join(","));
  }
  const response = await fetch(
    `${apiBase()}/api/v1/calendars/events/?${query.toString()}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { results?: CalendarEvent[] };
  return data.results ?? [];
}

export async function createCalendarEvent(
  accessToken: string | null,
  payload: EventWritePayload,
): Promise<CalendarEvent> {
  const response = await fetch(`${apiBase()}/api/v1/calendars/events/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as CalendarEvent;
}

export async function updateCalendarEvent(
  accessToken: string | null,
  eventId: number,
  payload: EventWritePayload,
): Promise<CalendarEvent> {
  const response = await fetch(
    `${apiBase()}/api/v1/calendars/events/${eventId}/`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as CalendarEvent;
}

export async function deleteCalendarEvent(
  accessToken: string | null,
  eventId: number,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/calendars/events/${eventId}/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function fetchCalendarSources(
  accessToken: string | null,
): Promise<CalendarSource[]> {
  const response = await fetch(`${apiBase()}/api/v1/calendars/sources/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { results?: CalendarSource[] };
  return data.results ?? [];
}

export async function createCalendarSource(
  accessToken: string | null,
  payload: SourceCreatePayload,
): Promise<{ source: CalendarSource; synced: SourceSyncSummary }> {
  const response = await fetch(`${apiBase()}/api/v1/calendars/sources/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as {
    source: CalendarSource;
    synced: SourceSyncSummary;
  };
}

export async function syncCalendarSource(
  accessToken: string | null,
  sourceId: number,
): Promise<{ source: CalendarSource; synced: SourceSyncSummary }> {
  const response = await fetch(
    `${apiBase()}/api/v1/calendars/sources/${sourceId}/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as {
    source: CalendarSource;
    synced: SourceSyncSummary;
  };
}

export async function deleteCalendarSource(
  accessToken: string | null,
  sourceId: number,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/calendars/sources/${sourceId}/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function fetchApprovedUsers(
  accessToken: string | null,
  query = "",
): Promise<CalendarOwnerRow[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString();
  const response = await fetch(
    `${apiBase()}/api/v1/calendars/approved-users/${search ? `?${search}` : ""}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { results?: CalendarOwnerRow[] };
  return data.results ?? [];
}
