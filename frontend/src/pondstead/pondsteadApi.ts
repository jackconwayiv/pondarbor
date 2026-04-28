import type { PondsteadDailyReport } from "./PondsteadDailyReportModal";
import type { PondsteadServerWorldSnapshot } from "./pondsteadServerSync";

function apiBase(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
}

const pondBase = () => `${apiBase().replace(/\/$/, "")}/api/v1/pondstead`;

/** Same-origin / CORS-safe pattern as other v1 APIs: JWT + no cookies (DEBUG uses Allow-Origin *). */
function bearerHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

function jsonAuthHeaders(accessToken: string): HeadersInit {
  return { ...bearerHeaders(accessToken), "Content-Type": "application/json" };
}

export type PondsteadLobbyRow = {
  id: number;
  status: string;
  max_players: number;
  current_day: number;
  owner_id: number | null;
  started_at: string | null;
  players: Array<{
    seat_index: number;
    display_name: string;
    user_id: number | null;
    faction_color?: string | null;
  }>;
  invites: Array<{
    id: number;
    invitee_id: number;
    invitee_nickname: string;
    status: string;
  }>;
};

export async function fetchPondsteadCampaignsMine(accessToken: string): Promise<PondsteadLobbyRow[]> {
  const res = await fetch(`${pondBase()}/campaigns/mine/`, {
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`campaigns mine ${res.status}`);
  return (await res.json()) as PondsteadLobbyRow[];
}

export async function createPondsteadCampaign(accessToken: string, maxPlayers = 2): Promise<PondsteadLobbyRow> {
  const res = await fetch(`${pondBase()}/campaigns/`, {
    method: "POST",
    credentials: "omit",
    headers: jsonAuthHeaders(accessToken),
    body: JSON.stringify({ max_players: maxPlayers }),
  });
  if (!res.ok) throw new Error(`create campaign ${res.status}`);
  return (await res.json()) as PondsteadLobbyRow;
}

export async function fetchPondsteadCampaignDetail(accessToken: string, id: number): Promise<PondsteadLobbyRow> {
  const res = await fetch(`${pondBase()}/campaigns/${id}/`, {
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`campaign ${res.status}`);
  return (await res.json()) as PondsteadLobbyRow;
}

export async function inviteUserToCampaign(accessToken: string, campaignId: number, userId: number): Promise<void> {
  const res = await fetch(`${pondBase()}/campaigns/${campaignId}/invites/`, {
    method: "POST",
    credentials: "omit",
    headers: jsonAuthHeaders(accessToken),
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`invite ${res.status}`);
}

export async function acceptCampaignInvite(
  accessToken: string,
  campaignId: number,
  factionColor: string,
): Promise<void> {
  const res = await fetch(`${pondBase()}/campaigns/${campaignId}/invites/accept/`, {
    method: "POST",
    credentials: "omit",
    headers: jsonAuthHeaders(accessToken),
    body: JSON.stringify({ faction_color: factionColor }),
  });
  if (!res.ok) throw new Error(`accept ${res.status}`);
}

export async function declineCampaignInvite(accessToken: string, campaignId: number): Promise<void> {
  const res = await fetch(`${pondBase()}/campaigns/${campaignId}/invites/decline/`, {
    method: "POST",
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`decline ${res.status}`);
}

export async function revokeCampaignAcceptance(accessToken: string, campaignId: number): Promise<void> {
  const res = await fetch(`${pondBase()}/campaigns/${campaignId}/invites/revoke/`, {
    method: "POST",
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`revoke ${res.status}`);
}

export async function startCampaign(accessToken: string, campaignId: number): Promise<void> {
  const res = await fetch(`${pondBase()}/campaigns/${campaignId}/start/`, {
    method: "POST",
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`start ${res.status}`);
}

export type FriendSearchRow = { id: number; email: string; nickname: string; avatar_url: string };

export type GameBootstrapResponse = {
  id: number;
  status: string;
  current_day: number;
  revision: number;
  world: PondsteadServerWorldSnapshot;
  undo_stacks_by_seat: Record<string, unknown[]>;
  players: PondsteadLobbyRow["players"];
  calendar_auto_new_day?: boolean;
  calendar_daily_reports_by_seat?: Record<string, PondsteadDailyReport> | null;
};

export async function fetchPondsteadGameBootstrap(accessToken: string, gameId: number): Promise<GameBootstrapResponse> {
  const res = await fetch(`${pondBase()}/games/${gameId}/`, {
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`game bootstrap ${res.status}`);
  return (await res.json()) as GameBootstrapResponse;
}

export async function searchCampaignInvitees(
  accessToken: string,
  campaignId: number,
  q: string,
): Promise<FriendSearchRow[]> {
  const res = await fetch(`${pondBase()}/campaigns/${campaignId}/invitee-search/?q=${encodeURIComponent(q)}`, {
    credentials: "omit",
    headers: bearerHeaders(accessToken),
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()) as FriendSearchRow[];
}
