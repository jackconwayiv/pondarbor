export type FriendUser = {
  id: number;
  email: string;
  nickname: string;
  avatar_url: string;
};

export type FriendsListResponse = {
  incoming_pending: FriendUser[];
  outgoing_pending: FriendUser[];
  approved_friends: FriendUser[];
  pending_count: number;
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

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail;
    }
  } catch {
    // Fall back to raw response text below.
  }
  return text || `Request failed: ${response.status}`;
}

export async function fetchFriendsList(accessToken: string | null): Promise<FriendsListResponse> {
  const response = await fetch(`${apiBase()}/api/v1/friends/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Friends list fetch failed: ${response.status}`);
  }
  return (await response.json()) as FriendsListResponse;
}

export async function requestFriendByEmail(
  accessToken: string | null,
  email: string,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/friends/request/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
}

export async function requestFriendByUserId(
  accessToken: string | null,
  userId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/friends/${userId}/request/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
}

async function postFriendAction(accessToken: string | null, userId: number, action: string) {
  const response = await fetch(`${apiBase()}/api/v1/friends/${userId}/${action}/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }
}

export async function acceptFriend(accessToken: string | null, userId: number): Promise<void> {
  await postFriendAction(accessToken, userId, "accept");
}

export async function ignoreFriend(accessToken: string | null, userId: number): Promise<void> {
  await postFriendAction(accessToken, userId, "ignore");
}

export async function unfriend(accessToken: string | null, userId: number): Promise<void> {
  await postFriendAction(accessToken, userId, "unfriend");
}

export async function searchFriends(
  accessToken: string | null,
  query: string,
): Promise<FriendUser[]> {
  const response = await fetch(`${apiBase()}/api/v1/friends/search/?q=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Friend search failed: ${response.status}`);
  }
  return (await response.json()) as FriendUser[];
}

export async function searchApprovedUsers(
  accessToken: string | null,
  query: string,
): Promise<FriendUser[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/friends/approved-users/search/?q=${encodeURIComponent(query)}`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    throw new Error(`Approved user search failed: ${response.status}`);
  }
  return (await response.json()) as FriendUser[];
}

