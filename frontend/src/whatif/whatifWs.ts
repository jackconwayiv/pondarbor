/** WebSocket URL for live WhatIf session sync (room code; optional player token). */

export function whatifSessionWsUrl(code: string, playerToken?: string | null): string {
  const path = `/api/v1/whatif/ws/session/${code.toUpperCase()}/`;
  const params = new URLSearchParams();
  if (playerToken?.trim()) {
    params.set("player_token", playerToken.trim());
  }
  const query = params.toString();
  const pathWithQuery = query ? `${path}?${query}` : path;

  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!raw) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${pathWithQuery}`;
  }
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
    const prefix = (u.pathname || "").replace(/\/$/, "");
    return `${wsProto}//${u.host}${prefix}${pathWithQuery}`;
  }
  const prefix = raw.startsWith("/") ? raw : `/${raw}`;
  const base = prefix.replace(/\/$/, "");
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${base}${pathWithQuery}`;
}
