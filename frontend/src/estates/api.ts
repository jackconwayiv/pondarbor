export type EstatesPlayerIdentity = {
  user_id: number;
  seat_index: number;
  display_name: string;
  avatar_url: string;
};

export type EstatesPlayerState = EstatesPlayerIdentity & {
  deck: Array<Record<string, unknown>>;
  hand: Array<Record<string, unknown>>;
  discard: Array<Record<string, unknown>>;
  hand_count: number;
  deck_count: number;
  discard_count: number;
  draw_bonus: number;
  is_starting_player: boolean;
  score: number;
};

export type EstatesComputerDifficulty = "easy" | "normal" | "hard";

export type EstatesRoundState = {
  round_number: number;
  phase: string;
  turn_player_seat: number | null;
  actions_taken_by_seat: Record<string, number>;
  placements_by_zone: Record<string, Record<string, Record<string, unknown> | null>>;
  pending_actor_seat: number | null;
  pending_action: string;
  pending_payload: Record<string, unknown>;
  status_message: string;
  phase_started_at: string;
  connections_seat_1: number;
  connections_seat_2: number;
  is_paused: boolean;
  disconnected_seat: number | null;
  pending_computer_action_at?: string | null;
};

export type EstatesCompletionOutcome = "victory_score" | "concession";

export type EstatesMyGameRow = {
  id: string;
  status: "lobby" | "active" | "completed";
  created_at: string;
  updated_at: string;
  is_owner: boolean;
  is_solo: boolean;
  computer_difficulty: EstatesComputerDifficulty | null;
  player_names: string[];
  winner_display_name: string | null;
  round: number;
  my_score: number | null;
  opponent_score: number | null;
};

export type EstatesMyGamesResponse = {
  open_lobby: EstatesMyGameRow[];
  in_progress: EstatesMyGameRow[];
  completed: EstatesMyGameRow[];
};

export type EstatesGameState = {
  id: string;
  status: "lobby" | "active" | "completed";
  round: number;
  is_solo: boolean;
  computer_difficulty: EstatesComputerDifficulty | null;
  computer_persona: string | null;
  victory_score: number;
  player_1_id: number;
  player_2_id: number | null;
  player_1: EstatesPlayerIdentity;
  player_2: EstatesPlayerIdentity | null;
  players: EstatesPlayerState[];
  round_state: EstatesRoundState | null;
  winner_user_id: number | null;
  completion_outcome: EstatesCompletionOutcome | null;
  conceded_by_user_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
}

const estatesBase = () => `${apiBase().replace(/\/$/, "")}/api/v1/estates`;

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((x) => formatApiDetail(x)).filter(Boolean).join("; ");
  }
  if (detail && typeof detail === "object") {
    return Object.entries(detail as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${formatApiDetail(value)}`)
      .join("; ");
  }
  return detail != null ? String(detail) : "";
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    const json = JSON.parse(text) as { detail?: unknown };
    if (json.detail != null) {
      const msg = formatApiDetail(json.detail);
      if (msg) return msg;
    }
    return text.slice(0, 400);
  } catch {
    return response.statusText || "Request failed";
  }
}

export async function listOpenEstatesLobbies(accessToken: string): Promise<EstatesGameState[]> {
  const response = await fetch(`${estatesBase()}/lobbies/`, {
    method: "GET",
    credentials: "omit",
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState[];
}

export async function fetchMyEstatesGame(accessToken: string): Promise<EstatesGameState | null> {
  const response = await fetch(`${estatesBase()}/games/mine/`, {
    method: "GET",
    credentials: "omit",
    headers: authHeaders(accessToken),
  });
  if (response.status === 204) {
    return null;
  }
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function fetchMyEstatesGamesList(
  accessToken: string,
): Promise<EstatesMyGamesResponse> {
  const response = await fetch(`${estatesBase()}/games/mine/list/`, {
    method: "GET",
    credentials: "omit",
    headers: authHeaders(accessToken),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesMyGamesResponse;
}

export async function createSoloEstatesGame(
  accessToken: string,
  difficulty: EstatesComputerDifficulty,
): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/lobbies/solo/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ difficulty }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function createEstatesLobby(
  accessToken: string,
  victoryScore?: number,
): Promise<EstatesGameState> {
  const payload = typeof victoryScore === "number" ? { victory_score: victoryScore } : {};
  const response = await fetch(`${estatesBase()}/lobbies/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function joinEstatesLobby(accessToken: string, gameId: string): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/lobbies/${gameId}/join/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function confirmEstatesLobby(accessToken: string, gameId: string): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/lobbies/${gameId}/confirm/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function leaveEstatesLobby(accessToken: string, gameId: string): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/lobbies/${gameId}/leave/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function updateEstatesLobbyVictoryScore(
  accessToken: string,
  gameId: string,
  victoryScore: number,
): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/lobbies/${gameId}/`, {
    method: "PATCH",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ victory_score: victoryScore }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function cancelEstatesLobby(accessToken: string, gameId: string): Promise<void> {
  const response = await fetch(`${estatesBase()}/lobbies/${gameId}/`, {
    method: "DELETE",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function placeEstatesCard(
  accessToken: string,
  gameId: string,
  payload: { card_id: string; zone: string },
): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/games/${gameId}/actions/place-card/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function clearEstatesStagedCard(accessToken: string, gameId: string): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/games/${gameId}/actions/clear-staged-card/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function confirmEstatesCard(accessToken: string, gameId: string): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/games/${gameId}/actions/confirm-card/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function reorderEstatesHand(
  accessToken: string,
  gameId: string,
  cardIds: string[],
): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/games/${gameId}/actions/reorder-hand/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ card_ids: cardIds }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export async function concedeEstatesGame(accessToken: string, gameId: string): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/games/${gameId}/actions/concede/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

export type ChooseEstatesEffectTargetPayload = {
  target_zone?: string;
  target_card_id?: string;
};

export async function chooseEstatesEffectTarget(
  accessToken: string,
  gameId: string,
  payload: ChooseEstatesEffectTargetPayload,
): Promise<EstatesGameState> {
  const response = await fetch(`${estatesBase()}/games/${gameId}/actions/choose-effect-target/`, {
    method: "POST",
    credentials: "omit",
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as EstatesGameState;
}

