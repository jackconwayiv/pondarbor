import type {
  Quote,
  QuoteCreatePayload,
  QuoteLabel,
  QuotePatchPayload,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

/** Prefer DRF field / detail messages for 400 responses (e.g. unknown attribution email). */
function drfErrorToMessage(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    const pick = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
      return null;
    };
    return pick(data.labels) ?? pick(data.detail) ?? pick(data.non_field_errors);
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

export async function fetchMyQuoteFeed(accessToken: string | null): Promise<Quote[]> {
  const response = await fetch(`${apiBase()}/api/v1/quotes/feed/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Failed to load quote feed (${response.status})`);
  }
  return (await response.json()) as Quote[];
}

export async function createQuote(
  payload: QuoteCreatePayload,
  accessToken: string | null,
): Promise<Quote> {
  const response = await fetch(`${apiBase()}/api/v1/quotes/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    const msg = drfErrorToMessage(text);
    throw new Error(msg ?? `Failed to save quote (${response.status}): ${text}`);
  }
  return (await response.json()) as Quote;
}

export async function patchQuote(
  quoteId: number,
  payload: QuotePatchPayload,
  accessToken: string | null,
): Promise<Quote> {
  const response = await fetch(`${apiBase()}/api/v1/quotes/${quoteId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    const msg = drfErrorToMessage(text);
    throw new Error(msg ?? `Failed to update quote (${response.status}): ${text}`);
  }
  return (await response.json()) as Quote;
}

export async function deleteQuote(
  quoteId: number,
  accessToken: string | null,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/quotes/${quoteId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to delete quote (${response.status}): ${text}`);
  }
}

export async function fetchAllPublicQuotes(): Promise<Quote[]> {
  const response = await fetch(`${apiBase()}/api/v1/quotes/public/`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to load public quotes (${response.status})`);
  }
  return (await response.json()) as Quote[];
}

export async function fetchPublicQuotesByUser(email: string): Promise<Quote[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/users/${encodeURIComponent(email)}/public-quotes/`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load ${email} public quotes (${response.status})`);
  }
  return (await response.json()) as Quote[];
}

export async function fetchQuoteLabels(
  accessToken: string | null,
  kind?: "tag" | "attribution",
): Promise<QuoteLabel[]> {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  const query = params.toString();
  const response = await fetch(
    `${apiBase()}/api/v1/quotes/quote-labels/${query ? `?${query}` : ""}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  // Suggestions are optional UI sugar; if auth is unavailable/expired,
  // keep the app functional and just return no suggestions.
  if (response.status === 401 || response.status === 403) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load label suggestions (${response.status})`);
  }
  return (await response.json()) as QuoteLabel[];
}

