export async function fetchAppSession(
  accessToken: string,
  auth0User: unknown
) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";

  const response = await fetch(`${base}/users/sync-profile/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(auth0User),
  });

  if (!response.ok) {
    throw new Error(`Session bootstrap failed: ${response.status}`);
  }

  return response.json();
}