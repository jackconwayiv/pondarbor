import type { NatalChartPayload } from "./chartTypes";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function authHeaders(accessToken: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    h.Authorization = `Bearer ${accessToken}`;
  }
  return h;
}

export type AstroProfileRow = {
  chart_status: string;
  birth_date: string | null;
  birth_time: string | null;
  country_code: string;
  admin_area: string;
  locality: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  iana_timezone: string;
  natal_chart: NatalChartPayload | null;
  sun_sign: string | null;
  moon_sign: string | null;
  rising_sign: string | null;
  waiting_submitted_at: string | null;
  chart_ready_at: string | null;
};

export type AstroProfileResponse = {
  profile: AstroProfileRow | null;
};

/** PUT body: only included keys are applied (omit lat/long/tz to leave DB values unchanged). */
export type AstroBirthPayload = {
  birth_date: string;
  /** ISO-like time or null to clear; omitted keys leave DB unchanged. */
  birth_time?: string | null;
  country_code: string;
  admin_area: string;
  locality: string;
  postal_code: string;
  latitude?: number | null;
  longitude?: number | null;
  iana_timezone?: string;
};

export async function fetchAstroProfile(
  accessToken: string | null,
): Promise<AstroProfileResponse> {
  const response = await fetch(`${apiBase()}/api/v1/zodiac/profile/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (response.status === 403) {
    throw new Error("pending_approval");
  }
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Zodiac profile (${response.status}): ${t}`);
  }
  return (await response.json()) as AstroProfileResponse;
}

export async function putAstroBirth(
  accessToken: string | null,
  payload: AstroBirthPayload,
): Promise<AstroProfileResponse> {
  const response = await fetch(`${apiBase()}/api/v1/zodiac/profile/`, {
    method: "PUT",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Save birth data (${response.status}): ${t}`);
  }
  return (await response.json()) as AstroProfileResponse;
}

export type PendingChartRow = {
  user_id: number;
  email: string;
  display_name: string;
  birth_date: string | null;
  birth_time: string | null;
  locality: string;
  admin_area: string;
  country_code: string;
  postal_code: string;
  waiting_submitted_at: string | null;
};

export type StaffPendingChartsResponse = {
  pending: PendingChartRow[];
};

export async function fetchStaffPendingCharts(
  accessToken: string | null,
): Promise<StaffPendingChartsResponse> {
  const response = await fetch(`${apiBase()}/api/v1/zodiac/staff/pending/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Staff pending charts (${response.status}): ${t}`);
  }
  return (await response.json()) as StaffPendingChartsResponse;
}

export type StaffImportedChartRow = AstroProfileRow & {
  user_id: number;
  email: string;
  display_name: string;
};

export type StaffImportedChartsResponse = {
  imported: StaffImportedChartRow[];
};

export async function fetchStaffImportedCharts(
  accessToken: string | null,
): Promise<StaffImportedChartsResponse> {
  const response = await fetch(`${apiBase()}/api/v1/zodiac/staff/imported/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Staff imported charts (${response.status}): ${t}`);
  }
  return (await response.json()) as StaffImportedChartsResponse;
}

export async function staffImportChart(
  accessToken: string | null,
  userId: number,
  chartText: string,
): Promise<{ profile: AstroProfileRow; warnings: string[] }> {
  const response = await fetch(
    `${apiBase()}/api/v1/zodiac/staff/users/${userId}/chart/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({ chart_text: chartText }),
    },
  );
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Import chart (${response.status}): ${t}`);
  }
  return (await response.json()) as {
    profile: AstroProfileRow;
    warnings: string[];
  };
}

/** Remove an imported chart and return the member to the waiting queue. */
export async function staffClearChart(
  accessToken: string | null,
  userId: number,
): Promise<{ profile: AstroProfileRow }> {
  const response = await fetch(
    `${apiBase()}/api/v1/zodiac/staff/users/${userId}/chart/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Clear chart (${response.status}): ${t}`);
  }
  return (await response.json()) as { profile: AstroProfileRow };
}
