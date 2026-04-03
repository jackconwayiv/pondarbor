import type { AchievementSummary } from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

export async function fetchPublicAchievementsByUser(email: string): Promise<AchievementSummary[]> {
  const encoded = encodeURIComponent(email);
  const response = await fetch(`${apiBase()}/api/v1/users/${encoded}/achievements/`, {
    method: "GET",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievements request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as AchievementSummary[];
}

export async function fetchPublicAchievementsByUserId(userId: number): Promise<AchievementSummary[]> {
  const response = await fetch(`${apiBase()}/api/v1/users/${userId}/achievements/`, {
    method: "GET",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Achievements request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as AchievementSummary[];
}
