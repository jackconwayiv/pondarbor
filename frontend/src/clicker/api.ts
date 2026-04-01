import { KNOWN_UPGRADE_KEYS } from "./upgrades";

export const SCHEMA_VERSION = 2;

export type ClickerGameStateV1 = {
  count: number;
  /** Passively generated / spendable ecosystem resources. */
  fertility: number;
  oxygen: number;
  verdancy: number;
  wildlife: number;
  /** Upgrade id (string) → level (0 = not owned). */
  owned_upgrades: Record<string, number>;
  /** Most-recent purchase first (slider left); ids as in `owned_upgrades` keys. */
  owned_upgrade_order: string[];
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

function numField(raw: Record<string, unknown>, key: string, fallback: number): number {
  const v = raw[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(0, v);
}

/** Fresh default save (new game / reset). */
export function createDefaultClickerState(): ClickerGameStateV1 {
  return {
    count: 0,
    fertility: 0,
    oxygen: 0,
    verdancy: 0,
    wildlife: 0,
    owned_upgrades: {},
    owned_upgrade_order: [],
    revealed_upgrades: {},
  };
}

/** Reconcile saved order with current owned set; append missing owned ids by numeric id. */
export function normalizeOwnedUpgradeOrder(
  raw: unknown,
  owned: Record<string, number>,
): string[] {
  const ownedKeys = new Set(
    Object.entries(owned)
      .filter(([, lv]) => typeof lv === "number" && lv > 0)
      .map(([k]) => k)
      .filter((k) => KNOWN_UPGRADE_KEYS.has(k)),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "string" || !KNOWN_UPGRADE_KEYS.has(item)) continue;
      if (!ownedKeys.has(item) || seen.has(item)) continue;
      out.push(item);
      seen.add(item);
    }
  }
  const missing = [...ownedKeys].filter((k) => !seen.has(k)).sort((a, b) => Number(a) - Number(b));
  out.push(...missing);
  return out;
}

/** Normalizes API JSON; strips unknown upgrade keys for the current upgrade ecosystem set. */
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
  /** Legacy v1 saves had no resource pools; start at 0 so income from owned upgrades fills them. */
  const fertility = numField(o, "fertility", 0);
  const oxygen = numField(o, "oxygen", 0);
  const verdancy = numField(o, "verdancy", 0);
  const wildlife = numField(o, "wildlife", 0);

  const owned_upgrade_order = normalizeOwnedUpgradeOrder(o.owned_upgrade_order, owned_upgrades);

  return {
    count,
    fertility,
    oxygen,
    verdancy,
    wildlife,
    owned_upgrades,
    owned_upgrade_order,
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
