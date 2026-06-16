import type {
  EntryCreatePayload,
  EntryCreateResponse,
  RecommendationCategory,
  RecommendationEntry,
  RecommendationReview,
  ResolveLinkResult,
  ReviewPatchPayload,
  FriendRecommendationRow,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function drfErrorToMessage(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    const pick = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
      return null;
    };
    return (
      pick(data.body) ??
      pick(data.rating) ??
      pick(data.detail) ??
      pick(data.non_field_errors)
    );
  } catch {
    return null;
  }
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

export async function fetchCategories(
  accessToken: string | null,
): Promise<RecommendationCategory[]> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/categories/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Failed to load categories (${response.status})`);
  return (await response.json()) as RecommendationCategory[];
}

export async function createCategory(
  accessToken: string | null,
  payload: { name: string; emoji?: string; group: "places" | "media" | "links" },
): Promise<RecommendationCategory> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/categories/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to create category (${response.status})`);
  }
  return (await response.json()) as RecommendationCategory;
}

export async function fetchGroupEntries(
  accessToken: string | null,
  group: "places" | "media" | "links",
): Promise<RecommendationEntry[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/recommendations/groups/${encodeURIComponent(group)}/entries/`,
    { headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) throw new Error(`Failed to load entries (${response.status})`);
  return (await response.json()) as RecommendationEntry[];
}

export async function fetchCategoryEntries(
  accessToken: string | null,
  categorySlug: string,
): Promise<RecommendationEntry[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/recommendations/categories/${encodeURIComponent(categorySlug)}/entries/`,
    { headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) throw new Error(`Failed to load entries (${response.status})`);
  return (await response.json()) as RecommendationEntry[];
}

export async function fetchGeoEntries(
  accessToken: string | null,
): Promise<RecommendationEntry[]> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/entries/geo/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Failed to load map entries (${response.status})`);
  return (await response.json()) as RecommendationEntry[];
}

export async function fetchEntry(
  accessToken: string | null,
  entryId: number,
): Promise<RecommendationEntry> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/entries/${entryId}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(`Failed to load entry (${response.status})`);
  return (await response.json()) as RecommendationEntry;
}

export async function createEntryWithReview(
  accessToken: string | null,
  payload: EntryCreatePayload,
): Promise<EntryCreateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/entries/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(drfErrorToMessage(text) ?? `Failed to save (${response.status}): ${text}`);
  }
  return JSON.parse(text) as EntryCreateResponse;
}

export async function createReviewOnEntry(
  accessToken: string | null,
  entryId: number,
  payload: { rating: number; body: string; date_recommended?: string },
): Promise<RecommendationReview> {
  const response = await fetch(
    `${apiBase()}/api/v1/recommendations/entries/${entryId}/reviews/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  const text = await response.text();
  if (!response.ok) {
    throw new Error(drfErrorToMessage(text) ?? `Failed to save review (${response.status})`);
  }
  return JSON.parse(text) as RecommendationReview;
}

export async function patchReview(
  accessToken: string | null,
  reviewId: number,
  payload: ReviewPatchPayload,
): Promise<RecommendationReview> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/reviews/${reviewId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to update review (${response.status})`);
  }
  return (await response.json()) as RecommendationReview;
}

export async function resolveRecommendationLink(
  accessToken: string | null,
  url: string,
): Promise<ResolveLinkResult> {
  const response = await fetch(`${apiBase()}/api/v1/recommendations/resolve-link/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(`Could not resolve link (${response.status})`);
  return (await response.json()) as ResolveLinkResult;
}

export function googleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? "";
}

export async function fetchFriendRecommendationsByOwner(
  accessToken: string | null,
  ownerUserId: number,
): Promise<FriendRecommendationRow[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/recommendations/reviews/friends/${ownerUserId}/`,
    { headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load friend recommendations (${response.status})`);
  }
  return (await response.json()) as FriendRecommendationRow[];
}
