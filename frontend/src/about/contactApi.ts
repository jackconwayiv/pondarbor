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

export async function submitContactMessage(
  accessToken: string | null,
  payload: { message: string; website?: string },
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/contact/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({
      message: payload.message,
      website: payload.website ?? "",
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    let detail: string | null = null;
    try {
      const data = JSON.parse(text) as Record<string, unknown>;
      if (typeof data.detail === "string") detail = data.detail;
      if (Array.isArray(data.message) && typeof data.message[0] === "string") {
        detail = data.message[0];
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail ?? `Contact failed (${response.status})`);
  }
}
