import type { SessionUser } from "../auth/AppSessionContext";
import type {
  BooksCommunityResponse,
  BooksLinkResponse,
  BooksShelvesResponse,
  BooksStatusResponse,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
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

function errorMessage(bodyText: string, fallback: string): string {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    const pick = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
      return null;
    };
    return (
      pick(data.detail) ??
      pick(data.profile_url) ??
      pick(data.non_field_errors) ??
      fallback
    );
  } catch {
    return fallback;
  }
}

export async function fetchBooksStatus(
  accessToken: string | null,
): Promise<BooksStatusResponse> {
  const response = await fetch(`${apiBase()}/api/v1/books/status/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(text, "Could not load Books status."));
  }
  return JSON.parse(text) as BooksStatusResponse;
}

export async function fetchBooksShelves(
  accessToken: string | null,
  opts?: { refresh?: boolean },
): Promise<BooksShelvesResponse> {
  const q = opts?.refresh ? "?refresh=1" : "";
  const response = await fetch(`${apiBase()}/api/v1/books/shelves/${q}`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(text, "Could not load Goodreads shelves."));
  }
  return JSON.parse(text) as BooksShelvesResponse;
}

export async function linkGoodreadsProfile(
  accessToken: string | null,
  profileUrl: string,
): Promise<BooksLinkResponse & { session?: SessionUser }> {
  const response = await fetch(`${apiBase()}/api/v1/books/link/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ profile_url: profileUrl }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(text, "Could not link Goodreads profile."));
  }
  return JSON.parse(text) as BooksLinkResponse & { session?: SessionUser };
}

export async function unlinkGoodreadsProfile(
  accessToken: string | null,
): Promise<{ linked: false; session?: SessionUser }> {
  const response = await fetch(`${apiBase()}/api/v1/books/unlink/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(text, "Could not unlink Goodreads profile."));
  }
  return JSON.parse(text) as { linked: false; session?: SessionUser };
}

export async function fetchBooksCommunity(
  accessToken: string | null,
): Promise<BooksCommunityResponse> {
  const response = await fetch(`${apiBase()}/api/v1/books/community/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(text, "Could not load community reading."));
  }
  return JSON.parse(text) as BooksCommunityResponse;
}
