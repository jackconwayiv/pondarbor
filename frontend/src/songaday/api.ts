import type { ParsedSongFields } from "./types";

export type ResolveSongLinkResult = {
  artist: string;
  title: string;
  source: string;
};

/** Priority: YouTube id, then Spotify URL, then Apple Music URL. */
export function buildResolveRequestBody(
  fields: ParsedSongFields,
): { url?: string; youtube_video_id?: string } | null {
  const yt = fields.youtube_video_id.trim();
  const sp = fields.spotify_url.trim();
  const am = fields.apple_music_url.trim();
  if (yt) return { youtube_video_id: yt };
  if (sp) return { url: sp };
  if (am) return { url: am };
  return null;
}
import type {
  SongadayArchiveListResponse,
  SongadayPlaylistBrowseRow,
  SongadayPlaylistMonthResponse,
  SongadayPromptPayload,
  SongadayResponse,
  SongPromptCatalogRow,
} from "./types";

function normalizeSongResponse(row: SongadayResponse): SongadayResponse {
  return { ...row, comment_count: row.comment_count ?? 0 };
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function authHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) {
    throw new Error("Missing API access token. Refresh your session and try again.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail;
  } catch {
    /* ignore */
  }
  return text || `Request failed (${response.status})`;
}

function ymdParams(d: Date): URLSearchParams {
  const p = new URLSearchParams();
  p.set("year", String(d.getFullYear()));
  p.set("month", String(d.getMonth() + 1));
  p.set("day", String(d.getDate()));
  return p;
}

export async function resolveSongLinkMetadata(
  accessToken: string | null,
  body: { url?: string; youtube_video_id?: string },
): Promise<ResolveSongLinkResult> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/resolve-link/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ResolveSongLinkResult;
}

/** Staff-only: all prompts in calendar order (month, day). */
export async function fetchAllSongPrompts(
  accessToken: string | null,
): Promise<SongPromptCatalogRow[]> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/prompts/catalog/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = (await response.json()) as { results: SongPromptCatalogRow[] };
  return data.results;
}

export async function fetchPromptForDate(
  accessToken: string | null,
  d: Date,
): Promise<SongadayPromptPayload> {
  const response = await fetch(
    `${apiBase()}/api/v1/songaday/prompts/for-date/?${ymdParams(d).toString()}`,
    { method: "GET", headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as SongadayPromptPayload;
}

export async function fetchResponsesForDate(
  accessToken: string | null,
  d: Date,
): Promise<SongadayResponse[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/songaday/responses/for-date/?${ymdParams(d).toString()}`,
    { method: "GET", headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const raw = (await response.json()) as SongadayResponse[];
  return raw.map(normalizeSongResponse);
}

/** Single GET: prompts + responses per ISO date for [start_date, end_date], plus archive seed (page 1, size 50). */
export async function fetchSongadayDayWindow(
  accessToken: string | null,
  startDateIso: string,
  endDateIso: string,
): Promise<{
  prompts: Record<string, SongadayPromptPayload>;
  responses: Record<string, SongadayResponse[]>;
  archive_seed: SongadayArchiveListResponse;
}> {
  const q = new URLSearchParams();
  q.set("start_date", startDateIso);
  q.set("end_date", endDateIso);
  const response = await fetch(
    `${apiBase()}/api/v1/songaday/day-window/?${q.toString()}`,
    { method: "GET", headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const raw = (await response.json()) as {
    prompts: Record<string, SongadayPromptPayload>;
    responses: Record<string, SongadayResponse[]>;
    archive_seed: SongadayArchiveListResponse;
  };
  const responses: Record<string, SongadayResponse[]> = {};
  for (const [iso, rows] of Object.entries(raw.responses ?? {})) {
    responses[iso] = (rows ?? []).map(normalizeSongResponse);
  }
  const arch = raw.archive_seed;
  return {
    prompts: raw.prompts ?? {},
    responses,
    archive_seed: {
      ...arch,
      results: (arch?.results ?? []).map(normalizeSongResponse),
    },
  };
}

/** Newest first; optional `userId` loads a friend's archive (must be an approved friend). */
export async function fetchResponsesArchive(
  accessToken: string | null,
  userId?: number | null,
  page: number = 1,
  pageSize: number = 10,
): Promise<SongadayArchiveListResponse> {
  const q = new URLSearchParams();
  if (userId != null) q.set("user_id", String(userId));
  q.set("page", String(page));
  q.set("page_size", String(pageSize));
  const response = await fetch(
    `${apiBase()}/api/v1/songaday/responses/archive/?${q.toString()}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const payload = (await response.json()) as SongadayArchiveListResponse;
  return {
    ...payload,
    results: payload.results.map(normalizeSongResponse),
  };
}

export async function fetchPlaylistsBrowse(
  accessToken: string | null,
): Promise<{ results: SongadayPlaylistBrowseRow[] }> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/playlists/browse/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const payload = (await response.json()) as { results?: SongadayPlaylistBrowseRow[] };
  return { results: Array.isArray(payload.results) ? payload.results : [] };
}

export async function fetchPlaylistsMonth(
  accessToken: string | null,
  params: { userId: number; year: number; month: number },
): Promise<SongadayPlaylistMonthResponse> {
  const q = new URLSearchParams();
  q.set("user_id", String(params.userId));
  q.set("year", String(params.year));
  q.set("month", String(params.month));
  const response = await fetch(
    `${apiBase()}/api/v1/songaday/playlists/month/?${q.toString()}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const payload = (await response.json()) as SongadayPlaylistMonthResponse;
  return {
    ...payload,
    results: payload.results.map(normalizeSongResponse),
  };
}

/** Friend IDs who have at least one submission (for archive friend picker). */
export async function fetchArchiveEligibleFriendIds(
  accessToken: string | null,
): Promise<{ user_ids: number[] }> {
  const response = await fetch(
    `${apiBase()}/api/v1/songaday/responses/archive/eligible-friends/`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as { user_ids: number[] };
}

export async function fetchResponse(
  accessToken: string | null,
  id: number,
): Promise<SongadayResponse> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/responses/${id}/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return normalizeSongResponse((await response.json()) as SongadayResponse);
}

export async function createResponse(
  accessToken: string | null,
  entryDate: Date,
  promptSnapshot: string,
  fields: ParsedSongFields & { notes: string },
): Promise<SongadayResponse> {
  const body = {
    entry_date: `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}-${String(entryDate.getDate()).padStart(2, "0")}`,
    prompt_snapshot: promptSnapshot,
    notes: fields.notes,
    artist: fields.artist,
    title: fields.title,
    raw_label: fields.raw_label,
    youtube_video_id: fields.youtube_video_id,
    spotify_url: fields.spotify_url,
    apple_music_url: fields.apple_music_url,
  };
  const response = await fetch(`${apiBase()}/api/v1/songaday/responses/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return normalizeSongResponse((await response.json()) as SongadayResponse);
}

export async function patchResponse(
  accessToken: string | null,
  id: number,
  patch: Partial<
    Pick<
      ParsedSongFields,
      "artist" | "title" | "raw_label" | "youtube_video_id" | "spotify_url" | "apple_music_url"
    > & { notes: string }
  >,
): Promise<SongadayResponse> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/responses/${id}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return normalizeSongResponse((await response.json()) as SongadayResponse);
}

export async function deleteResponse(accessToken: string | null, id: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/responses/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function toggleHeart(
  accessToken: string | null,
  responseId: number,
): Promise<{ heart_count: number; viewer_has_hearted: boolean }> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/responses/${responseId}/heart/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as { heart_count: number; viewer_has_hearted: boolean };
}

export async function bulkImportPrompts(accessToken: string | null, text: string): Promise<{
  created_count: number;
  updated_count: number;
  total: number;
}> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/prompts/bulk-import/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as {
    created_count: number;
    updated_count: number;
    total: number;
  };
}

export type SongadaySlackDailyPromptSyncResult = {
  posted: boolean;
  reason?: string;
  slack_ts?: string;
  detail?: string;
};

/** Idempotent: first approved open of the day may post today’s prompt to Slack (server-side). */
export async function songadaySlackDailyPromptSync(
  accessToken: string | null,
): Promise<SongadaySlackDailyPromptSyncResult> {
  const response = await fetch(`${apiBase()}/api/v1/songaday/slack/daily-prompt-sync/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({}),
  });
  const data = (await response.json().catch(() => ({}))) as SongadaySlackDailyPromptSyncResult & {
    detail?: string;
  };
  if (!response.ok) {
    return {
      posted: false,
      reason: data.reason ?? "request_failed",
      detail: typeof data.detail === "string" ? data.detail : undefined,
    };
  }
  return data;
}
