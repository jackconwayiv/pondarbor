import type { SongadayUserRow } from "../songaday/types";

export const FRIEND_COMMENT_TARGET_SONGADAY = "songaday.songresponse";

export type FriendCommentRow = {
  id: number;
  author: SongadayUserRow;
  body: string;
  edited: boolean;
  created_at: string;
  updated_at: string;
};

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

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) return parsed.detail;
  } catch {
    /* ignore */
  }
  return text || `Request failed (${response.status})`;
}

function targetQuery(responseId: number): string {
  const p = new URLSearchParams();
  p.set("target_type", FRIEND_COMMENT_TARGET_SONGADAY);
  p.set("object_id", String(responseId));
  return p.toString();
}

export async function fetchFriendComments(
  accessToken: string | null,
  responseId: number,
): Promise<FriendCommentRow[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/friend-comments/?${targetQuery(responseId)}`,
    { method: "GET", headers: authHeaders(accessToken), credentials: "omit" },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as FriendCommentRow[];
}

export async function postFriendComment(
  accessToken: string | null,
  responseId: number,
  body: string,
): Promise<FriendCommentRow> {
  const response = await fetch(`${apiBase()}/api/v1/friend-comments/?${targetQuery(responseId)}`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as FriendCommentRow;
}

export async function patchFriendComment(
  accessToken: string | null,
  commentId: number,
  body: string,
): Promise<FriendCommentRow> {
  const response = await fetch(`${apiBase()}/api/v1/friend-comments/${commentId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as FriendCommentRow;
}

export async function deleteFriendComment(
  accessToken: string | null,
  commentId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/friend-comments/${commentId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
