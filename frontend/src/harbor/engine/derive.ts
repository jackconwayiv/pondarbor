/**
 * Read-only views computed from `(state, stage, catalog)`.
 *
 * The UI never reads catalog rows directly — it reads `derive*` results so
 * that stage gating, building prerequisites, and policy modifiers are always
 * applied consistently. Engine functions in `rules.ts` rely on the same
 * helpers when checking eligibility.
 */

import { getStageDef } from "../stages";
import type {
  ActiveOperation,
  BuildingDefExtra,
  CatalogDef,
  EventDefExtra,
  HarborCatalog,
  HarborState,
  Metric,
  OperationDefExtra,
  PolicyDefExtra,
  PressureBand,
  Resource,
  ShipDefExtra,
  ShipInstance,
  StageDef,
  VoyageType,
} from "./types";

/** Filter catalog rows that are currently relevant for the player's stage. */
function inStageWindow(stage: StageDef, def: { stage_min: number; stage_max: number | null; enabled: boolean }) {
  if (!def.enabled) return false;
  if (def.stage_min > stage.id) return false;
  if (def.stage_max != null && def.stage_max < stage.id) return false;
  return true;
}

/** Returns the building level (or 0 if not built). */
export function getBuildingLevel(state: HarborState, slug: string): number {
  const row = state.buildings.find((b) => b.slug === slug);
  return row?.level ?? 0;
}

/** Command reserved by queued Age 1 departures (spent at end of day). */
export function deriveCommandReserved(state: HarborState): number {
  return state.queuedDepartures.reduce((s, q) => s + q.commandCost, 0);
}

/** Extra berth slots from buildings (e.g. Second Berth). */
export function deriveBerthCapBonus(
  state: HarborState,
  catalog: HarborCatalog,
): number {
  let bonus = 0;
  for (const owned of state.buildings) {
    const def = catalog.buildings.find((b) => b.slug === owned.slug);
    if (!def) continue;
    const effects = def.extra.level_effects ?? [];
    if (owned.level <= 0) continue;
    const top = effects[Math.min(owned.level, effects.length) - 1];
    bonus += top?.berth_cap_delta ?? 0;
  }
  return bonus;
}

/** Effective throughput / berth slots (state cap + building bonuses, max 9). */
export function deriveEffectiveBerthCap(
  state: HarborState,
  catalog: HarborCatalog,
): number {
  return Math.min(9, state.berthCap + deriveBerthCapBonus(state, catalog));
}

/** Alias: max ships processed per day (same as effective berth cap). */
export const deriveEffectiveThroughput = deriveEffectiveBerthCap;

/** Age 1: each laden ship that unloads this end-day costs one anchor token. */
export function deriveUnloadCommandReserved(state: HarborState): number {
  if (state.stageId !== 1) return 0;
  let n = 0;
  for (const s of state.ships) {
    if (s.status !== "berthed" || !s.pendingCargo) continue;
    const any = Object.values(s.pendingCargo).some((v) => (v ?? 0) > 0);
    if (!any) continue;
    const ad = s.ladenBerthArrivalDay;
    if (ad == null || state.day <= ad) continue;
    n += 1;
  }
  return n;
}

/** Queued voyages + pending unloads (Age 1). */
export function deriveTotalCommandReserved(state: HarborState): number {
  return deriveCommandReserved(state) + deriveUnloadCommandReserved(state);
}

/** Resources expected from queued Age 1 voyages after they complete (promised cargo). */
export function deriveQueuedVoyageIncome(
  state: HarborState,
): Partial<Record<Resource, number>> {
  const out: Partial<Record<Resource, number>> = {};
  for (const q of state.queuedDepartures) {
    for (const [res, val] of Object.entries(q.promisedRewards)) {
      const r = res as Resource;
      out[r] = (out[r] ?? 0) + (val ?? 0);
    }
  }
  return out;
}

/** Cargo that banks this end-day (after one full day berthed with laden hold). */
export function derivePendingCargoUnloadIncome(
  state: HarborState,
): Partial<Record<Resource, number>> {
  const out: Partial<Record<Resource, number>> = {};
  for (const s of state.ships) {
    if (s.status !== "berthed" || !s.pendingCargo) continue;
    const ad = s.ladenBerthArrivalDay;
    if (ad == null || state.day <= ad) continue;
    for (const [res, val] of Object.entries(s.pendingCargo)) {
      const r = res as Resource;
      const n = val ?? 0;
      if (n <= 0) continue;
      out[r] = (out[r] ?? 0) + n;
    }
  }
  return out;
}

/** Sum of `level_effects[i].command` across owned levels. */
export function deriveBuildingCommandBonus(
  state: HarborState,
  catalog: HarborCatalog,
): number {
  let bonus = 0;
  for (const owned of state.buildings) {
    const def = catalog.buildings.find((b) => b.slug === owned.slug);
    if (!def) continue;
    const effects = def.extra.level_effects ?? [];
    for (let i = 0; i < Math.min(owned.level, effects.length); i += 1) {
      bonus += effects[i]?.command ?? 0;
    }
  }
  return bonus;
}

/** Set of operation slugs unlocked by current building levels. */
export function deriveBuildingUnlockedOpSlugs(
  state: HarborState,
  catalog: HarborCatalog,
): Set<string> {
  const out = new Set<string>();
  for (const owned of state.buildings) {
    const def = catalog.buildings.find((b) => b.slug === owned.slug);
    if (!def) continue;
    const effects = def.extra.level_effects ?? [];
    for (let i = 0; i < Math.min(owned.level, effects.length); i += 1) {
      for (const slug of effects[i]?.unlocks_operation_slugs ?? []) {
        out.add(slug);
      }
    }
  }
  return out;
}

/** Is the operation's catalog row available given stage/buildings/prereqs. */
export function isOperationAvailable(
  state: HarborState,
  _catalog: HarborCatalog,
  op: CatalogDef<OperationDefExtra>,
): { available: boolean; reason?: string } {
  const stage = getStageDef(state.stageId);
  if (!inStageWindow(stage, op)) return { available: false, reason: "Locked at this stage" };
  const requires = op.extra.requires_building;
  if (requires) {
    const lvl = getBuildingLevel(state, requires.slug);
    if (lvl < requires.min_level) {
      return { available: false, reason: `Requires ${requires.slug} L${requires.min_level}` };
    }
  }
  const vt = op.extra.voyage_type;
  if (op.extra.kind === "voyage" && vt && !stage.voyageTypes.includes(vt)) {
    return { available: false, reason: "Voyage type locked" };
  }
  for (const prereq of op.extra.prerequisites ?? []) {
    if (!state.buildings.some((b) => b.slug === prereq && b.level > 0)) {
      return { available: false, reason: `Requires ${prereq}` };
    }
  }
  return { available: true };
}

export function listAvailableOperations(
  state: HarborState,
  catalog: HarborCatalog,
): Array<{ def: CatalogDef<OperationDefExtra>; available: boolean; reason?: string }> {
  return catalog.operations.map((op) => ({
    def: op,
    ...isOperationAvailable(state, catalog, op),
  }));
}

/** Cap derived from base + warehouse-style level effects. */
export function deriveResourceCaps(
  state: HarborState,
  catalog: HarborCatalog,
): Record<Resource, number> {
  const caps: Record<Resource, number> = { ...state.resourceCaps };
  for (const owned of state.buildings) {
    const def = catalog.buildings.find((b) => b.slug === owned.slug);
    if (!def) continue;
    const effects = def.extra.level_effects ?? [];
    if (owned.level <= 0) continue;
    const topEffect = effects[Math.min(owned.level, effects.length) - 1];
    for (const [res, val] of Object.entries(topEffect?.caps ?? {})) {
      const r = res as Resource;
      caps[r] = Math.max(caps[r] ?? 0, val);
    }
  }
  return caps;
}

/** Per-day resource generation from buildings and active policies. */
export function dailyResourceIncome(
  state: HarborState,
  catalog: HarborCatalog,
): Partial<Record<Resource, number>> {
  const income: Partial<Record<Resource, number>> = {};
  for (const owned of state.buildings) {
    const def = catalog.buildings.find((b) => b.slug === owned.slug);
    if (!def) continue;
    const effects = def.extra.level_effects ?? [];
    if (owned.level <= 0) continue;
    const top = effects[Math.min(owned.level, effects.length) - 1];
    const tierMul = def.extra.building_tier ? 2 : 1;
    for (const [res, val] of Object.entries(top?.per_day_resource_effects ?? {})) {
      const r = res as Resource;
      income[r] = (income[r] ?? 0) + val * tierMul;
    }
  }
  for (const slug of state.activePolicies) {
    const policy = catalog.policies.find((p) => p.slug === slug);
    if (!policy) continue;
    for (const [res, val] of Object.entries(policy.extra.per_day_resource_effects ?? {})) {
      const r = res as Resource;
      income[r] = (income[r] ?? 0) + val;
    }
  }
  return income;
}

/** Per-day metric drift from policies, doctrine, and active events. */
export function dailyMetricDrift(
  state: HarborState,
  catalog: HarborCatalog,
): Partial<Record<Metric, number>> {
  const drift: Partial<Record<Metric, number>> = {};
  for (const owned of state.buildings) {
    if (owned.level <= 0) continue;
    const slug = owned.slug;
    if (
      slug.includes("patrol") ||
      slug.includes("watch") ||
      slug.includes("watchtower")
    ) {
      drift.security = (drift.security ?? 0) + 0.25;
    }
  }
  for (const slug of state.activePolicies) {
    const p = catalog.policies.find((x) => x.slug === slug);
    if (!p) continue;
    for (const [m, v] of Object.entries(p.extra.per_day_metric_effects ?? {})) {
      const k = m as Metric;
      drift[k] = (drift[k] ?? 0) + v;
    }
  }
  if (state.doctrine) {
    const d = catalog.doctrines.find((x) => x.slug === state.doctrine);
    if (d) {
      for (const [m, v] of Object.entries(d.extra.permanent_metric_effects ?? {})) {
        const k = m as Metric;
        drift[k] = (drift[k] ?? 0) + v;
      }
    }
  }
  for (const ev of state.activeEvents) {
    for (const [m, v] of Object.entries(ev.metricEffects)) {
      const k = m as Metric;
      drift[k] = (drift[k] ?? 0) + (v ?? 0);
    }
  }
  return drift;
}

/** Pressure band ('low'|'neutral'|'high') for a given metric value. */
export function metricPressureBand(metric: Metric, value: number): PressureBand {
  // Simple bands tuned to tier-1 metrics; refine per-stage later.
  if (metric === "congestion") {
    if (value >= 7) return "high";
    if (value <= 2) return "low";
    return "neutral";
  }
  if (value <= 2) return "low";
  if (value >= 8) return "high";
  return "neutral";
}

/** Total ship capacity (capacity field summed across berthed ships). */
export function shipCapacityAtBerth(
  state: HarborState,
  catalog: HarborCatalog,
): number {
  let total = 0;
  for (const ship of state.ships) {
    if (ship.status !== "berthed") continue;
    const def = catalog.ships.find((s) => s.slug === ship.defSlug);
    total += def?.extra.capacity ?? 0;
  }
  return total;
}

/** Get the ship def or null. */
export function getShipDef(
  catalog: HarborCatalog,
  slug: string,
): CatalogDef<ShipDefExtra> | null {
  return catalog.ships.find((s) => s.slug === slug) ?? null;
}

/** Age 1 voyage yield for a ship including attachment bonuses. */
export function computeAge1VoyagePromisedRewards(
  state: HarborState,
  catalog: HarborCatalog,
  shipId: string,
): Partial<Record<Resource, number>> {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) return {};
  const def = catalog.ships.find((s) => s.slug === ship.defSlug);
  const out: Partial<Record<Resource, number>> = { ...(def?.extra.voyage_yield ?? {}) };
  for (const slug of ship.attachments ?? []) {
    const up = catalog.ship_upgrades?.find((u) => u.slug === slug);
    if (!up) continue;
    for (const [res, val] of Object.entries(up.extra.yield_bonus ?? {})) {
      const r = res as Resource;
      out[r] = (out[r] ?? 0) + (val ?? 0);
    }
  }
  return out;
}

/** Find ship by id. */
export function findShip(state: HarborState, id: string): ShipInstance | undefined {
  return state.ships.find((s) => s.id === id);
}

/** Active ops grouped by status (voyage/recruit/etc.) for HUD display. */
export function groupActiveOperations(
  state: HarborState,
): Record<string, ActiveOperation[]> {
  const out: Record<string, ActiveOperation[]> = {};
  for (const op of state.activeOperations) {
    if (!out[op.kind]) out[op.kind] = [];
    out[op.kind].push(op);
  }
  return out;
}

/** Apply active-policy spawn-weight modifiers to an arrival's base weight. */
export function effectiveArrivalWeight(
  state: HarborState,
  catalog: HarborCatalog,
  def: { extra: { kind?: string; spawn_weight?: number } },
): number {
  let weight = def.extra.spawn_weight ?? 0;
  for (const slug of state.activePolicies) {
    const p = catalog.policies.find((x) => x.slug === slug);
    const mod = p?.extra.modifiers?.spawn_weights?.[def.extra.kind ?? ""];
    if (typeof mod === "number") weight *= mod;
  }
  if (state.doctrine) {
    const d = catalog.doctrines.find((x) => x.slug === state.doctrine);
    const mod = d?.extra.permanent_modifiers?.spawn_weights?.[def.extra.kind ?? ""];
    if (typeof mod === "number") weight *= mod;
  }
  return weight;
}

/** Pending arrivals also kept in stage window (for fresh spawn pool). */
export function eligibleArrivalDefs(
  state: HarborState,
  catalog: HarborCatalog,
): HarborCatalog["arrivals"] {
  const stage = getStageDef(state.stageId);
  return catalog.arrivals.filter((a) => inStageWindow(stage, a));
}

export function eligibleEventDefs(
  state: HarborState,
  catalog: HarborCatalog,
): CatalogDef<EventDefExtra>[] {
  const stage = getStageDef(state.stageId);
  return catalog.events.filter((e) => inStageWindow(stage, e));
}

export function eligiblePolicyDefs(
  state: HarborState,
  catalog: HarborCatalog,
): CatalogDef<PolicyDefExtra>[] {
  const stage = getStageDef(state.stageId);
  return catalog.policies.filter((p) => inStageWindow(stage, p));
}

/** Group eligible policies by `exclusive_group`. */
export function groupPoliciesByExclusiveGroup(
  defs: CatalogDef<PolicyDefExtra>[],
): Map<string, CatalogDef<PolicyDefExtra>[]> {
  const out = new Map<string, CatalogDef<PolicyDefExtra>[]>();
  for (const p of defs) {
    const key = p.extra.exclusive_group ?? p.slug;
    const arr = out.get(key) ?? [];
    arr.push(p);
    out.set(key, arr);
  }
  return out;
}

export function policyByGroup(
  state: HarborState,
  catalog: HarborCatalog,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const slug of state.activePolicies) {
    const p = catalog.policies.find((x) => x.slug === slug);
    if (!p) continue;
    out.set(p.extra.exclusive_group ?? p.slug, slug);
  }
  return out;
}

/** Voyage types currently visible in the UI (intersection of stage + active ops). */
export function visibleVoyageTypes(stage: StageDef): readonly VoyageType[] {
  return stage.voyageTypes;
}

/** Compute a snapshot summary used by HUD: caps, income, drift, pressure. */
export type DerivedSnapshot = {
  resourceCaps: Record<Resource, number>;
  income: Partial<Record<Resource, number>>;
  drift: Partial<Record<Metric, number>>;
  shipCapacity: number;
  buildingCommandBonus: number;
};

export function deriveSnapshot(
  state: HarborState,
  catalog: HarborCatalog,
): DerivedSnapshot {
  return {
    resourceCaps: deriveResourceCaps(state, catalog),
    income: dailyResourceIncome(state, catalog),
    drift: dailyMetricDrift(state, catalog),
    shipCapacity: shipCapacityAtBerth(state, catalog),
    buildingCommandBonus: deriveBuildingCommandBonus(state, catalog),
  };
}

export type { BuildingDefExtra };
