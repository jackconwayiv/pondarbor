/**
 * Harbormaster API client + state normalizer.
 *
 * Mirrors the PondClicker pattern: schema versioning, normalize-on-load,
 * client-authoritative POST. Adds catalog fetching and staff CRUD helpers
 * for the per-type editor pages.
 */

import { ALL_METRICS, ALL_RESOURCES } from "./engine/types";
import type {
  ArrivalSnapshot,
  BuildingDefExtra,
  CatalogDef,
  ConsequenceDefExtra,
  DoctrineDefExtra,
  EventDefExtra,
  EventSnapshot,
  HarborCatalog,
  HarborState,
  Metric,
  OperationDefExtra,
  PolicyDefExtra,
  Resource,
  ShipDefExtra,
  ShipInstance,
  StageId,
  ArrivalDefExtra,
} from "./engine/types";

export const SCHEMA_VERSION = 1;

export type HarborStateResponse = {
  state: HarborState | null;
  schema_version: number;
  catalog_version: number;
  current_catalog_version: number;
  created_at: string | null;
  updated_at: string | null;
  last_played_at: string | null;
  server_time: string;
};

export type StaffSchema = {
  resources: string[];
  metrics: string[];
  voyage_types: string[];
  operation_kinds: string[];
  ship_roles: string[];
  building_districts: string[];
  arrival_kinds: string[];
  event_severities: string[];
  consequence_source_kinds: string[];
  pressure_bands: string[];
  stages: number[];
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

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

async function jsonOrThrow<T>(response: Response, verb: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    let detail: string | undefined;
    if (text.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (typeof parsed.detail === "string") detail = parsed.detail;
      } catch {
        /* keep raw */
      }
    }
    throw new Error(
      detail
        ? `Failed to ${verb} (${response.status}): ${detail}`
        : `Failed to ${verb} (${response.status}): ${text || "no body"}`,
    );
  }
  return (await response.json()) as T;
}

function num(raw: unknown, fallback = 0): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return raw;
}

function intInRange(raw: unknown, min: number, max: number, fallback: number): number {
  const v = num(raw, fallback);
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function asResourceMap(raw: unknown): Record<Resource, number> {
  const out: Record<Resource, number> = {
    food: 0,
    timber: 0,
    stone: 0,
    metal: 0,
    oil: 0,
    rareMinerals: 0,
    wealth: 0,
  };
  if (raw && typeof raw === "object") {
    for (const r of ALL_RESOURCES) {
      const v = (raw as Record<string, unknown>)[r];
      if (typeof v === "number" && Number.isFinite(v)) out[r] = Math.max(0, v);
    }
  }
  return out;
}

function asMetricMap(raw: unknown): Record<Metric, number> {
  const out: Record<Metric, number> = {
    population: 0,
    prestige: 0,
    influence: 0,
    morale: 0,
    security: 0,
    sanitation: 0,
    readiness: 0,
    congestion: 0,
  };
  if (raw && typeof raw === "object") {
    for (const m of ALL_METRICS) {
      const v = (raw as Record<string, unknown>)[m];
      if (typeof v === "number" && Number.isFinite(v)) out[m] = v;
    }
  }
  return out;
}

function asPartialResources(raw: unknown): Partial<Record<Resource, number>> {
  const out: Partial<Record<Resource, number>> = {};
  if (raw && typeof raw === "object") {
    for (const r of ALL_RESOURCES) {
      const v = (raw as Record<string, unknown>)[r];
      if (typeof v === "number" && Number.isFinite(v)) out[r] = v;
    }
  }
  return out;
}

function asPartialMetrics(raw: unknown): Partial<Record<Metric, number>> {
  const out: Partial<Record<Metric, number>> = {};
  if (raw && typeof raw === "object") {
    for (const m of ALL_METRICS) {
      const v = (raw as Record<string, unknown>)[m];
      if (typeof v === "number" && Number.isFinite(v)) out[m] = v;
    }
  }
  return out;
}

function asString(raw: unknown, fallback = ""): string {
  return typeof raw === "string" ? raw : fallback;
}

/* -------------------------------------------------------------------------- */
/* Normalize                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Drop save references to slugs not present in the current catalog.
 *
 * In-flight arrivals/events keep their snapshot fields so the UI can still
 * render them; only the *defSlug* link is allowed to dangle, and we tolerate
 * that. Operations referencing a missing op slug are removed entirely
 * (cleaner than hanging them in limbo).
 */
export function normalizeHarborState(
  raw: unknown,
  catalog: HarborCatalog | null,
  fallbackStageId: StageId,
): HarborState {
  if (!raw || typeof raw !== "object") {
    return blankHarborState(fallbackStageId, catalog?.catalog_version ?? 0);
  }
  const o = raw as Record<string, unknown>;

  const catalogVersion = num(o.catalogVersion, catalog?.catalog_version ?? 0);
  const stageId = intInRange(o.stageId, 1, 12, fallbackStageId) as StageId;
  const day = Math.max(1, Math.floor(num(o.day, 1)));
  const command = Math.max(0, Math.floor(num(o.command, 0)));
  const commandPerDay = Math.max(0, Math.floor(num(o.commandPerDay, 3)));

  const resources = asResourceMap(o.resources);
  const resourceCaps = asResourceMap(o.resourceCaps);
  const metrics = asMetricMap(o.metrics);

  const berthCap = intInRange(o.berthCap, 0, 9, Math.min(stageId, 9));

  const knownShipSlugs = new Set(catalog?.ships.map((s) => s.slug) ?? []);
  const knownBuildingSlugs = new Set(catalog?.buildings.map((b) => b.slug) ?? []);
  const knownPolicySlugs = new Set(catalog?.policies.map((p) => p.slug) ?? []);
  const knownDoctrineSlugs = new Set(catalog?.doctrines.map((d) => d.slug) ?? []);
  const knownOpSlugs = new Set(catalog?.operations.map((p) => p.slug) ?? []);
  const knownConsequenceSlugs = new Set(catalog?.consequences.map((c) => c.slug) ?? []);

  const ships: ShipInstance[] = [];
  if (Array.isArray(o.ships)) {
    for (const item of o.ships) {
      if (!item || typeof item !== "object") continue;
      const s = item as Record<string, unknown>;
      const id = asString(s.id);
      const defSlug = asString(s.defSlug);
      if (!id || !defSlug) continue;
      // Tolerate dangling defSlug: keep ship; UI shows "Unknown ship".
      if (catalog && !knownShipSlugs.has(defSlug)) continue;
      const status = (s.status === "berthed" ||
      s.status === "voyage" ||
      s.status === "repair"
        ? s.status
        : "reserve") as ShipInstance["status"];
      const berthIndex =
        typeof s.berthIndex === "number" && s.berthIndex >= 0
          ? Math.floor(s.berthIndex)
          : null;
      ships.push({
        id,
        defSlug,
        hp: Math.max(0, Math.floor(num(s.hp, 1))),
        status,
        berthIndex: status === "berthed" ? berthIndex : null,
        activeOpId: typeof s.activeOpId === "string" ? s.activeOpId : null,
      });
    }
  }

  const buildings: HarborState["buildings"] = [];
  if (Array.isArray(o.buildings)) {
    for (const item of o.buildings) {
      if (!item || typeof item !== "object") continue;
      const b = item as Record<string, unknown>;
      const slug = asString(b.slug);
      if (!slug) continue;
      if (catalog && !knownBuildingSlugs.has(slug)) continue;
      const level = Math.max(0, Math.floor(num(b.level, 0)));
      if (level <= 0) continue;
      buildings.push({ slug, level });
    }
  }

  const activeOperations: HarborState["activeOperations"] = [];
  if (Array.isArray(o.activeOperations)) {
    for (const item of o.activeOperations) {
      if (!item || typeof item !== "object") continue;
      const op = item as Record<string, unknown>;
      const id = asString(op.id);
      const defSlug = asString(op.defSlug);
      if (!id || !defSlug) continue;
      if (catalog && !knownOpSlugs.has(defSlug)) continue;
      const kind = asString(op.kind, "voyage") as HarborState["activeOperations"][number]["kind"];
      activeOperations.push({
        id,
        defSlug,
        startedDay: Math.max(0, Math.floor(num(op.startedDay, 0))),
        remainingDays: Math.max(0, Math.floor(num(op.remainingDays, 1))),
        shipId: typeof op.shipId === "string" ? op.shipId : null,
        resolveRewards: asPartialResources(op.resolveRewards),
        resolveMetricEffects: asPartialMetrics(op.resolveMetricEffects),
        resolveRisk: Math.max(0, Math.min(1, num(op.resolveRisk, 0))),
        grantsShipSlug: typeof op.grantsShipSlug === "string" ? op.grantsShipSlug : null,
        kind,
      });
    }
  }

  const pendingArrivals: ArrivalSnapshot[] = Array.isArray(o.pendingArrivals)
    ? o.pendingArrivals
        .map((raw): ArrivalSnapshot | null => {
          if (!raw || typeof raw !== "object") return null;
          const a = raw as Record<string, unknown>;
          const id = asString(a.id);
          const defSlug = asString(a.defSlug);
          if (!id || !defSlug) return null;
          return {
            id,
            defSlug,
            name: asString(a.name, defSlug),
            description: asString(a.description),
            commandCost: Math.max(0, Math.floor(num(a.commandCost, 0))),
            offer: asPartialResources(a.offer),
            request: asPartialResources(a.request),
            metricEffects: asPartialMetrics(a.metricEffects),
            givesShipSlug: typeof a.givesShipSlug === "string" ? a.givesShipSlug : null,
          };
        })
        .filter((x): x is ArrivalSnapshot => x !== null)
    : [];

  const activeEvents: EventSnapshot[] = Array.isArray(o.activeEvents)
    ? o.activeEvents
        .map((raw): EventSnapshot | null => {
          if (!raw || typeof raw !== "object") return null;
          const e = raw as Record<string, unknown>;
          const id = asString(e.id);
          const defSlug = asString(e.defSlug);
          if (!id || !defSlug) return null;
          const sev = asString(e.severity, "minor");
          return {
            id,
            defSlug,
            name: asString(e.name, defSlug),
            description: asString(e.description),
            severity:
              sev === "minor" || sev === "serious" || sev === "crisis" ? sev : "minor",
            commandCost: Math.max(0, Math.floor(num(e.commandCost, 0))),
            cost: asPartialResources(e.cost),
            metricEffects: asPartialMetrics(e.metricEffects),
            onResolveMetricEffects: asPartialMetrics(e.onResolveMetricEffects),
            daysActive: Math.max(0, Math.floor(num(e.daysActive, 0))),
          };
        })
        .filter((x): x is EventSnapshot => x !== null)
    : [];

  const scheduledConsequences: HarborState["scheduledConsequences"] = [];
  if (Array.isArray(o.scheduledConsequences)) {
    for (const raw of o.scheduledConsequences) {
      if (!raw || typeof raw !== "object") continue;
      const sc = raw as Record<string, unknown>;
      const id = asString(sc.id);
      const consequenceSlug = asString(sc.consequenceSlug);
      const firesEventSlug = asString(sc.firesEventSlug);
      if (!id || !consequenceSlug || !firesEventSlug) continue;
      if (catalog && !knownConsequenceSlugs.has(consequenceSlug)) continue;
      scheduledConsequences.push({
        id,
        consequenceSlug,
        triggerDay: Math.max(0, Math.floor(num(sc.triggerDay, 0))),
        firesEventSlug,
      });
    }
  }

  const activePolicies = Array.isArray(o.activePolicies)
    ? o.activePolicies.filter(
        (s): s is string => typeof s === "string" && (!catalog || knownPolicySlugs.has(s)),
      )
    : [];

  const doctrineRaw = typeof o.doctrine === "string" ? o.doctrine : null;
  const doctrine = doctrineRaw && (!catalog || knownDoctrineSlugs.has(doctrineRaw))
    ? doctrineRaw
    : null;

  const log: HarborState["log"] = Array.isArray(o.log)
    ? o.log
        .map((raw): HarborState["log"][number] | null => {
          if (!raw || typeof raw !== "object") return null;
          const l = raw as Record<string, unknown>;
          const text = asString(l.text);
          if (!text) return null;
          const kind = asString(l.kind, "info") as HarborState["log"][number]["kind"];
          return {
            day: Math.max(0, Math.floor(num(l.day, 0))),
            text,
            kind:
              kind === "good" || kind === "bad" || kind === "warn" || kind === "info"
                ? kind
                : "info",
          };
        })
        .filter((x): x is HarborState["log"][number] => x !== null)
        .slice(0, 200)
    : [];

  const idCounter = Math.max(0, Math.floor(num(o.idCounter, 0)));

  return {
    schemaVersion: SCHEMA_VERSION,
    catalogVersion,
    stageId,
    day,
    command,
    commandPerDay,
    resources,
    resourceCaps,
    metrics,
    berthCap,
    ships,
    buildings,
    activeOperations,
    pendingArrivals,
    activeEvents,
    scheduledConsequences,
    activePolicies,
    doctrine,
    log,
    idCounter,
  };
}

function blankHarborState(stageId: StageId, catalogVersion: number): HarborState {
  return {
    schemaVersion: SCHEMA_VERSION,
    catalogVersion,
    stageId,
    day: 1,
    command: 3,
    commandPerDay: 3,
    resources: {
      food: 0,
      timber: 0,
      stone: 0,
      metal: 0,
      oil: 0,
      rareMinerals: 0,
      wealth: 0,
    },
    resourceCaps: {
      food: 0,
      timber: 0,
      stone: 0,
      metal: 0,
      oil: 0,
      rareMinerals: 0,
      wealth: 0,
    },
    metrics: {
      population: 0,
      prestige: 0,
      influence: 0,
      morale: 0,
      security: 0,
      sanitation: 0,
      readiness: 0,
      congestion: 0,
    },
    berthCap: Math.min(stageId, 9),
    ships: [],
    buildings: [],
    activeOperations: [],
    pendingArrivals: [],
    activeEvents: [],
    scheduledConsequences: [],
    activePolicies: [],
    doctrine: null,
    log: [],
    idCounter: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Player endpoints                                                           */
/* -------------------------------------------------------------------------- */

export async function fetchHarborCatalog(
  accessToken: string | null,
): Promise<HarborCatalog> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/catalog/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  return jsonOrThrow<HarborCatalog>(response, "load catalog");
}

export async function fetchHarborState(
  accessToken: string | null,
): Promise<HarborStateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/state/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  const raw = await jsonOrThrow<{
    state: unknown;
    schema_version: number;
    catalog_version: number;
    current_catalog_version: number;
    created_at: string | null;
    updated_at: string | null;
    last_played_at: string | null;
    server_time: string;
  }>(response, "load harbor state");
  return {
    ...raw,
    state: raw.state ? (raw.state as HarborState) : null,
  };
}

export async function saveHarborState(
  accessToken: string | null,
  state: HarborState,
): Promise<HarborStateResponse> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/state/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({
      state,
      schema_version: SCHEMA_VERSION,
      catalog_version: state.catalogVersion,
    }),
  });
  return jsonOrThrow<HarborStateResponse>(response, "save harbor state");
}

/* -------------------------------------------------------------------------- */
/* Staff endpoints                                                            */
/* -------------------------------------------------------------------------- */

export type DefType =
  | "ships"
  | "buildings"
  | "operations"
  | "arrivals"
  | "events"
  | "consequences"
  | "policies"
  | "doctrines";

export type DefExtraByType = {
  ships: ShipDefExtra;
  buildings: BuildingDefExtra;
  operations: OperationDefExtra;
  arrivals: ArrivalDefExtra;
  events: EventDefExtra;
  consequences: ConsequenceDefExtra;
  policies: PolicyDefExtra;
  doctrines: DoctrineDefExtra;
};

export async function fetchStaffSchema(
  accessToken: string | null,
): Promise<StaffSchema> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/staff/schema/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  return jsonOrThrow<StaffSchema>(response, "load schema");
}

export async function fetchDefList<T extends DefType>(
  accessToken: string | null,
  defType: T,
): Promise<CatalogDef<DefExtraByType[T]>[]> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/staff/${defType}/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  return jsonOrThrow<CatalogDef<DefExtraByType[T]>[]>(response, `load ${defType}`);
}

export async function createDef<T extends DefType>(
  accessToken: string | null,
  defType: T,
  payload: Partial<CatalogDef<DefExtraByType[T]>> & { slug: string; name: string },
): Promise<CatalogDef<DefExtraByType[T]>> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/staff/${defType}/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<CatalogDef<DefExtraByType[T]>>(response, `create ${defType}`);
}

export async function patchDef<T extends DefType>(
  accessToken: string | null,
  defType: T,
  pk: number,
  payload: Partial<CatalogDef<DefExtraByType[T]>>,
): Promise<CatalogDef<DefExtraByType[T]>> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/staff/${defType}/${pk}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  return jsonOrThrow<CatalogDef<DefExtraByType[T]>>(response, `update ${defType}`);
}

export async function deleteDef(
  accessToken: string | null,
  defType: DefType,
  pk: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/harbor/staff/${defType}/${pk}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Failed to delete ${defType} (${response.status}): ${text}`);
  }
}

export async function exportDefs<T extends DefType>(
  accessToken: string | null,
  defType: T,
): Promise<{
  def_type: T;
  rows: Array<Partial<CatalogDef<DefExtraByType[T]>> & { slug: string }>;
}> {
  const response = await fetch(
    `${apiBase()}/api/v1/harbor/staff/${defType}/export/`,
    {
      method: "GET",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  return jsonOrThrow(response, `export ${defType}`);
}

export async function importDefs<T extends DefType>(
  accessToken: string | null,
  defType: T,
  rows: Array<Partial<CatalogDef<DefExtraByType[T]>> & { slug: string; name: string }>,
): Promise<{ created: number; updated: number; errors: unknown[] }> {
  const response = await fetch(
    `${apiBase()}/api/v1/harbor/staff/${defType}/import/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify({ rows }),
    },
  );
  return jsonOrThrow(response, `import ${defType}`);
}
