export type PublicUserSummary = {
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
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

/** Heading line: "{name}'s profile" using display name, or email local-part if unset. */
export function friendProfileHeading(summary: PublicUserSummary): string {
  const raw = (summary.display_name ?? summary.nickname).trim();
  const name = raw.length > 0 ? raw : "User";
  return `${name}'s profile`;
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
