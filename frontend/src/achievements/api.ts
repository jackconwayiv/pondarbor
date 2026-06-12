import type {
  AchievementPeerAvatarRow,
  AchievementSummary,
  HallOfFamePayload,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function optionalBearerHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}

function bearerJsonHeaders(accessToken: string | null): HeadersInit {
  if (!accessToken) {
    throw new Error("Missing API access token. Refresh your session and try again.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

export async function fetchPublicAchievementsByUser(
  email: string,
  accessToken?: string | null,
): Promise<AchievementSummary[]> {
  const encoded = encodeURIComponent(email);
  const response = await fetch(`${apiBase()}/api/v1/users/${encoded}/achievements/`, {
    method: "GET",
    headers: optionalBearerHeaders(accessToken),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievements request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as AchievementSummary[];
}

export async function fetchPublicAchievementsByUserId(
  userId: number,
  accessToken?: string | null,
): Promise<AchievementSummary[]> {
  const response = await fetch(`${apiBase()}/api/v1/users/${userId}/achievements/`, {
    method: "GET",
    headers: optionalBearerHeaders(accessToken),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievements request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as AchievementSummary[];
}

type AchievementPeersResponseBody = {
  peers_by_slug: Record<string, AchievementPeerAvatarRow[]>;
};

/** Batch: approved friends of the viewer who show each slug on their public achievement list. */
export async function postAchievementPeersForMyFriends(
  slugs: string[],
  accessToken: string | null,
): Promise<Record<string, AchievementPeerAvatarRow[]>> {
  const response = await fetch(`${apiBase()}/api/v1/users/me/achievement-peers/`, {
    method: "POST",
    headers: bearerJsonHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ slugs }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievement peers request failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as AchievementPeersResponseBody;
  return data.peers_by_slug ?? {};
}

/** Batch: friends of `subjectUserId` (viewer must be friends with subject) visible to viewer per slug. */
export async function postAchievementPeersForSubjectFriends(
  subjectUserId: number,
  slugs: string[],
  accessToken: string | null,
): Promise<Record<string, AchievementPeerAvatarRow[]>> {
  const response = await fetch(
    `${apiBase()}/api/v1/users/${subjectUserId}/achievement-peers/`,
    {
      method: "POST",
      headers: bearerJsonHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({ slugs }),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievement peers request failed (${response.status}): ${text}`);
  }
  const data = (await response.json()) as AchievementPeersResponseBody;
  return data.peers_by_slug ?? {};
}

/** Viewer-scoped Hall of Fame: earned badges across people you can see. */
export async function fetchAchievementTrophyCase(
  accessToken: string | null,
): Promise<HallOfFamePayload> {
  const response = await fetch(`${apiBase()}/api/v1/users/me/achievement-trophy-case/`, {
    method: "GET",
    headers: bearerJsonHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievement trophy case request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as HallOfFamePayload;
}

/** Staff-only: all active achievement definitions as friend-profile-shaped rows (no real unlock date). */
export async function fetchStaffAchievementDefinitions(
  accessToken: string | null,
): Promise<AchievementSummary[]> {
  const response = await fetch(`${apiBase()}/api/v1/achievements/definitions/`, {
    method: "GET",
    headers: optionalBearerHeaders(accessToken),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievement definitions request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as AchievementSummary[];
}
