export async function fetchAppSession(accessToken: string) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";

  const response = await fetch(`${base}/api/v1/users/sync-profile/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    credentials: "omit",
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Session bootstrap failed: ${response.status}`);
  }

  return response.json();
}
