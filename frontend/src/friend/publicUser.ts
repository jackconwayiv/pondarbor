export type PublicUserSummary = {
  display_name: string;
  email: string;
};

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

/** Heading line: "{name}'s profile" using display name, or email local-part if unset. */
export function friendProfileHeading(summary: PublicUserSummary): string {
  const raw = summary.display_name.trim();
  const name =
    raw.length > 0
      ? raw
      : summary.email.includes("@")
        ? (summary.email.split("@")[0] ?? summary.email)
        : summary.email;
  return `${name}'s profile`;
}

export async function fetchPublicUserSummaryById(userId: number): Promise<PublicUserSummary> {
  const response = await fetch(`${apiBase()}/api/v1/users/${userId}/public/`, {
    method: "GET",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile summary failed (${response.status}): ${text}`);
  }
  return (await response.json()) as PublicUserSummary;
}

export async function fetchPublicUserSummaryByEmail(email: string): Promise<PublicUserSummary> {
  const encoded = encodeURIComponent(email);
  const response = await fetch(`${apiBase()}/api/v1/users/${encoded}/public/`, {
    method: "GET",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Profile summary failed (${response.status}): ${text}`);
  }
  return (await response.json()) as PublicUserSummary;
}
