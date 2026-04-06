import type {
  BorrowRequest,
  ClosetActionSummary,
  FriendsItemsResponse,
  MyItemsResponse,
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

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown> & { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail;
    }
    const preferredFields = ["date_needed_by", "message", "name"];
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

export async function fetchMyItems(accessToken: string | null): Promise<MyItemsResponse> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
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
  options?: { category?: string; tag?: string; sort?: FriendsItemsSort },
): Promise<FriendsItemsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  const category = (options?.category ?? "").trim();
  if (category) params.set("category", category);
  const tag = (options?.tag ?? "").trim();
  if (tag) params.set("tag", tag);
  if (options?.sort) params.set("sort", options.sort);

  const response = await fetch(`${apiBase()}/api/v1/closet/items/friends/?${params.toString()}`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Failed to load friends' items (${response.status})`);
  }
  return (await response.json()) as FriendsItemsResponse;
}

export async function fetchClosetActionSummary(accessToken: string | null): Promise<ClosetActionSummary> {
  const response = await fetch(`${apiBase()}/api/v1/closet/action-summary/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Failed to load closet action summary (${response.status})`);
  }
  const raw = (await response.json()) as Partial<ClosetActionSummary>;
  return {
    outstanding_actions_count: Number(raw.outstanding_actions_count ?? 0),
  };
}

export async function createItem(
  accessToken: string | null,
  payload: {
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
  },
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function patchItem(
  accessToken: string | null,
  itemId: number,
  payload: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
  },
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
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

export async function fetchBorrowRequests(
  accessToken: string | null,
  itemId: number,
): Promise<BorrowRequest[]> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/borrow-requests/list/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as BorrowRequest[];
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
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/set-custody/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ holder_user_id: holderUserId }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function acceptCustody(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/accept-custody/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function rejectPendingCustody(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/reject-pending-custody/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function cancelPendingCustody(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/cancel-pending-custody/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function denyCustody(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/closet/items/${itemId}/deny-custody/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function markCustodyReturnedByHolder(
  accessToken: string | null,
  itemId: number,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/closet/items/${itemId}/mark-custody-returned-by-holder/`,
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

export async function completeCustodyReturn(accessToken: string | null, itemId: number): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/closet/items/${itemId}/complete-custody-return/`,
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

