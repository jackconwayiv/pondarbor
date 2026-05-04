import type { AchievementSummary } from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function optionalBearerHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
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
