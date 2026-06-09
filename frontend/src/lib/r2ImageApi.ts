function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
  } catch {
    // ignore
  }
  return text || `Request failed (${response.status})`;
}

export type PresignReadResponse = {
  view_url: string;
  expires_in_seconds: number;
};

export async function requestPresignRead(
  accessToken: string | null,
  imageKey: string,
): Promise<PresignReadResponse> {
  if (!accessToken) {
    throw new Error("Missing API access token. Refresh your session and try again.");
  }
  const response = await fetch(`${apiBase()}/api/v1/closet/uploads/presign-read/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify({ key: imageKey }),
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return (await response.json()) as PresignReadResponse;
}

export type R2UploadResult = {
  key: string;
  viewUrl: string;
};
