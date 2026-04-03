export type UpcomingBirthday = {
  display_name: string;
  birth_month: number;
  birth_day: number;
};

export type StaffPendingSummary = {
  pending_members: number;
  pending_whatif_questions: number;
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
