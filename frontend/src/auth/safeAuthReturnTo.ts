/**
 * Auth0 `appState.returnTo` must be a same-origin relative path (no open redirects).
 */
export function safeAuthReturnTo(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  try {
    const u = new URL(path, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}
