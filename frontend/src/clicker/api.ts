import {
  KNOWN_UPGRADE_IDS,
  clampOwnedStacksForUpgrade,
  getUpgradeDef,
} from "./catalog";

export const SCHEMA_VERSION = 7;

export const CATALOG_CONTENT_VERSION = 19;

export type ClickerGameStateV1 = {
  energy: number;
  /** Upgrade id (string) -> number owned (stacks). */
  owned_upgrades: Record<string, number>;
  /** Most-recent purchase first. */
  owned_upgrade_order: string[];
  /** Sticky reveal flags by upgrade id. */
  revealed_upgrades: Record<string, boolean>;
  /** Mechanic unlock flags for future systems. */
  unlocked_mechanics: string[];
  /** Bumped when catalog content changes meaningfully (migration hook). */
  catalog_version: number;
  /** Timed buffs (stub). */
  active_buffs: Array<{ id: string; expires_at_ms: number }>;
  /** Lifetime stats (stub). */
  statistics: {
    total_clicks: number;
    total_energy_earned: number;
  };
};

export type ClickerStateResponse = {
  state: ClickerGameStateV1 | null;
  schema_version: number;
  created_at: string | null;
  updated_at: string | null;
  last_played_at: string | null;
  server_time: string;
  /** Present on POST /clicker/state/ when the server granted new pondclicker tier badges. */
  pondclicker_badges_unlocked?: boolean;
};

function numField(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = raw[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(0, v);
}

/** Fresh default save (new game / reset). */
export function createDefaultClickerState(): ClickerGameStateV1 {
  return {
    energy: 0,
    owned_upgrades: {},
    owned_upgrade_order: [],
    revealed_upgrades: {},
    unlocked_mechanics: [],
    catalog_version: CATALOG_CONTENT_VERSION,
    active_buffs: [],
    statistics: { total_clicks: 0, total_energy_earned: 0 },
  };
}

/** Reconcile saved order with current owned set; append missing owned ids sorted lexicographically. */
export function normalizeOwnedUpgradeOrder(
  raw: unknown,
  owned: Record<string, number>,
): string[] {
  const ownedKeys = new Set(
    Object.entries(owned)
      .filter(([, lv]) => typeof lv === "number" && lv > 0)
      .map(([k]) => k)
      .filter((k) => KNOWN_UPGRADE_IDS.has(k)),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "string" || !KNOWN_UPGRADE_IDS.has(item)) continue;
      if (!ownedKeys.has(item) || seen.has(item)) continue;
      out.push(item);
      seen.add(item);
    }
  }
  const missing = [...ownedKeys]
    .filter((k) => !seen.has(k))
    .sort((a, b) => a.localeCompare(b));
  out.push(...missing);
  return out;
}

/** Normalizes API JSON; strips unknown upgrade keys for the current upgrade ecosystem set. */
export function normalizeClickerState(raw: unknown): ClickerGameStateV1 {
  if (!raw || typeof raw !== "object") {
    return createDefaultClickerState();
  }
  const o = raw as Record<string, unknown>;
  const energy = numField(o, "energy", 0);
  const owned_upgrades: Record<string, number> = {};
  if (
    o.owned_upgrades &&
    typeof o.owned_upgrades === "object" &&
    o.owned_upgrades !== null
  ) {
    const ou = o.owned_upgrades as Record<string, unknown>;
    for (const [k, v] of Object.entries(ou)) {
      if (!KNOWN_UPGRADE_IDS.has(k)) continue;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        const def = getUpgradeDef(k);
        const n = Math.floor(v);
        if (n <= 0) continue;
        owned_upgrades[k] = def ? clampOwnedStacksForUpgrade(k, n) : n;
      }
    }
  }
  const revealed_upgrades: Record<string, boolean> = {};
  if (
    o.revealed_upgrades &&
    typeof o.revealed_upgrades === "object" &&
    o.revealed_upgrades !== null
  ) {
    const rv = o.revealed_upgrades as Record<string, unknown>;
    for (const [k, v] of Object.entries(rv)) {
      if (!KNOWN_UPGRADE_IDS.has(k)) continue;
      if (v === true) {
        revealed_upgrades[k] = true;
      }
    }
  }

  const owned_upgrade_order = normalizeOwnedUpgradeOrder(
    o.owned_upgrade_order,
    owned_upgrades,
  );
  const unlocked_mechanics = Array.isArray(o.unlocked_mechanics)
    ? o.unlocked_mechanics.filter((x): x is string => typeof x === "string")
    : [];

  const catalog_version =
    typeof o.catalog_version === "number" && Number.isFinite(o.catalog_version)
      ? Math.max(0, Math.floor(o.catalog_version))
      : CATALOG_CONTENT_VERSION;

  const active_buffs: Array<{ id: string; expires_at_ms: number }> = [];
  if (Array.isArray(o.active_buffs)) {
    for (const item of o.active_buffs) {
      if (!item || typeof item !== "object") continue;
      const b = item as Record<string, unknown>;
      const id = b.id;
      const expires_at_ms = b.expires_at_ms;
      if (
        typeof id === "string" &&
        typeof expires_at_ms === "number" &&
        Number.isFinite(expires_at_ms)
      ) {
        active_buffs.push({ id, expires_at_ms });
      }
    }
  }

  let statistics = { total_clicks: 0, total_energy_earned: 0 };
  if (
    o.statistics &&
    typeof o.statistics === "object" &&
    o.statistics !== null
  ) {
    const s = o.statistics as Record<string, unknown>;
    statistics = {
      total_clicks: numField(s, "total_clicks", 0),
      total_energy_earned: numField(s, "total_energy_earned", 0),
    };
  }

  return {
    energy,
    owned_upgrades,
    owned_upgrade_order,
    revealed_upgrades,
    unlocked_mechanics,
    catalog_version,
    active_buffs,
    statistics,
  };
}

/**
 * Loads server JSON into `ClickerGameStateV1`. Older `schema_version` rows are still
 * normalized field-by-field (unknown upgrade keys stripped, stacks clamped); we do not
 * wipe progress solely because the stored schema integer differs from `SCHEMA_VERSION`.
 * Next POST will persist the current schema version.
 */
export function normalizeClickerStateForSchema(
  raw: unknown,
  schemaVersion: number | undefined,
): ClickerGameStateV1 {
  void schemaVersion;
  const normalized = normalizeClickerState(raw);
  if (!Number.isFinite(normalized.energy)) {
    normalized.energy = 0;
  }
  return normalized;
}

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function authHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) {
    throw new Error(
      "Missing API access token. Refresh your session and try again.",
    );
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

/** Pull a short message from DRF-style JSON errors (`detail`, etc.). */
function formatClickerApiError(
  status: number,
  bodyText: string,
  verb: "load" | "save",
): string {
  const trimmed = bodyText.trim();
  let detail: string | undefined;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const d = parsed.detail;
      if (typeof d === "string") detail = d;
      else if (Array.isArray(d) && d.every((x) => typeof x === "string"))
        detail = d.join(" ");
    } catch {
      // keep raw body below
    }
  }
  if (detail) {
    return `Failed to ${verb} clicker state (${status}): ${detail}`;
  }
  if (trimmed) {
    return `Failed to ${verb} clicker state (${status}): ${trimmed}`;
  }
  return `Failed to ${verb} clicker state (${status})`;
}

export async function fetchClickerState(
  accessToken: string | null,
): Promise<ClickerStateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/clicker/state/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatClickerApiError(response.status, text, "load"));
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
    throw new Error(formatClickerApiError(response.status, text, "save"));
  }
  return (await response.json()) as ClickerStateResponse;
}
