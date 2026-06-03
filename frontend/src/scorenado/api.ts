import type {
  GameDetail,
  GameListItem,
  GameTag,
  ScoreboardTemplate,
  ScorenadoSeatInvite,
  ScorenadoStats,
  TemplateCategoryInput,
} from "./types";

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

function drfErrorToMessage(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    const pick = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
      return null;
    };
    return pick(data.detail) ?? pick(data.non_field_errors) ?? pick(data.name);
  } catch {
    return null;
  }
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  return drfErrorToMessage(text) ?? `Request failed (${response.status})`;
}

export async function fetchTemplates(
  accessToken: string | null,
): Promise<ScoreboardTemplate[]> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/templates/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as ScoreboardTemplate[];
}

export async function fetchTemplate(
  accessToken: string | null,
  templateId: string,
): Promise<ScoreboardTemplate> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/templates/${templateId}/`,
    {
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as ScoreboardTemplate;
}

export async function createTemplate(
  accessToken: string | null,
  payload: {
    name: string;
    scored_by_rounds?: boolean;
    low_score_wins?: boolean;
    min_players?: number;
    default_round_count?: number;
    is_published?: boolean;
    categories: TemplateCategoryInput[];
  },
): Promise<ScoreboardTemplate> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/templates/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as ScoreboardTemplate;
}

export async function updateTemplate(
  accessToken: string | null,
  templateId: string,
  payload: Partial<{
    name: string;
    scored_by_rounds: boolean;
    low_score_wins: boolean;
    min_players: number;
    default_round_count: number;
    is_published: boolean;
    categories: TemplateCategoryInput[];
  }>,
): Promise<ScoreboardTemplate> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/templates/${templateId}/`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as ScoreboardTemplate;
}

export async function deleteTemplate(
  accessToken: string | null,
  templateId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/templates/${templateId}/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function fetchGames(
  accessToken: string | null,
): Promise<GameListItem[]> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/games/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameListItem[];
}

export async function fetchGame(
  accessToken: string | null,
  gameId: string,
): Promise<GameDetail> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/games/${gameId}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function createGame(
  accessToken: string | null,
  payload: {
    template_id: string;
    title?: string;
    played_at?: string | null;
    players?: { display_name: string; color?: string; sort_order?: number }[];
    round_count?: number;
  },
): Promise<GameDetail> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/games/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function patchGame(
  accessToken: string | null,
  gameId: string,
  payload: Partial<{
    title: string;
    played_at: string | null;
    notes: string;
    round_count: number;
  }>,
): Promise<GameDetail> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/games/${gameId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function upsertScore(
  accessToken: string | null,
  gameId: string,
  payload: {
    category_id: string;
    player_id: string;
    value: number | null;
    round_number?: number;
  },
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/scores/`,
    {
      method: "PUT",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function patchPlayer(
  accessToken: string | null,
  gameId: string,
  playerId: string,
  payload: Partial<{
    display_name: string;
    color: string;
    sort_order: number;
    team: string;
  }>,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/players/${playerId}/`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function addPlayer(
  accessToken: string | null,
  gameId: string,
  payload: { display_name: string; color?: string },
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/players/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function removePlayer(
  accessToken: string | null,
  gameId: string,
  playerId: string,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/players/${playerId}/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function finalizeGame(
  accessToken: string | null,
  gameId: string,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/finalize/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function deleteGame(
  accessToken: string | null,
  gameId: string,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/games/${gameId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function inviteFriendToSeat(
  accessToken: string | null,
  gameId: string,
  playerId: string,
  userId: number,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/players/${playerId}/invite/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({ user_id: userId }),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function cancelSeatInvite(
  accessToken: string | null,
  gameId: string,
  playerId: string,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/players/${playerId}/cancel-invite/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function unclaimSeat(
  accessToken: string | null,
  gameId: string,
  playerId: string,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/players/${playerId}/unclaim/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function fetchPendingSeatInvites(
  accessToken: string | null,
): Promise<ScorenadoSeatInvite[]> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/invites/pending/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as ScorenadoSeatInvite[];
}

export async function acceptSeatInvite(
  accessToken: string | null,
  playerId: string,
): Promise<GameDetail> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/invites/${playerId}/accept/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameDetail;
}

export async function rejectSeatInvite(
  accessToken: string | null,
  playerId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/invites/${playerId}/reject/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({}),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function addGameTag(
  accessToken: string | null,
  gameId: string,
  payload: { label: string; player_id?: string | null },
): Promise<GameTag> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/games/${gameId}/tags/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as GameTag;
}

export async function deleteGameTag(
  accessToken: string | null,
  gameId: string,
  tagId: string,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/scorenado/games/${gameId}/tags/${tagId}/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function fetchScorenadoStats(
  accessToken: string | null,
): Promise<ScorenadoStats> {
  const response = await fetch(`${apiBase()}/api/v1/scorenado/stats/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return (await response.json()) as ScorenadoStats;
}
