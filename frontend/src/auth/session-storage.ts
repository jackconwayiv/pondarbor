const SESSION_KEY = "pondarbor.session";

export function loadSessionCache() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSessionCache(data: unknown) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function clearSessionCache() {
  sessionStorage.removeItem(SESSION_KEY);
}