import type {
  PeopleGraphBundle,
  PeoplePerson,
  PeoplePersonCreatePayload,
  PeoplePersonPatchPayload,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function formatApiDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((x) => formatApiDetail(x)).filter(Boolean).join("; ");
  }
  if (detail && typeof detail === "object") {
    return Object.entries(detail as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${formatApiDetail(value)}`)
      .join("; ");
  }
  return detail != null ? String(detail) : "";
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const t = await response.text();
    const data = JSON.parse(t) as Record<string, unknown>;
    if (data.detail != null) {
      const msg = formatApiDetail(data.detail);
      if (msg) return msg;
    }
    return t.slice(0, 400);
  } catch {
    return response.statusText || "Request failed";
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

export async function fetchPeopleGraph(accessToken: string | null): Promise<PeopleGraphBundle> {
  const response = await fetch(`${apiBase()}/api/v1/people/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as PeopleGraphBundle;
}

export async function fetchPeopleSummary(accessToken: string | null): Promise<{ count: number }> {
  const response = await fetch(`${apiBase()}/api/v1/people/summary/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as { count: number };
}

export async function fetchPeopleGraphForUser(
  accessToken: string | null,
  ownerUserId: number,
): Promise<PeopleGraphBundle> {
  const response = await fetch(`${apiBase()}/api/v1/people/users/${ownerUserId}/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as PeopleGraphBundle;
}

export async function createPerson(
  accessToken: string | null,
  payload: PeoplePersonCreatePayload,
): Promise<PeoplePerson> {
  const response = await fetch(`${apiBase()}/api/v1/people/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as PeoplePerson;
}

export async function patchPerson(
  accessToken: string | null,
  personId: string,
  payload: PeoplePersonPatchPayload,
): Promise<unknown> {
  const response = await fetch(`${apiBase()}/api/v1/people/${personId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function deletePerson(accessToken: string | null, personId: string): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/people/${personId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function createPartnership(
  accessToken: string | null,
  payload: {
    person_one_id: string;
    person_two_id: string;
    status?: "current" | "former";
    anniversary_date?: string | null;
  },
): Promise<unknown> {
  const response = await fetch(`${apiBase()}/api/v1/people/partnerships/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function patchPartnership(
  accessToken: string | null,
  partnershipId: string,
  payload: { status?: "current" | "former"; anniversary_date?: string | null },
): Promise<unknown> {
  const response = await fetch(`${apiBase()}/api/v1/people/partnerships/${partnershipId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function deletePartnership(
  accessToken: string | null,
  partnershipId: string,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/people/partnerships/${partnershipId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}

export async function createGuardianLink(
  accessToken: string | null,
  childId: string,
  payload: { guardian_id: string; note?: string },
): Promise<unknown> {
  const response = await fetch(`${apiBase()}/api/v1/people/${childId}/guardians/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

export async function deleteGuardianLink(
  accessToken: string | null,
  childId: string,
  linkId: string,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/people/${childId}/guardians/${linkId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
}
