export type PublicUserSummary = {
  id?: number;
  nickname: string;
  avatar_url: string;
  is_friend: boolean;
  can_view_full_profile: boolean;
  friendship_status?:
    | "self"
    | "friends"
    | "incoming_pending"
    | "outgoing_pending"
    | "none";
  display_name?: string;
  email?: string;
  /** Listed closet items visible to friends (only present when viewer is a friend, not self). */
  closet_items_count?: number;
  /** Active family tree members including self (when viewer may see full profile). */
  people_count?: number;
  /** ISO date; only when viewer may see full profile and friend set a birthday. */
  birth_date?: string;
  sun_sign?: string;
  moon_sign?: string;
  rising_sign?: string;
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

/** Display name for headings (display_name, else nickname). */
export function friendDisplayName(summary: PublicUserSummary): string {
  const raw = (summary.display_name ?? summary.nickname).trim();
  return raw.length > 0 ? raw : "User";
}

/** Heading line: "{name}'s profile" using display name, or email local-part if unset. */
export function friendProfileHeading(summary: PublicUserSummary): string {
  return `${friendDisplayName(summary)}'s profile`;
}

function optionalBearerHeaders(accessToken?: string | null): HeadersInit {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchPublicUserSummaryById(
  userId: number,
  accessToken?: string | null,
): Promise<PublicUserSummary> {
  const response = await fetch(`${apiBase()}/api/v1/users/${userId}/public/`, {
    method: "GET",
    headers: optionalBearerHeaders(accessToken),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile summary failed (${response.status}): ${text}`);
  }
  return (await response.json()) as PublicUserSummary;
}

export async function fetchPublicUserSummaryByEmail(
  email: string,
  accessToken?: string | null,
): Promise<PublicUserSummary> {
  const encoded = encodeURIComponent(email);
  const response = await fetch(`${apiBase()}/api/v1/users/${encoded}/public/`, {
    method: "GET",
    headers: optionalBearerHeaders(accessToken),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile summary failed (${response.status}): ${text}`);
  }
  return (await response.json()) as PublicUserSummary;
}
