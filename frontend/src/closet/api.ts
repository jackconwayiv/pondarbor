import type {
  ClosetActionSummary,
  ClosetBootstrapResponse,
  ClosetImageInventoryResponse,
  ClosetItem,
  FriendsItemsResponse,
  MyItemsResponse,
} from "./types";

type ClosetApiMetric = {
  path: string;
  method: string;
  status: number;
  duration_ms: number;
  response_bytes: number;
};

declare global {
  interface Window {
    __closetApiMetrics?: ClosetApiMetric[];
  }
}

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
    const parsed = JSON.parse(text) as Record<string, unknown> & { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail;
    }
    const preferredFields = ["date_needed_by", "message", "name", "image_key"];
    for (const field of preferredFields) {
      const value = parsed[field];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return value[0];
      }
    }
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return value[0];
      }
    }
  } catch {
    // Fall through to raw response text.
  }
  return text || `Request failed (${response.status})`;
}

async function closetFetch(
  accessToken: string | null,
  path: string,
  init: RequestInit,
): Promise<Response> {
  const started = performance.now();
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      ...authHeaders(accessToken),
      ...(init.headers ?? {}),
    },
    credentials: "omit",
  });
  const durationMs = performance.now() - started;
  const contentLengthHeader = response.headers.get("content-length");
  const responseBytes = Number.parseInt(contentLengthHeader ?? "", 10);
  if (typeof window !== "undefined") {
    const bucket = window.__closetApiMetrics ?? [];
    bucket.push({
      path,
      method: (init.method ?? "GET").toUpperCase(),
      status: response.status,
      duration_ms: Math.round(durationMs),
      response_bytes: Number.isFinite(responseBytes) ? responseBytes : 0,
    });
    if (bucket.length > 500) {
      bucket.splice(0, bucket.length - 500);
    }
    window.__closetApiMetrics = bucket;
  }
  return response;
}

export async function fetchMyItems(accessToken: string | null): Promise<MyItemsResponse> {
  const response = await closetFetch(accessToken, "/api/v1/closet/items/", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to load your items (${response.status})`);
  }
  const raw = (await response.json()) as Partial<MyItemsResponse>;
  return {
    declined_by_me: raw.declined_by_me ?? [],
    borrowed_by_me: raw.borrowed_by_me ?? [],
    custody_offered_to_me: raw.custody_offered_to_me ?? [],
    requested_by_me: raw.requested_by_me ?? [],
    owned_by_me: raw.owned_by_me ?? [],
  };
}

export type FriendsItemsSort =
  | "updated_desc"
  | "updated_asc"
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc";

export async function fetchFriendsItems(
  accessToken: string | null,
  page: number,
  pageSize: number,
  options?: {
    category?: string;
    tag?: string;
    q?: string;
    sort?: FriendsItemsSort;
    includeSelf?: boolean;
  },
): Promise<FriendsItemsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const category = (options?.category ?? "").trim();
  if (category) params.set("category", category);
  const tag = (options?.tag ?? "").trim();
  if (tag) params.set("tag", tag);
  const q = (options?.q ?? "").trim();
  if (q) params.set("q", q);
  if (options?.sort) params.set("sort", options.sort);
  if (options?.includeSelf) params.set("include_self", "true");

  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/items/friends/?${params.toString()}`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load friends' items (${response.status})`);
  }
  return (await response.json()) as FriendsItemsResponse;
}

export async function fetchFriendItemsByOwner(
  accessToken: string | null,
  ownerUserId: number,
): Promise<FriendsItemsResponse["results"]> {
  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/items/friends/${ownerUserId}/`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load friend closet items (${response.status})`);
  }
  return (await response.json()) as FriendsItemsResponse["results"];
}

export async function fetchItem(
  accessToken: string | null,
  itemId: number,
): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/`, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to load item (${response.status})`);
  }
  return (await response.json()) as ClosetItem;
}

export async function fetchClosetActionSummary(accessToken: string | null): Promise<ClosetActionSummary> {
  const response = await closetFetch(accessToken, "/api/v1/closet/action-summary/", {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to load closet action summary (${response.status})`);
  }
  const raw = (await response.json()) as Partial<ClosetActionSummary>;
  return {
    outstanding_actions_count: Number(raw.outstanding_actions_count ?? 0),
  };
}

export async function fetchClosetBootstrap(
  accessToken: string | null,
  options: {
    page: number;
    pageSize: number;
    category?: string;
    tag?: string;
    q?: string;
    sort?: FriendsItemsSort;
    includeSelf?: boolean;
  },
): Promise<ClosetBootstrapResponse> {
  const params = new URLSearchParams({
    page: String(options.page),
    page_size: String(options.pageSize),
  });
  const category = (options.category ?? "").trim();
  if (category) params.set("category", category);
  const tag = (options.tag ?? "").trim();
  if (tag) params.set("tag", tag);
  const q = (options.q ?? "").trim();
  if (q) params.set("q", q);
  if (options.sort) params.set("sort", options.sort);
  if (options.includeSelf) params.set("include_self", "true");
  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/bootstrap/?${params.toString()}`,
    { method: "GET" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load closet bootstrap (${response.status})`);
  }
  return (await response.json()) as ClosetBootstrapResponse;
}

export async function createItem(
  accessToken: string | null,
  payload: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
    image_key?: string;
  },
): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, "/api/v1/closet/items/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function patchItem(
  accessToken: string | null,
  itemId: number,
  payload: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    image_key?: string;
  },
): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export type ClosetImagePresignResponse = {
  key: string;
  upload_url: string;
  view_url: string;
  expires_in_seconds: number;
  view_expires_in_seconds?: number;
  max_bytes: number;
  allowed_mime_types: string[];
};

export async function requestClosetImagePresign(
  accessToken: string | null,
  contentType: "image/jpeg" | "image/png" | "image/webp",
): Promise<ClosetImagePresignResponse> {
  const response = await fetch(`${apiBase()}/api/v1/closet/uploads/presign/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ content_type: contentType }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetImagePresignResponse;
}

export async function deleteItem(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function hideClosetItem(
  accessToken: string | null,
  itemId: number,
): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/hide/`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function unhideClosetItem(
  accessToken: string | null,
  itemId: number,
): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/unhide/`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function fetchMyImageInventory(
  accessToken: string | null,
): Promise<ClosetImageInventoryResponse> {
  const response = await fetch(`${apiBase()}/api/v1/closet/images/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetImageInventoryResponse;
}

export async function deleteMyImage(accessToken: string | null, imageKey: string): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/images/delete/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ image_key: imageKey }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function createBorrowRequest(
  accessToken: string | null,
  itemId: number,
  payload: { date_needed_by: string; message?: string },
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/borrow-requests/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function approveBorrowRequest(
  accessToken: string | null,
  requestId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/borrow-requests/${requestId}/approve/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function declineBorrowRequest(
  accessToken: string | null,
  requestId: number,
  payload?: { decline_message?: string },
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/borrow-requests/${requestId}/decline/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload ?? {}),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function cancelBorrowRequest(
  accessToken: string | null,
  requestId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/borrow-requests/${requestId}/cancel/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function deleteBorrowRequest(
  accessToken: string | null,
  requestId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/borrow-requests/${requestId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function setCustody(
  accessToken: string | null,
  itemId: number,
  holderUserId: number,
): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/set-custody/`, {
    method: "POST",
    body: JSON.stringify({ holder_user_id: holderUserId }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function acceptCustody(accessToken: string | null, itemId: number): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/accept-custody/`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function rejectPendingCustody(accessToken: string | null, itemId: number): Promise<ClosetItem> {
  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/items/${itemId}/reject-pending-custody/`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function cancelPendingCustody(accessToken: string | null, itemId: number): Promise<ClosetItem> {
  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/items/${itemId}/cancel-pending-custody/`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function denyCustody(accessToken: string | null, itemId: number): Promise<ClosetItem> {
  const response = await closetFetch(accessToken, `/api/v1/closet/items/${itemId}/deny-custody/`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function markCustodyReturnedByHolder(
  accessToken: string | null,
  itemId: number,
): Promise<ClosetItem> {
  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/items/${itemId}/mark-custody-returned-by-holder/`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function completeCustodyReturn(accessToken: string | null, itemId: number): Promise<ClosetItem> {
  const response = await closetFetch(
    accessToken,
    `/api/v1/closet/items/${itemId}/complete-custody-return/`,
    {
      method: "POST",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as ClosetItem;
}

export async function markReturnedByBorrower(
  accessToken: string | null,
  loanId: number,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/closet/loans/${loanId}/mark-returned-by-borrower/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function markReturnedByOwner(accessToken: string | null, loanId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/loans/${loanId}/mark-returned/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

