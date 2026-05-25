import {
  normalizeDenizenMutationLevels,
  totalMutagensSpentForLevel,
} from "./mutagens";
import {
  normalizeMilestonesDismissed,
  normalizeMilestonesReached,
} from "./milestones";
import { resolveDenizenPurchaseTimeline } from "./purchaseTimeline";
import { DENIZEN_IDS, FIRST_DENIZEN_ID } from "./denizens";
import { SPECIALTY_IDS } from "./specialties";

export const SCHEMA_VERSION = 3;
export const CATALOG_CONTENT_VERSION = 20;

export type Clicker2Statistics = {
  total_clicks: number;
  /** Energy earned this era (passive + clicks). Resets when the pond era resets. */
  era_energy_earned: number;
  /** Energy earned across every era on this account save. */
  all_time_energy_earned: number;
  energy_from_clicking: number;
  denizen_energy_earned: Record<string, number>;
  weather_events_clicked: number;
  weather_sun_clicked: number;
  weather_wind_clicked: number;
  weather_rain_clicked: number;
};

export type Clicker2GameState = {
  energy: number;
  owned_denizens: Record<string, number>;
  owned_specialties: Record<number, boolean>;
  revealed_denizens: Record<string, boolean>;
  catalog_version: number;
  /** Epoch ms when the current pond era began. */
  pond_started_at_ms: number;
  /** 1-based pond era; increments when the pond resets for a new era. */
  pond_era: number;
  /** Wall-clock ms when the next weather emoji should spawn (countdown target). */
  next_weather_spawn_at_ms: number;
  /** Newest denizen purchase first; one emoji per buy. */
  denizen_purchase_timeline: string[];
  /** Unspent mutagens ready to spend on mutations. */
  mutagens_bank: number;
  /** Lifetime mutagens collected from the formation pipeline. */
  total_mutagens_acquired: number;
  /** Wall-clock ms when the current mutagen began forming (0 until unlocked). */
  mutagen_forming_started_at_ms: number;
  /** Per-denizen mutation level (0–10); +1% EpS per copy per level. */
  denizen_mutation_levels: Record<string, number>;
  /** Milestone id → epoch ms when first reached. */
  milestones_reached: Record<string, number>;
  /** Milestone celebration dismissed after reach. */
  milestones_dismissed: Record<string, true>;
  statistics: Clicker2Statistics;
};

export type Clicker2StateResponse = {
  state: Clicker2GameState | null;
  schema_version: number;
  created_at: string | null;
  updated_at: string | null;
  last_played_at: string | null;
  server_time: string;
  clicker2_badges_unlocked?: boolean;
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

export function createDefaultClicker2Statistics(): Clicker2Statistics {
  return {
    total_clicks: 0,
    era_energy_earned: 0,
    all_time_energy_earned: 0,
    energy_from_clicking: 0,
    denizen_energy_earned: {},
    weather_events_clicked: 0,
    weather_sun_clicked: 0,
    weather_wind_clicked: 0,
    weather_rain_clicked: 0,
  };
}

export function createDefaultClicker2State(): Clicker2GameState {
  return {
    energy: 0,
    owned_denizens: {},
    owned_specialties: {},
    revealed_denizens: { [FIRST_DENIZEN_ID]: true },
    catalog_version: CATALOG_CONTENT_VERSION,
    pond_started_at_ms: Date.now(),
    pond_era: 1,
    next_weather_spawn_at_ms: 0,
    denizen_purchase_timeline: [],
    mutagens_bank: 0,
    total_mutagens_acquired: 0,
    mutagen_forming_started_at_ms: 0,
    denizen_mutation_levels: {},
    milestones_reached: {},
    milestones_dismissed: {},
    statistics: createDefaultClicker2Statistics(),
  };
}

function normalizeClicker2Statistics(raw: unknown): Clicker2Statistics {
  const defaults = createDefaultClicker2Statistics();
  if (!raw || typeof raw !== "object") return defaults;
  const s = raw as Record<string, unknown>;

  const denizen_energy_earned: Record<string, number> = {};
  if (
    s.denizen_energy_earned &&
    typeof s.denizen_energy_earned === "object" &&
    s.denizen_energy_earned !== null
  ) {
    for (const [k, v] of Object.entries(
      s.denizen_energy_earned as Record<string, unknown>,
    )) {
      if (!DENIZEN_IDS.has(k)) continue;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        denizen_energy_earned[k] = v;
      }
    }
  }

  const legacyTotal = numField(s, "total_energy_earned", 0);
  let eraEnergy = numField(s, "era_energy_earned", legacyTotal);
  let allTimeEnergy = numField(s, "all_time_energy_earned", legacyTotal);
  if (eraEnergy <= 0 && legacyTotal > 0) eraEnergy = legacyTotal;
  if (allTimeEnergy <= 0 && legacyTotal > 0) allTimeEnergy = legacyTotal;
  allTimeEnergy = Math.max(allTimeEnergy, eraEnergy);

  return {
    total_clicks: numField(s, "total_clicks", 0),
    era_energy_earned: eraEnergy,
    all_time_energy_earned: allTimeEnergy,
    energy_from_clicking: numField(s, "energy_from_clicking", 0),
    denizen_energy_earned,
    weather_events_clicked: numField(s, "weather_events_clicked", 0),
    weather_sun_clicked: numField(s, "weather_sun_clicked", 0),
    weather_wind_clicked: numField(s, "weather_wind_clicked", 0),
    weather_rain_clicked: numField(s, "weather_rain_clicked", 0),
  };
}

export function resolvePondStartedAtMs(
  state: Clicker2GameState,
  serverCreatedAt: string | null,
): number {
  if (
    typeof state.pond_started_at_ms === "number" &&
    Number.isFinite(state.pond_started_at_ms) &&
    state.pond_started_at_ms > 0
  ) {
    return state.pond_started_at_ms;
  }
  if (serverCreatedAt) {
    const parsed = Date.parse(serverCreatedAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

export function normalizeClicker2State(raw: unknown): Clicker2GameState {
  if (!raw || typeof raw !== "object") {
    return createDefaultClicker2State();
  }
  const o = raw as Record<string, unknown>;
  const energy = numField(o, "energy", 0);

  const owned_denizens: Record<string, number> = {};
  if (
    o.owned_denizens &&
    typeof o.owned_denizens === "object" &&
    o.owned_denizens !== null
  ) {
    for (const [k, v] of Object.entries(o.owned_denizens as Record<string, unknown>)) {
      if (!DENIZEN_IDS.has(k)) continue;
      if (typeof v === "number" && Number.isFinite(v) && v > 0) {
        owned_denizens[k] = Math.floor(v);
      }
    }
  }

  const owned_specialties: Record<number, boolean> = {};
  if (
    o.owned_specialties &&
    typeof o.owned_specialties === "object" &&
    o.owned_specialties !== null
  ) {
    for (const [k, v] of Object.entries(
      o.owned_specialties as Record<string, unknown>,
    )) {
      const id = Number(k);
      if (!SPECIALTY_IDS.has(id)) continue;
      if (v === true) owned_specialties[id] = true;
    }
  }

  const revealed_denizens: Record<string, boolean> = {
    [FIRST_DENIZEN_ID]: true,
  };
  if (
    o.revealed_denizens &&
    typeof o.revealed_denizens === "object" &&
    o.revealed_denizens !== null
  ) {
    for (const [k, v] of Object.entries(
      o.revealed_denizens as Record<string, unknown>,
    )) {
      if (!DENIZEN_IDS.has(k)) continue;
      if (v === true) revealed_denizens[k] = true;
    }
  }

  const catalog_version =
    typeof o.catalog_version === "number" && Number.isFinite(o.catalog_version)
      ? Math.max(0, Math.floor(o.catalog_version))
      : CATALOG_CONTENT_VERSION;

  const pond_started_at_ms =
    typeof o.pond_started_at_ms === "number" &&
    Number.isFinite(o.pond_started_at_ms) &&
    o.pond_started_at_ms > 0
      ? o.pond_started_at_ms
      : 0;

  const pond_era = Math.max(1, Math.floor(numField(o, "pond_era", 1)));

  const next_weather_spawn_at_ms =
    typeof o.next_weather_spawn_at_ms === "number" &&
    Number.isFinite(o.next_weather_spawn_at_ms) &&
    o.next_weather_spawn_at_ms > 0
      ? o.next_weather_spawn_at_ms
      : 0;

  const statistics = normalizeClicker2Statistics(o.statistics);

  const denizen_purchase_timeline = resolveDenizenPurchaseTimeline(
    o.denizen_purchase_timeline,
    owned_denizens,
  );

  const mutagens_bank = numField(o, "mutagens_bank", 0);
  const mutagen_forming_started_at_ms = numField(
    o,
    "mutagen_forming_started_at_ms",
    0,
  );
  const denizen_mutation_levels = normalizeDenizenMutationLevels(
    o.denizen_mutation_levels,
  );

  let total_mutagens_acquired = numField(o, "total_mutagens_acquired", 0);
  if (total_mutagens_acquired === 0) {
    let spentOnMutations = 0;
    for (const level of Object.values(denizen_mutation_levels)) {
      spentOnMutations += totalMutagensSpentForLevel(level);
    }
    const floor = mutagens_bank + spentOnMutations;
    if (floor > 0) total_mutagens_acquired = floor;
  }

  const milestones_reached = normalizeMilestonesReached(o.milestones_reached);
  const milestones_dismissed = normalizeMilestonesDismissed(
    o.milestones_dismissed,
  );
  return {
    energy,
    owned_denizens,
    owned_specialties,
    revealed_denizens,
    catalog_version,
    pond_started_at_ms,
    pond_era,
    next_weather_spawn_at_ms,
    denizen_purchase_timeline,
    mutagens_bank,
    total_mutagens_acquired,
    mutagen_forming_started_at_ms,
    denizen_mutation_levels,
    milestones_reached,
    milestones_dismissed,
    statistics,
  };
}

export function normalizeClicker2StateForSchema(
  raw: unknown,
  _schemaVersion: number | undefined,
): Clicker2GameState {
  return normalizeClicker2State(raw);
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

function formatApiError(
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
      // keep raw
    }
  }
  if (detail) return `Failed to ${verb} clicker2 state (${status}): ${detail}`;
  if (trimmed) return `Failed to ${verb} clicker2 state (${status}): ${trimmed}`;
  return `Failed to ${verb} clicker2 state (${status})`;
}

export async function fetchClicker2State(
  accessToken: string | null,
): Promise<Clicker2StateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/clicker2/state/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(response.status, text, "load"));
  }
  return (await response.json()) as Clicker2StateResponse;
}

export async function saveClicker2State(
  accessToken: string | null,
  state: Clicker2GameState,
): Promise<Clicker2StateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/clicker2/state/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ state, schema_version: SCHEMA_VERSION }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatApiError(response.status, text, "save"));
  }
  return (await response.json()) as Clicker2StateResponse;
}
