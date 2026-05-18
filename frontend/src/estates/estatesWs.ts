export function estatesGameWsUrl(gameId: string, token: string): string {
  const baseRaw =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? window.location.origin;
  const baseUrl = new URL(baseRaw, window.location.origin);
  const wsProtocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${baseUrl.host}/api/v1/estates/ws/game/${gameId}/?token=${encodeURIComponent(token)}`;
}

export function estatesLobbiesWsUrl(token: string): string {
  const baseRaw =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? window.location.origin;
  const baseUrl = new URL(baseRaw, window.location.origin);
  const wsProtocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  return `${wsProtocol}//${baseUrl.host}/api/v1/estates/ws/lobbies/?token=${encodeURIComponent(token)}`;
}
