export type UpcomingBirthday = {
  display_name: string;
  birth_month: number;
  birth_day: number;
};

export type StaffPendingSummary = {
  pending_members: number;
  pending_whatif_questions: number;
  contact_messages_count: number;
  latest_contact_message_id: number | null;
  pending_zodiac_charts?: number;
};

export type StaffContactMessageRow = {
  id: number;
  message: string;
  created_at: string;
  read_at: string | null;
  read_by: { id: number; email: string } | null;
  from_user: {
    id: number;
    email: string;
    display_name: string;
  };
};

export type StaffUserRow = {
  id: number;
  email: string;
  username: string;
  account_status: string;
  is_staff: boolean;
  display_name: string;
  date_joined: string | null;
};

export const STAFF_ACCOUNT_STATUS_VALUES = [
  "pending",
  "approved",
  "rejected",
  "suspended",
] as const;

export type StaffAccountStatusValue = (typeof STAFF_ACCOUNT_STATUS_VALUES)[number];

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

export async function fetchUpcomingBirthdays(
  accessToken: string,
): Promise<UpcomingBirthday[]> {
  const base = apiBase();
  const response = await fetch(`${base}/api/v1/users/upcoming-birthdays/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });

  if (!response.ok) {
    throw new Error(`Upcoming birthdays fetch failed: ${response.status}`);
  }

  return (await response.json()) as UpcomingBirthday[];
}

export async function fetchStaffPendingSummary(accessToken: string): Promise<StaffPendingSummary> {
  const response = await fetch(`${apiBase()}/api/v1/users/staff/pending-summary/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Staff pending summary failed: ${response.status}`);
  }
  return (await response.json()) as StaffPendingSummary;
}

export async function acknowledgeStaffContactMessages(accessToken: string): Promise<number> {
  const response = await fetch(`${apiBase()}/api/v1/contact/staff/messages/acknowledge/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: "{}",
  });
  if (!response.ok) {
    throw new Error(`Staff contact acknowledge failed: ${response.status}`);
  }
  const body = (await response.json()) as { updated?: unknown };
  return typeof body.updated === "number" ? body.updated : 0;
}

export async function fetchStaffContactMessages(
  accessToken: string,
): Promise<StaffContactMessageRow[]> {
  const response = await fetch(`${apiBase()}/api/v1/contact/staff/messages/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Staff contact messages failed: ${response.status}`);
  }
  return (await response.json()) as StaffContactMessageRow[];
}

export async function deleteStaffContactMessage(
  accessToken: string,
  messageId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/contact/staff/messages/${messageId}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Delete contact message failed: ${response.status}`);
  }
}

export async function fetchStaffUsers(accessToken: string): Promise<StaffUserRow[]> {
  const response = await fetch(`${apiBase()}/api/v1/users/staff/users/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Staff users list failed: ${response.status}`);
  }
  return (await response.json()) as StaffUserRow[];
}

export async function patchStaffUserAccountStatus(
  accessToken: string,
  userId: number,
  accountStatus: StaffAccountStatusValue,
): Promise<StaffUserRow> {
  const response = await fetch(`${apiBase()}/api/v1/users/staff/users/${userId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify({ account_status: accountStatus }),
  });
  if (!response.ok) {
    let detail = `Update failed: ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") {
        detail = body.detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return (await response.json()) as StaffUserRow;
}

/** Inbox summary from POST /api/v1/users/bootstrap/ (snake_case from API). */
export type ApiBootstrapInboxResponse = {
  upcoming_birthdays: UpcomingBirthday[];
  staff_pending_summary: StaffPendingSummary | null;
  pending_friend_count: number;
  closet: { outstanding_actions_count: number };
};

/** Normalized for HomeInboxProvider / React state. */
export type BootstrapInboxSnapshot = {
  upcomingBirthdays: UpcomingBirthday[];
  staffPendingSummary: StaffPendingSummary | null;
  pendingFriendCount: number;
  closetOutstandingActions: number;
};

export function mapApiBootstrapInbox(
  inbox: ApiBootstrapInboxResponse,
): BootstrapInboxSnapshot {
  return {
    upcomingBirthdays: inbox.upcoming_birthdays ?? [],
    staffPendingSummary: inbox.staff_pending_summary ?? null,
    pendingFriendCount: inbox.pending_friend_count ?? 0,
    closetOutstandingActions: inbox.closet?.outstanding_actions_count ?? 0,
  };
}

export async function fetchBootstrapSession(accessToken: string): Promise<{
  session: unknown;
  inbox: ApiBootstrapInboxResponse;
}> {
  const base = apiBase();
  const response = await fetch(`${base}/api/v1/users/bootstrap/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bootstrap failed (${response.status}): ${text}`);
  }
  return (await response.json()) as {
    session: unknown;
    inbox: ApiBootstrapInboxResponse;
  };
}

/**
 * Probe approval status without fetching full session/inbox.
 *
 * Returns:
 * - `true` when backend returns 200
 * - `false` when backend returns 403 (pending/rejected/suspended)
 * - throws on other non-OK statuses
 */
export async function fetchApprovedCheck(
  accessToken: string,
): Promise<boolean> {
  const response = await fetch(`${apiBase()}/api/v1/users/approved-check/`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
  });

  if (response.status === 403) return false;

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`approved-check failed (${response.status}): ${text}`);
  }

  return true;
}
