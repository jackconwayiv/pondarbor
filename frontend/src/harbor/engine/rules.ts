/**
 * Pure deterministic transitions for Harbormaster.
 *
 * Every exported function takes `(state, stage, catalog, ...args)` and
 * returns a new `HarborState`. Functions throw `EngineError` when the
 * action is illegal — UI checks legality up front via `derive.ts` so this
 * should only fire on bad inputs (e.g. server-driven edits).
 */

import { getStageDef } from "../stages";
import {
  deriveResourceCaps,
  dailyMetricDrift,
  dailyResourceIncome,
  effectiveArrivalWeight,
  eligibleArrivalDefs,
  eligibleEventDefs,
  isOperationAvailable,
  metricPressureBand,
} from "./derive";
import {
  ALL_METRICS as ALL_METRICS_LIST,
  ALL_RESOURCES as ALL_RESOURCES_LIST,
} from "./types";
import type {
  ActiveOperation,
  ArrivalDefExtra,
  ArrivalSnapshot,
  CatalogDef,
  EventDefExtra,
  EventSnapshot,
  HarborCatalog,
  HarborState,
  LogEntry,
  Metric,
  Resource,
  ScheduledConsequence,
  ShipInstance,
  StageId,
} from "./types";

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}

const MAX_LOG_ENTRIES = 200;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nextId(state: HarborState, prefix: string): { id: string; nextState: HarborState } {
  const counter = state.idCounter + 1;
  return { id: `${prefix}-${counter}`, nextState: { ...state, idCounter: counter } };
}

function pushLog(state: HarborState, entry: Omit<LogEntry, "day">): HarborState {
  const log = [{ day: state.day, ...entry }, ...state.log].slice(0, MAX_LOG_ENTRIES);
  return { ...state, log };
}

function clampResources(
  state: HarborState,
  catalog: HarborCatalog,
): HarborState {
  const caps = deriveResourceCaps(state, catalog);
  const resources = { ...state.resources };
  for (const r of ALL_RESOURCES_LIST) {
    const cap = caps[r] ?? state.resourceCaps[r] ?? 0;
    const v = resources[r] ?? 0;
    if (v < 0) resources[r] = 0;
    else if (v > cap) resources[r] = cap;
  }
  return { ...state, resources, resourceCaps: caps };
}

function clampMetrics(state: HarborState): HarborState {
  const metrics = { ...state.metrics };
  for (const m of ALL_METRICS_LIST) {
    const v = metrics[m] ?? 0;
    if (v < 0) metrics[m] = 0;
    else if (v > 20) metrics[m] = 20;
  }
  return { ...state, metrics };
}

function applyCost(
  state: HarborState,
  cost: Partial<Record<Resource, number>> | undefined,
): HarborState {
  if (!cost) return state;
  const resources = { ...state.resources };
  for (const [res, val] of Object.entries(cost)) {
    const r = res as Resource;
    if ((resources[r] ?? 0) < val) {
      throw new EngineError(`Not enough ${r}.`);
    }
    resources[r] = (resources[r] ?? 0) - val;
  }
  return { ...state, resources };
}

function applyRewards(
  state: HarborState,
  rewards: Partial<Record<Resource, number>> | undefined,
): HarborState {
  if (!rewards) return state;
  const resources = { ...state.resources };
  for (const [res, val] of Object.entries(rewards)) {
    const r = res as Resource;
    resources[r] = (resources[r] ?? 0) + val;
  }
  return { ...state, resources };
}

function applyMetricEffects(
  state: HarborState,
  effects: Partial<Record<Metric, number>> | undefined,
): HarborState {
  if (!effects) return state;
  const metrics = { ...state.metrics };
  for (const [m, val] of Object.entries(effects)) {
    const k = m as Metric;
    metrics[k] = (metrics[k] ?? 0) + val;
  }
  return { ...state, metrics };
}

/** Spend command (raises EngineError if not enough). */
export function spendCommand(state: HarborState, amount: number): HarborState {
  if (amount <= 0) return state;
  if (state.command < amount) {
    throw new EngineError(`Not enough command (need ${amount}).`);
  }
  return { ...state, command: state.command - amount };
}

/* -------------------------------------------------------------------------- */
/* Operations                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Start an operation (voyage, recruit, repair, public_works).
 *
 * For voyages and repairs you must pass a `shipId` whose ship is currently
 * in reserve or berthed; the ship moves to "voyage" status. For `recruit`
 * and `public_works` no ship is needed.
 */
export function startOperation(
  state: HarborState,
  catalog: HarborCatalog,
  opSlug: string,
  shipId: string | null,
): HarborState {
  const def = catalog.operations.find((o) => o.slug === opSlug);
  if (!def) throw new EngineError(`Unknown operation: ${opSlug}`);
  const eligibility = isOperationAvailable(state, catalog, def);
  if (!eligibility.available) {
    throw new EngineError(eligibility.reason ?? "Operation unavailable.");
  }
  const cmdCost = def.extra.command_cost ?? 0;
  let next = spendCommand(state, cmdCost);
  next = applyCost(next, def.extra.cost);

  let assignedShipId: string | null = null;
  if (def.extra.kind === "voyage" || def.extra.kind === "repair") {
    if (!shipId) throw new EngineError("Pick a ship for this operation.");
    const ship = next.ships.find((s) => s.id === shipId);
    if (!ship) throw new EngineError("Ship not found.");
    if (ship.status === "voyage") throw new EngineError("Ship is already at sea.");
    if (ship.status === "repair") throw new EngineError("Ship is in the shipyard.");
    assignedShipId = ship.id;
  }

  const opIdResult = nextId(next, "op");
  const opId = opIdResult.id;
  next = opIdResult.nextState;

  const operation: ActiveOperation = {
    id: opId,
    defSlug: def.slug,
    startedDay: next.day,
    remainingDays: def.extra.duration_days ?? 1,
    shipId: assignedShipId,
    resolveRewards: def.extra.rewards ?? {},
    resolveMetricEffects: def.extra.metric_effects ?? {},
    resolveRisk: def.extra.risk ?? 0,
    grantsShipSlug: def.extra.grants_ship_slug ?? null,
    kind: def.extra.kind,
  };

  let ships = next.ships;
  if (assignedShipId) {
    ships = ships.map((s) =>
      s.id === assignedShipId
        ? {
            ...s,
            status: def.extra.kind === "repair" ? "repair" : "voyage",
            berthIndex: null,
            activeOpId: opId,
          }
        : s,
    );
  }

  next = {
    ...next,
    activeOperations: [...next.activeOperations, operation],
    ships,
  };
  return pushLog(next, { kind: "info", text: `Started ${def.name}.` });
}

/** Move a ship between berth slots / reserve. Costs 1 command. */
export function reassignShipBerth(
  state: HarborState,
  shipId: string,
  /** Target berth index (0..berthCap-1) or null for reserve. */
  targetBerthIndex: number | null,
): HarborState {
  const stage = getStageDef(state.stageId);
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) throw new EngineError("Ship not found.");
  if (ship.status === "voyage" || ship.status === "repair") {
    throw new EngineError("Cannot reassign a ship that's away.");
  }

  if (targetBerthIndex != null) {
    if (targetBerthIndex < 0 || targetBerthIndex >= stage.berthCap) {
      throw new EngineError("Invalid berth.");
    }
  }

  // No-op if the ship is already in the target slot.
  const sameSlot =
    (targetBerthIndex == null && ship.status === "reserve") ||
    (targetBerthIndex != null &&
      ship.status === "berthed" &&
      ship.berthIndex === targetBerthIndex);
  if (sameSlot) return state;

  let next = spendCommand(state, 1);

  let occupant: ShipInstance | undefined;
  if (targetBerthIndex != null) {
    occupant = next.ships.find(
      (s) => s.id !== ship.id && s.status === "berthed" && s.berthIndex === targetBerthIndex,
    );
  }

  next = {
    ...next,
    ships: next.ships.map((s) => {
      if (s.id === ship.id) {
        return {
          ...s,
          status: targetBerthIndex == null ? "reserve" : "berthed",
          berthIndex: targetBerthIndex,
        };
      }
      if (occupant && s.id === occupant.id) {
        if (ship.status === "berthed" && ship.berthIndex != null) {
          // Swap into ship's old berth.
          return { ...s, berthIndex: ship.berthIndex };
        }
        return { ...s, status: "reserve", berthIndex: null };
      }
      return s;
    }),
  };
  return pushLog(next, {
    kind: "info",
    text:
      targetBerthIndex == null
        ? `Ship sent to reserve.`
        : `Ship moved to berth ${targetBerthIndex + 1}.`,
  });
}

/* -------------------------------------------------------------------------- */
/* Arrivals                                                                   */
/* -------------------------------------------------------------------------- */

export function acceptArrival(
  state: HarborState,
  catalog: HarborCatalog,
  arrivalId: string,
): HarborState {
  const idx = state.pendingArrivals.findIndex((a) => a.id === arrivalId);
  if (idx === -1) throw new EngineError("Arrival not found.");
  const arrival = state.pendingArrivals[idx];

  let next = spendCommand(state, arrival.commandCost);
  next = applyCost(next, arrival.request);
  next = applyRewards(next, arrival.offer);
  next = applyMetricEffects(next, arrival.metricEffects);

  if (arrival.givesShipSlug) {
    next = grantShip(next, catalog, arrival.givesShipSlug);
  }

  next = {
    ...next,
    pendingArrivals: next.pendingArrivals.filter((a) => a.id !== arrivalId),
  };
  return pushLog(next, { kind: "good", text: `Accepted: ${arrival.name}.` });
}

export function declineArrival(
  state: HarborState,
  arrivalId: string,
): HarborState {
  const arrival = state.pendingArrivals.find((a) => a.id === arrivalId);
  if (!arrival) throw new EngineError("Arrival not found.");
  const next = {
    ...state,
    pendingArrivals: state.pendingArrivals.filter((a) => a.id !== arrivalId),
  };
  return pushLog(next, { kind: "warn", text: `Declined: ${arrival.name}.` });
}

/** Add a ship instance from a catalog ship slug; goes to reserve. */
export function grantShip(
  state: HarborState,
  catalog: HarborCatalog,
  shipSlug: string,
): HarborState {
  const def = catalog.ships.find((s) => s.slug === shipSlug);
  if (!def) {
    return pushLog(state, {
      kind: "warn",
      text: `Phantom ship offered (${shipSlug}); no catalog row.`,
    });
  }
  const idResult = nextId(state, "ship");
  const ship: ShipInstance = {
    id: idResult.id,
    defSlug: shipSlug,
    hp: def.extra.hull ?? 1,
    status: "reserve",
    berthIndex: null,
    activeOpId: null,
  };
  return pushLog(
    { ...idResult.nextState, ships: [...idResult.nextState.ships, ship] },
    { kind: "good", text: `New ship in reserve: ${def.name}.` },
  );
}

/* -------------------------------------------------------------------------- */
/* Events                                                                     */
/* -------------------------------------------------------------------------- */

export function resolveEvent(
  state: HarborState,
  eventId: string,
): HarborState {
  const ev = state.activeEvents.find((e) => e.id === eventId);
  if (!ev) throw new EngineError("Event not found.");

  let next = spendCommand(state, ev.commandCost);
  next = applyCost(next, ev.cost);
  next = applyMetricEffects(next, ev.onResolveMetricEffects);

  next = {
    ...next,
    activeEvents: next.activeEvents.filter((e) => e.id !== eventId),
  };
  return pushLog(next, { kind: "good", text: `Resolved: ${ev.name}.` });
}

/* -------------------------------------------------------------------------- */
/* Buildings                                                                  */
/* -------------------------------------------------------------------------- */

export function upgradeBuilding(
  state: HarborState,
  catalog: HarborCatalog,
  slug: string,
): HarborState {
  const def = catalog.buildings.find((b) => b.slug === slug);
  if (!def) throw new EngineError(`Unknown building: ${slug}`);
  const stage = getStageDef(state.stageId);
  if (def.stage_min > stage.id) {
    throw new EngineError("Building locked at this stage.");
  }
  const owned = state.buildings.find((b) => b.slug === slug);
  const currentLevel = owned?.level ?? 0;
  const maxLevel = def.extra.max_level ?? (def.extra.level_costs?.length ?? 0);
  if (currentLevel >= maxLevel) {
    throw new EngineError("Already at max level.");
  }
  for (const prereqSlug of def.extra.prerequisites ?? []) {
    if (!state.buildings.some((b) => b.slug === prereqSlug && b.level > 0)) {
      throw new EngineError(`Requires ${prereqSlug}.`);
    }
  }
  const cost = def.extra.level_costs?.[currentLevel];
  let next = spendCommand(state, 1);
  next = applyCost(next, cost);
  const nextLevel = currentLevel + 1;
  const buildings = owned
    ? next.buildings.map((b) => (b.slug === slug ? { ...b, level: nextLevel } : b))
    : [...next.buildings, { slug, level: nextLevel }];
  next = { ...next, buildings };
  next = clampResources(next, catalog);
  return pushLog(next, {
    kind: "good",
    text: `${def.name} upgraded to L${nextLevel}.`,
  });
}

/* -------------------------------------------------------------------------- */
/* Policies / Doctrine                                                        */
/* -------------------------------------------------------------------------- */

export function togglePolicy(
  state: HarborState,
  catalog: HarborCatalog,
  slug: string,
): HarborState {
  const def = catalog.policies.find((p) => p.slug === slug);
  if (!def) throw new EngineError(`Unknown policy: ${slug}`);
  const stage = getStageDef(state.stageId);
  if (def.stage_min > stage.id) {
    throw new EngineError("Policy locked at this stage.");
  }
  const cmdCost = def.extra.command_cost_to_toggle ?? 0;
  const isActive = state.activePolicies.includes(slug);
  let next = spendCommand(state, cmdCost);
  if (isActive) {
    next = {
      ...next,
      activePolicies: next.activePolicies.filter((s) => s !== slug),
    };
    return pushLog(next, { kind: "info", text: `Policy lifted: ${def.name}.` });
  }
  // Deactivate any existing policy in the same exclusive group.
  const group = def.extra.exclusive_group ?? slug;
  const filtered = next.activePolicies.filter((s) => {
    const other = catalog.policies.find((p) => p.slug === s);
    const otherGroup = other?.extra.exclusive_group ?? other?.slug ?? "";
    return otherGroup !== group;
  });
  next = { ...next, activePolicies: [...filtered, slug] };
  return pushLog(next, { kind: "info", text: `Policy enacted: ${def.name}.` });
}

export function assignDoctrine(
  state: HarborState,
  catalog: HarborCatalog,
  slug: string,
): HarborState {
  const stage = getStageDef(state.stageId);
  if (!stage.doctrineUnlocked) {
    throw new EngineError("Doctrine unlocks at stage 12.");
  }
  if (state.doctrine) {
    throw new EngineError("Doctrine already chosen.");
  }
  const def = catalog.doctrines.find((d) => d.slug === slug);
  if (!def) throw new EngineError(`Unknown doctrine: ${slug}`);
  return pushLog({ ...state, doctrine: slug }, {
    kind: "good",
    text: `Doctrine set: ${def.name}.`,
  });
}

/* -------------------------------------------------------------------------- */
/* Daybreak: advance one tick                                                  */
/* -------------------------------------------------------------------------- */

export type DayResult = {
  state: HarborState;
  /** New events that fired this morning. */
  newEvents: EventSnapshot[];
  /** Arrivals that appeared in port. */
  newArrivals: ArrivalSnapshot[];
  /** Resolved operations (for the cinematic readout). */
  resolvedOperations: Array<{ op: ActiveOperation; success: boolean }>;
};

/**
 * Resolve "end of day": tick operations, fire scheduled consequences, roll
 * for events and arrivals, accrue policy/building income, refill command.
 *
 * The randomness is local to this function (Math.random); save the state
 * after each call.
 */
export function advanceDay(
  state: HarborState,
  catalog: HarborCatalog,
): DayResult {
  let next = clone(state);
  const resolvedOps: Array<{ op: ActiveOperation; success: boolean }> = [];

  // 1. Resolve operations whose remaining days hit zero.
  const stillRunning: ActiveOperation[] = [];
  for (const op of next.activeOperations) {
    const ticked: ActiveOperation = { ...op, remainingDays: op.remainingDays - 1 };
    if (ticked.remainingDays > 0) {
      stillRunning.push(ticked);
      continue;
    }
    const success = Math.random() >= ticked.resolveRisk;
    if (success) {
      next = applyRewards(next, ticked.resolveRewards);
      next = applyMetricEffects(next, ticked.resolveMetricEffects);
      if (ticked.kind === "recruit" && ticked.grantsShipSlug) {
        next = grantShip(next, catalog, ticked.grantsShipSlug);
      }
      next = pushLog(next, {
        kind: "good",
        text: `Operation completed (${ticked.defSlug}).`,
      });
    } else {
      // Failed voyage: ship takes a hull point and returns to reserve.
      if (ticked.shipId) {
        next = {
          ...next,
          ships: next.ships.map((s) =>
            s.id === ticked.shipId
              ? { ...s, hp: Math.max(0, s.hp - 1) }
              : s,
          ),
        };
      }
      next = pushLog(next, {
        kind: "bad",
        text: `Operation failed (${ticked.defSlug}).`,
      });
    }

    // Free assigned ship.
    if (ticked.shipId) {
      next = {
        ...next,
        ships: next.ships.map((s) =>
          s.id === ticked.shipId
            ? { ...s, status: "reserve", activeOpId: null }
            : s,
        ),
      };
    }
    resolvedOps.push({ op: ticked, success });
  }
  next = { ...next, activeOperations: stillRunning };

  // 2. Tick active events (their per-day metric effects already applied in drift).
  next = {
    ...next,
    activeEvents: next.activeEvents.map((e) => ({ ...e, daysActive: e.daysActive + 1 })),
  };

  // 3. Apply per-day building income and metric drift.
  const income = dailyResourceIncome(next, catalog);
  next = applyRewards(next, income);
  const drift = dailyMetricDrift(next, catalog);
  next = applyMetricEffects(next, drift);

  // 4. Fire scheduled consequences whose triggerDay <= next.day.
  const fired: ScheduledConsequence[] = [];
  const remaining: ScheduledConsequence[] = [];
  for (const sc of next.scheduledConsequences) {
    if (sc.triggerDay <= next.day) fired.push(sc);
    else remaining.push(sc);
  }
  next = { ...next, scheduledConsequences: remaining };
  const newEvents: EventSnapshot[] = [];
  for (const sc of fired) {
    const def = catalog.events.find((e) => e.slug === sc.firesEventSlug);
    if (!def) continue;
    const ev = makeEventSnapshot(def, () => {
      const r = nextId(next, "event");
      next = r.nextState;
      return r.id;
    });
    next = { ...next, activeEvents: [...next.activeEvents, ev] };
    newEvents.push(ev);
    next = pushLog(next, {
      kind: "warn",
      text: `New event: ${ev.name}.`,
    });
  }

  // 5. Roll random events using stage-eligible defs.
  for (const def of eligibleEventDefs(next, catalog)) {
    const trig = def.extra.trigger;
    if (!trig) continue;
    let triggered = false;
    if (trig.random_weight && trig.random_weight > 0) {
      const chance = Math.min(0.5, trig.random_weight / 100);
      if (Math.random() < chance) triggered = true;
    }
    if (!triggered && trig.pressure) {
      const value = next.metrics[trig.pressure.metric] ?? 0;
      if (metricPressureBand(trig.pressure.metric, value) === trig.pressure.band) {
        if (Math.random() < 0.4) triggered = true;
      }
    }
    if (!triggered) continue;
    if (next.activeEvents.some((e) => e.defSlug === def.slug)) continue;
    const ev = makeEventSnapshot(def, () => {
      const r = nextId(next, "event");
      next = r.nextState;
      return r.id;
    });
    next = { ...next, activeEvents: [...next.activeEvents, ev] };
    newEvents.push(ev);
    next = pushLog(next, { kind: "warn", text: `New event: ${ev.name}.` });
  }

  // 6. Roll arrivals (1-2 weighted picks per day).
  const newArrivals: ArrivalSnapshot[] = [];
  const stage = getStageDef(next.stageId);
  const slotsBase = stage.id <= 2 ? 1 : 2;
  for (let i = 0; i < slotsBase; i += 1) {
    const eligible = eligibleArrivalDefs(next, catalog);
    if (eligible.length === 0) break;
    const weighted = eligible.map((def) => ({
      def,
      weight: Math.max(0, effectiveArrivalWeight(next, catalog, def)),
    }));
    const total = weighted.reduce((sum, w) => sum + w.weight, 0);
    if (total <= 0) break;
    let pick = Math.random() * total;
    let chosen = weighted[0]!.def;
    for (const w of weighted) {
      pick -= w.weight;
      if (pick <= 0) {
        chosen = w.def;
        break;
      }
    }
    const arrival = makeArrivalSnapshot(chosen, () => {
      const r = nextId(next, "arr");
      next = r.nextState;
      return r.id;
    });
    next = { ...next, pendingArrivals: [...next.pendingArrivals, arrival] };
    newArrivals.push(arrival);
  }

  // 7. Schedule consequences from arrivals/policies whose source kicked in.
  for (const cdef of catalog.consequences) {
    if (!cdef.enabled) continue;
    if (cdef.stage_min > stage.id) continue;
    const sourceKind = cdef.extra.source_kind;
    const sourceSlug = cdef.extra.source_slug;
    const fires = cdef.extra.fires_event_slug;
    const probability = cdef.extra.probability ?? 0;
    if (!sourceKind || !sourceSlug || !fires || probability <= 0) continue;
    if (sourceKind === "policy" && !next.activePolicies.includes(sourceSlug)) continue;
    // For arrival/operation/event sources, we naively roll once per day.
    if (Math.random() >= probability) continue;
    if (next.scheduledConsequences.some((sc) => sc.consequenceSlug === cdef.slug)) continue;
    const minDelay = cdef.extra.delay_days_min ?? 1;
    const maxDelay = cdef.extra.delay_days_max ?? minDelay;
    const delay = Math.floor(minDelay + Math.random() * Math.max(0, maxDelay - minDelay + 1));
    const r = nextId(next, "con");
    next = r.nextState;
    next.scheduledConsequences = [
      ...next.scheduledConsequences,
      {
        id: r.id,
        consequenceSlug: cdef.slug,
        triggerDay: next.day + delay,
        firesEventSlug: fires,
      },
    ];
  }

  // 8. Refill command for the new day.
  const buildBonus = next.buildings.reduce((acc, owned) => {
    const def = catalog.buildings.find((b) => b.slug === owned.slug);
    if (!def) return acc;
    const effects = def.extra.level_effects ?? [];
    let bonus = 0;
    for (let i = 0; i < Math.min(owned.level, effects.length); i += 1) {
      bonus += effects[i]?.command ?? 0;
    }
    return acc + bonus;
  }, 0);
  next = {
    ...next,
    day: next.day + 1,
    command: stage.baseCommandPerDay + buildBonus,
    commandPerDay: stage.baseCommandPerDay + buildBonus,
  };

  next = clampResources(next, catalog);
  next = clampMetrics(next);
  return { state: next, newEvents, newArrivals, resolvedOperations: resolvedOps };
}

/* -------------------------------------------------------------------------- */
/* Snapshots                                                                  */
/* -------------------------------------------------------------------------- */

function makeArrivalSnapshot(
  def: CatalogDef<ArrivalDefExtra>,
  mintId: () => string,
): ArrivalSnapshot {
  const ex = def.extra ?? {};
  return {
    id: mintId(),
    defSlug: def.slug,
    name: def.name,
    description: def.description,
    commandCost: ex.command_cost ?? 0,
    offer: ex.offer ?? {},
    request: ex.request ?? {},
    metricEffects: ex.metric_effects ?? {},
    givesShipSlug: ex.gives_ship_slug ?? null,
  };
}

function makeEventSnapshot(
  def: CatalogDef<EventDefExtra>,
  mintId: () => string,
): EventSnapshot {
  const ex = def.extra ?? {};
  return {
    id: mintId(),
    defSlug: def.slug,
    name: def.name,
    description: def.description,
    severity: ex.severity ?? "minor",
    commandCost: ex.command_cost ?? 0,
    cost: ex.cost ?? {},
    metricEffects: ex.metric_effects ?? {},
    onResolveMetricEffects: ex.on_resolve_metric_effects ?? {},
    daysActive: 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Game start                                                                 */
/* -------------------------------------------------------------------------- */

export function createDefaultHarborState(
  stageId: StageId,
  catalog: HarborCatalog,
): HarborState {
  const stage = getStageDef(stageId);
  const startResources: Record<Resource, number> = {
    food: 0,
    timber: 0,
    stone: 0,
    metal: 0,
    oil: 0,
    rareMinerals: 0,
    wealth: 0,
  };
  const startCaps: Record<Resource, number> = { ...startResources };
  for (const r of stage.resources) {
    startResources[r] = stage.starting.resources[r] ?? 0;
    startCaps[r] = stage.starting.resourceCaps[r] ?? 30;
  }
  const metrics: Record<Metric, number> = {
    population: 0,
    prestige: 0,
    influence: 0,
    morale: 0,
    security: 0,
    sanitation: 0,
    readiness: 0,
    congestion: 0,
  };
  for (const m of stage.metrics) {
    metrics[m] = stage.starting.metrics[m] ?? 5;
  }

  const state: HarborState = {
    schemaVersion: 1,
    catalogVersion: catalog.catalog_version,
    stageId,
    day: 1,
    command: stage.baseCommandPerDay + stage.starting.command,
    commandPerDay: stage.baseCommandPerDay,
    resources: startResources,
    resourceCaps: startCaps,
    metrics,
    berthCap: stage.berthCap,
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

  let next = state;
  for (const [slug, count] of Object.entries(stage.starting.ships)) {
    for (let i = 0; i < count; i += 1) {
      next = grantShip(next, catalog, slug);
    }
  }
  for (const [slug, level] of Object.entries(stage.starting.buildings)) {
    next = { ...next, buildings: [...next.buildings, { slug, level }] };
  }
  next = clampResources(next, catalog);
  return next;
}

/* re-export helpers for tests */
export { metricPressureBand };
