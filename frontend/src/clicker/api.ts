import { KNOWN_UPGRADE_KEYS } from "./upgrades";

const SCHEMA_VERSION = 5;

export type ClickerGameStateV1 = {
  count: number;
  /** Upgrade id (string) → level (0 = not owned). */
  owned_upgrades: Record<string, number>;
  /** Once true, shop keeps showing that upgrade after reveal even if energy drops. */
  revealed_upgrades: Record<string, boolean>;
};

export type ClickerStateResponse = {
  state: ClickerGameStateV1 | null;
  schema_version: number;
  created_at: string | null;
  updated_at: string | null;
  last_played_at: string | null;
  server_time: string;
};

/** Fresh default save (new game / reset). */
export function createDefaultClickerState(): ClickerGameStateV1 {
  return { count: 0, owned_upgrades: {}, revealed_upgrades: {} };
}

/** Normalizes API JSON; strips unknown upgrade keys (legacy lily_* ids). Keeps fractional energy. */
export function normalizeClickerState(raw: unknown): ClickerGameStateV1 {
  if (!raw || typeof raw !== "object") {
    return createDefaultClickerState();
  }
  const o = raw as Record<string, unknown>;
  const count =
    typeof o.count === "number" && Number.isFinite(o.count) ? Math.max(0, o.count) : 0;
  const owned_upgrades: Record<string, number> = {};
  if (o.owned_upgrades && typeof o.owned_upgrades === "object" && o.owned_upgrades !== null) {
    const ou = o.owned_upgrades as Record<string, unknown>;
    for (const [k, v] of Object.entries(ou)) {
      if (!KNOWN_UPGRADE_KEYS.has(k)) continue;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        owned_upgrades[k] = Math.floor(v);
      }
    }
  }
  const revealed_upgrades: Record<string, boolean> = {};
  if (o.revealed_upgrades && typeof o.revealed_upgrades === "object" && o.revealed_upgrades !== null) {
    const rv = o.revealed_upgrades as Record<string, unknown>;
    for (const [k, v] of Object.entries(rv)) {
      if (!KNOWN_UPGRADE_KEYS.has(k)) continue;
      if (v === true) {
        revealed_upgrades[k] = true;
      }
    }
  }
  return {
    count,
    owned_upgrades,
    revealed_upgrades,
  };
}

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

export async function fetchClickerState(accessToken: string | null): Promise<ClickerStateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/clicker/state/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Failed to load clicker state (${response.status})`);
  }
  return (await response.json()) as ClickerStateResponse;
}

export async function saveClickerState(
  accessToken: string | null,
  state: ClickerGameStateV1,
): Promise<ClickerStateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/clicker/state/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ state, schema_version: SCHEMA_VERSION }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to save clicker state (${response.status}): ${text}`);
  }
  return (await response.json()) as ClickerStateResponse;
}

export { SCHEMA_VERSION };
