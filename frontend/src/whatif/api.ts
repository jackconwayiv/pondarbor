import type { WhatIfFullLifetimeStats, WhatIfMySessionsResponse, WhatIfSessionState } from "./types";

/** Thrown when GET session returns 404 (room code not in this environment's database). */
export class WhatIfRoomNotFoundError extends Error {
  constructor() {
    super("Room code not found. Check the 4-letter code and try again.");
    this.name = "WhatIfRoomNotFoundError";
  }
}

/** Query param for GET /whatif/questions/ — server filters non-deleted rows. */
export const WHATIF_QUESTION_LIST_FILTERS = ["all", "active", "inactive", "rejected"] as const;
export type WhatIfQuestionListFilter = (typeof WHATIF_QUESTION_LIST_FILTERS)[number];

export const WHATIF_QUESTION_LIST_FILTER_LABELS: Record<WhatIfQuestionListFilter, string> = {
  all: "All",
  active: "Active only",
  inactive: "Inactive only",
  rejected: "Rejected only",
};

export type WhatIfQuestionAdmin = {
  id: number;
  prompt: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  answer_4: string;
  answer_5: string;
  answer_6: string;
  is_active: boolean;
  review_status?: string;
  proposed_by?: number | null;
  deleted_at?: string | null;
  sessions_used_count: number;
  total_responses: number;
  total_scores: number;
  total_skips: number;
  created_at: string;
  updated_at: string;
};

const PLAYER_TOKEN_PREFIX = "whatif.playerToken:";
const HOST_TOKEN_PREFIX = "whatif.hostToken:";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function authHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) return { "Content-Type": "application/json" };
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export function playerTokenStorageKey(code: string): string {
  return `${PLAYER_TOKEN_PREFIX}${code.toUpperCase()}`;
}

export function savePlayerToken(code: string, token: string): void {
  sessionStorage.setItem(playerTokenStorageKey(code), token);
}

export function loadPlayerToken(code: string): string | null {
  return sessionStorage.getItem(playerTokenStorageKey(code));
}

export function clearPlayerToken(code: string): void {
  sessionStorage.removeItem(playerTokenStorageKey(code));
}

/** All room codes with a player token saved in this tab's sessionStorage. */
export function listStoredWhatIfPlayerCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key?.startsWith(PLAYER_TOKEN_PREFIX)) continue;
    const code = key.slice(PLAYER_TOKEN_PREFIX.length).trim().toUpperCase();
    if (code.length === 4) codes.push(code);
  }
  return codes;
}

export function hostTokenStorageKey(code: string): string {
  return `${HOST_TOKEN_PREFIX}${code.toUpperCase()}`;
}

export function saveHostToken(code: string, token: string): void {
  sessionStorage.setItem(hostTokenStorageKey(code), token);
}

export function loadHostToken(code: string): string | null {
  return sessionStorage.getItem(hostTokenStorageKey(code));
}

/** Requires a logged-in user (Bearer); does not create a player row. */
export async function fetchMyWhatIfSessions(
  accessToken: string,
): Promise<WhatIfMySessionsResponse> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/sessions/mine/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 401 || response.status === 403) {
    const text = await response.text();
    let detail = "Could not load your games.";
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (typeof j.detail === "string" && j.detail.trim()) detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (!response.ok) {
    throw new Error(`Failed to load your games (${response.status})`);
  }
  return (await response.json()) as WhatIfMySessionsResponse;
}

/** Best-effort: close open lobbies older than 24 hours. Requires sign-in. */
export async function closeStaleWhatIfOpenSessions(accessToken: string): Promise<number> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/sessions/close-stale-open/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 401 || response.status === 403) {
    return 0;
  }
  if (!response.ok) {
    throw new Error(`Failed to close stale open games (${response.status})`);
  }
  const body = (await response.json()) as { closed_count?: number };
  return typeof body.closed_count === "number" ? body.closed_count : 0;
}

export async function fetchWhatIfLifetimeStats(
  accessToken: string,
): Promise<WhatIfFullLifetimeStats> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/lifetime-stats/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Sign in to view lifetime stats.");
  }
  if (!response.ok) {
    throw new Error(`Failed to load lifetime stats (${response.status})`);
  }
  return (await response.json()) as WhatIfFullLifetimeStats;
}

export async function createWhatIfSession(accessToken: string): Promise<{
  short_code: string;
  host_secret: string;
}> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/sessions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });
  if (response.status === 401 || response.status === 403) {
    const text = await response.text();
    let detail = "Sign in to create a game.";
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (typeof j.detail === "string" && j.detail.trim()) detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (!response.ok) throw new Error(`Failed to create session (${response.status})`);
  return (await response.json()) as { short_code: string; host_secret: string };
}

/** Logged-in host only; re-fetches host_secret for an existing room you own. */
export async function resumeHostingSession(
  accessToken: string,
  code: string,
): Promise<{ short_code: string; host_secret: string; status: string }> {
  const response = await fetch(
    `${apiBase()}/api/v1/whatif/sessions/${code.toUpperCase()}/resume-host/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "omit",
    },
  );
  if (response.status === 401 || response.status === 403) {
    const text = await response.text();
    let detail = "You cannot resume hosting this room.";
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  if (!response.ok) throw new Error(`Failed to resume hosting (${response.status})`);
  return (await response.json()) as { short_code: string; host_secret: string; status: string };
}

export async function joinWhatIfSession(
  code: string,
  displayName: string,
  accessToken: string | null,
): Promise<{ player_secret: string }> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/sessions/${code.toUpperCase()}/join/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ display_name: displayName }),
  });
  if (!response.ok) {
    const text = await response.text();
    let detail = "";
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (typeof j.detail === "string" && j.detail.trim()) detail = j.detail.trim();
    } catch {
      /* ignore non-JSON errors */
    }
    if (response.status === 404) {
      throw new WhatIfRoomNotFoundError();
    }
    if (detail) throw new Error(detail);
    throw new Error(`Failed to join game (${response.status})`);
  }
  return (await response.json()) as { player_secret: string };
}

export async function fetchWhatIfTvState(
  code: string,
  since?: number,
): Promise<WhatIfSessionState | null> {
  const query = new URLSearchParams();
  if (typeof since === "number") query.set("since", String(since));
  const response = await fetch(
    `${apiBase()}/api/v1/whatif/sessions/${code.toUpperCase()}/${query.toString() ? `?${query}` : ""}`,
    { method: "GET", cache: "no-store" },
  );
  if (response.status === 304) return null;
  if (response.status === 404) throw new WhatIfRoomNotFoundError();
  if (!response.ok) throw new Error(`Failed to fetch session (${response.status})`);
  return (await response.json()) as WhatIfSessionState;
}

/** Maps backend `detail` strings to short copy for the phone hand UI. */
const WHATIF_ACTION_DETAIL_FRIENDLY: Record<string, string> = {
  "Not in voting state.": "That action isn’t available during this phase.",
  "Not in voting state": "That action isn’t available during this phase.",
  "Voting is paused. Wait for the active player to resume.":
    "Voting is paused. Wait for the active player to resume.",
  "Reveal is only allowed during voting.": "You can’t reveal votes right now.",
  "Subject pick is only allowed during turn state.": "You can’t pick a subject right now.",
  "Subject die choice is only allowed during turn state.": "You can’t choose a die option right now.",
  "Choosing who to challenge is only allowed during turn state.":
    "You can’t choose an opponent right now.",
  "Pause is only available during voting.": "Pause isn’t available right now.",
  "Missing or invalid player token.": "Reconnect to this room from the join screen.",
  "Winner will be declared after the score reveal.":
    "This round decided the game — hang on while scores finish on the TV.",
  "Game has ended.": "This game is over.",
};

function friendlyWhatIfActionBody(status: number, bodyText: string): string {
  let detail = bodyText.trim();
  try {
    const j = JSON.parse(bodyText) as { detail?: unknown };
    if (typeof j.detail === "string") detail = j.detail.trim();
  } catch {
    /* use raw body */
  }
  const mapped = WHATIF_ACTION_DETAIL_FRIENDLY[detail];
  if (mapped) return mapped;
  if (detail.length > 220) return `${detail.slice(0, 217)}…`;
  return detail || `Something went wrong (${status}).`;
}

/**
 * Turns errors thrown by {@link postWhatIfAction} into player-facing text (no raw JSON).
 */
export function friendlyWhatIfActionMessage(error: unknown): string {
  if (!(error instanceof Error)) return "Something went wrong. Try again.";
  const m = error.message.match(/^Action failed \(\d+\):\s*([\s\S]*)$/);
  if (!m) return error.message;
  const statusMatch = error.message.match(/^Action failed \((\d+)\):/);
  const status = statusMatch ? Number(statusMatch[1]) : 400;
  return friendlyWhatIfActionBody(status, m[1] ?? "");
}

export async function fetchWhatIfHandState(
  code: string,
  playerToken: string,
  since?: number,
): Promise<WhatIfSessionState | null> {
  const query = new URLSearchParams();
  if (typeof since === "number") query.set("since", String(since));
  const response = await fetch(
    `${apiBase()}/api/v1/whatif/sessions/${code.toUpperCase()}/hand/${query.toString() ? `?${query}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
      headers: { "X-Whatif-Player-Token": playerToken },
    },
  );
  if (response.status === 304) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch hand state (${response.status}): ${text}`);
  }
  return (await response.json()) as WhatIfSessionState;
}

export async function postWhatIfAction(
  code: string,
  payload: {
    type:
      | "start_game"
      | "pick_subject"
      | "pick_subject_die_choice"
      | "pick_duel_opponent"
      | "vote"
      | "unvote"
      | "reveal"
      | "next_turn"
      | "skip"
      | "request_question_skip"
      | "resolve_question_skip"
      | "set_player_paused"
      | "toggle_voting_pause"
      | "complete_game"
      | "add_npc"
      | "remove_npc"
      | "leave_game";
    option_index?: number;
    target_player_id?: number;
    npc_id?: number;
    display_name?: string;
    paused?: boolean;
    challenge?: boolean;
    approve?: boolean;
    choice?: "a" | "b";
  },
  opts: { playerToken?: string | null; hostToken?: string | null },
): Promise<WhatIfSessionState> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.playerToken) headers["X-Whatif-Player-Token"] = opts.playerToken;
  if (opts.hostToken) headers["X-Whatif-Host-Token"] = opts.hostToken;
  const response = await fetch(`${apiBase()}/api/v1/whatif/sessions/${code.toUpperCase()}/action/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Action failed (${response.status}): ${text}`);
  }
  return (await response.json()) as WhatIfSessionState;
}

export async function fetchWhatIfPendingCount(accessToken: string): Promise<number> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/questions/pending-count/`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Failed to fetch pending count (${response.status})`);
  const body = (await response.json()) as { pending_count: number };
  return body.pending_count;
}

export async function listWhatIfQuestions(
  accessToken: string,
  q?: string,
  options?: { listFilter?: WhatIfQuestionListFilter },
): Promise<WhatIfQuestionAdmin[]> {
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  const listFilter = options?.listFilter ?? "all";
  if (listFilter !== "all") params.set("list_filter", listFilter);
  const response = await fetch(
    `${apiBase()}/api/v1/whatif/questions/${params.toString() ? `?${params}` : ""}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!response.ok) throw new Error(`Failed to list questions (${response.status})`);
  return (await response.json()) as WhatIfQuestionAdmin[];
}

export async function proposeWhatIfQuestion(
  accessToken: string,
  payload: Pick<
    WhatIfQuestionAdmin,
    "prompt" | "answer_1" | "answer_2" | "answer_3" | "answer_4" | "answer_5" | "answer_6"
  >,
): Promise<WhatIfQuestionAdmin> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/questions/propose/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to propose question (${response.status}): ${text}`);
  }
  return (await response.json()) as WhatIfQuestionAdmin;
}

export async function createWhatIfQuestion(
  accessToken: string,
  payload: Pick<
    WhatIfQuestionAdmin,
    "prompt" | "answer_1" | "answer_2" | "answer_3" | "answer_4" | "answer_5" | "answer_6" | "is_active"
  >,
): Promise<WhatIfQuestionAdmin> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/questions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Failed to create question (${response.status})`);
  return (await response.json()) as WhatIfQuestionAdmin;
}

export async function patchWhatIfQuestion(
  accessToken: string,
  id: number,
  payload: Partial<
    Pick<
      WhatIfQuestionAdmin,
      | "prompt"
      | "answer_1"
      | "answer_2"
      | "answer_3"
      | "answer_4"
      | "answer_5"
      | "answer_6"
      | "is_active"
      | "review_status"
    >
  >,
): Promise<WhatIfQuestionAdmin> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/questions/${id}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Failed to update question (${response.status})`);
  return (await response.json()) as WhatIfQuestionAdmin;
}

export async function deleteWhatIfQuestion(accessToken: string, id: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/questions/${id}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) throw new Error(`Failed to delete question (${response.status})`);
}

export async function bulkImportWhatIfQuestions(
  accessToken: string,
  text: string,
): Promise<{ created_count: number; questions: WhatIfQuestionAdmin[] }> {
  const response = await fetch(`${apiBase()}/api/v1/whatif/questions/bulk-import/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to import questions (${response.status}): ${body}`);
  }
  return (await response.json()) as { created_count: number; questions: WhatIfQuestionAdmin[] };
}

