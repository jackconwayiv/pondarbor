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
  computeAge1VoyagePromisedRewards,
  dailyMetricDrift,
  dailyResourceIncome,
  deriveBuildingCommandBonus,
  deriveCommandReserved,
  deriveEffectiveBerthCap,
  deriveResourceCaps,
  effectiveArrivalWeight,
  eligibleArrivalDefs,
  eligibleEventDefs,
  getBuildingLevel,
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
    if (ship.status === "in_port") throw new EngineError("Berth returning cargo first.");
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

/**
 * Move a ship between berth slots / reserve / in_port.
 * Age 1+: no command cost. Later ages: costs 1 command per move (legacy).
 */
export function reassignShipBerth(
  state: HarborState,
  catalog: HarborCatalog,
  shipId: string,
  /** Target berth index (0..effectiveCap-1) or null for reserve. */
  targetBerthIndex: number | null,
): HarborState {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) throw new EngineError("Ship not found.");
  if (ship.status === "voyage" || ship.status === "repair") {
    throw new EngineError("Cannot reassign a ship that's away.");
  }

  const effCap = deriveEffectiveBerthCap(state, catalog);
  if (targetBerthIndex != null) {
    if (targetBerthIndex < 0 || targetBerthIndex >= effCap) {
      throw new EngineError("Invalid berth.");
    }
  }

  const sameSlot =
    (targetBerthIndex == null &&
      (ship.status === "reserve" || ship.status === "in_port")) ||
    (targetBerthIndex != null &&
      ship.status === "berthed" &&
      ship.berthIndex === targetBerthIndex);
  if (sameSlot) return state;

  let next = state.stageId > 1 ? spendCommand(state, 1) : state;

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
/* Age 1 departures / ship upgrades                                           */
/* -------------------------------------------------------------------------- */

function tryPromoteToAge2(state: HarborState): HarborState {
  if (state.stageId !== 1) return state;
  if (getBuildingLevel(state, "harbormasters-quarters") < 1) return state;
  if (getBuildingLevel(state, "second-berth") < 1) return state;
  const stage2 = getStageDef(2);
  const metrics = { ...state.metrics };
  for (const m of stage2.metrics) {
    const v = stage2.starting.metrics[m];
    if (v != null) metrics[m] = v;
  }
  return pushLog({ ...state, stageId: 2, metrics }, {
    kind: "good",
    text: "The harbor grows — welcome to Age 2.",
  });
}

/** Queue a voyage for end-of-day commit (Age 1 only). */
export function queueAge1Departure(
  state: HarborState,
  catalog: HarborCatalog,
  shipId: string,
): HarborState {
  if (state.stageId !== 1) throw new EngineError("Departures work in Age 1 only.");
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) throw new EngineError("Ship not found.");
  if (ship.status !== "reserve" && ship.status !== "berthed") {
    throw new EngineError("Ship must be in reserve or a berth.");
  }
  if (state.queuedDepartures.some((q) => q.shipId === shipId)) {
    throw new EngineError("That ship is already queued to depart.");
  }
  const def = catalog.ships.find((s) => s.slug === ship.defSlug);
  if (!def?.extra.voyage_yield || Object.keys(def.extra.voyage_yield).length === 0) {
    throw new EngineError("This ship cannot run an Age 1 voyage.");
  }
  const cmdCost = 1;
  if (deriveCommandReserved(state) + cmdCost > state.command) {
    throw new EngineError("Not enough command to queue another departure.");
  }
  const promisedRewards = computeAge1VoyagePromisedRewards(state, catalog, shipId);
  const voyageNights = Math.max(1, Math.floor(def.extra.voyage_nights ?? 1));
  const idResult = nextId(state, "qd");
  return {
    ...idResult.nextState,
    queuedDepartures: [
      ...state.queuedDepartures,
      {
        id: idResult.id,
        shipId,
        commandCost: cmdCost,
        promisedRewards,
        voyageNights,
      },
    ],
  };
}

export function cancelQueuedAge1Departure(
  state: HarborState,
  shipId: string,
): HarborState {
  if (!state.queuedDepartures.some((q) => q.shipId === shipId)) return state;
  return {
    ...state,
    queuedDepartures: state.queuedDepartures.filter((q) => q.shipId !== shipId),
  };
}

export function attachShipUpgrade(
  state: HarborState,
  catalog: HarborCatalog,
  shipId: string,
  upgradeSlug: string,
): HarborState {
  if (state.stageId !== 1) throw new EngineError("Upgrades unlock in Age 1.");
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) throw new EngineError("Ship not found.");
  if (ship.status !== "reserve" && ship.status !== "berthed") {
    throw new EngineError("Ship must be in reserve or berthed.");
  }
  const up = catalog.ship_upgrades?.find((u) => u.slug === upgradeSlug);
  if (!up) throw new EngineError("Unknown upgrade.");
  if ((ship.attachments ?? []).includes(upgradeSlug)) {
    throw new EngineError("Already installed.");
  }
  let next = applyCost(state, up.extra.cost);
  const attachments = [...(ship.attachments ?? []), upgradeSlug];
  next = {
    ...next,
    ships: next.ships.map((s) =>
      s.id === shipId ? { ...s, attachments } : s,
    ),
  };
  return pushLog(next, { kind: "good", text: `Installed ${up.name}.` });
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
  let next = state.stageId > 1 ? spendCommand(state, 1) : state;
  next = applyCost(next, cost);
  const nextLevel = currentLevel + 1;
  const buildings = owned
    ? next.buildings.map((b) => (b.slug === slug ? { ...b, level: nextLevel } : b))
    : [...next.buildings, { slug, level: nextLevel }];
  next = { ...next, buildings };
  next = clampResources(next, catalog);
  next = tryPromoteToAge2(next);
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
  /** Age 1 morning summary lines (counts). */
  dailyReportLines: string[];
  /** Resources banked from berthed cargo this end-day (before cinematic). */
  businessReportLines: string[];
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
  const businessReportLines: string[] = [];
  const dailyReportLines: string[] = [];
  const newEvents: EventSnapshot[] = [];
  const newArrivals: ArrivalSnapshot[] = [];
  const age1 = next.stageId === 1;

  if (age1) {
    for (const s of next.ships) {
      if (s.status !== "berthed" || !s.pendingCargo) continue;
      const cargo = s.pendingCargo;
      const parts: string[] = [];
      for (const [res, val] of Object.entries(cargo)) {
        if (!val) continue;
        const r = res as Resource;
        next = applyRewards(next, { [r]: val });
        parts.push(`+${val} ${r}`);
      }
      if (parts.length > 0) {
        const def = catalog.ships.find((x) => x.slug === s.defSlug);
        businessReportLines.push(`${def?.name ?? s.defSlug}: ${parts.join(", ")}`);
      }
      next = {
        ...next,
        ships: next.ships.map((x) =>
          x.id === s.id ? { ...x, pendingCargo: null } : x,
        ),
      };
    }
  }

  if (age1 && next.queuedDepartures.length > 0) {
    const reserved = deriveCommandReserved(next);
    if (next.command < reserved) {
      throw new EngineError("Not enough command to end the day (queued departures).");
    }
    next = { ...next, command: next.command - reserved };
    for (const q of next.queuedDepartures) {
      const opR = nextId(next, "op");
      next = opR.nextState;
      const op: ActiveOperation = {
        id: opR.id,
        defSlug: "age1-voyage",
        startedDay: next.day,
        remainingDays: q.voyageNights,
        shipId: q.shipId,
        resolveRewards: q.promisedRewards,
        resolveMetricEffects: {},
        resolveRisk: 0,
        grantsShipSlug: null,
        kind: "voyage",
        deferRewardToBerth: true,
      };
      next = {
        ...next,
        activeOperations: [...next.activeOperations, op],
        ships: next.ships.map((s) =>
          s.id === q.shipId
            ? { ...s, status: "voyage", berthIndex: null, activeOpId: op.id }
            : s,
        ),
      };
    }
    next = { ...next, queuedDepartures: [] };
  }

  const stillRunning: ActiveOperation[] = [];
  for (const op of next.activeOperations) {
    if (op.startedDay === next.day && op.deferRewardToBerth) {
      stillRunning.push(op);
      continue;
    }
    const ticked: ActiveOperation = { ...op, remainingDays: op.remainingDays - 1 };
    if (ticked.remainingDays > 0) {
      stillRunning.push(ticked);
      continue;
    }
    if (ticked.deferRewardToBerth && ticked.shipId) {
      next = {
        ...next,
        ships: next.ships.map((s) =>
          s.id === ticked.shipId
            ? {
                ...s,
                status: "in_port",
                activeOpId: null,
                berthIndex: null,
                pendingCargo: { ...(ticked.resolveRewards ?? {}) },
              }
            : s,
        ),
      };
      next = pushLog(next, {
        kind: "good",
        text: `A ship returned to the arrivals basin.`,
      });
      resolvedOps.push({ op: ticked, success: true });
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

  if (!age1) {
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
  const stageMid = getStageDef(next.stageId);
  const slotsBase = stageMid.id <= 2 ? 1 : 2;
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
    if (cdef.stage_min > stageMid.id) continue;
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
  }

  // 8. Refill command for the new day.
  const stage = getStageDef(next.stageId);
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
  next = tryPromoteToAge2(next);

  if (age1) {
    const unassigned = next.ships.filter((s) => s.status === "reserve").length;
    const atSea = next.ships.filter((s) => s.status === "voyage").length;
    const arrivals = next.ships.filter((s) => s.status === "in_port").length;
    dailyReportLines.push(`Unassigned ships: ${unassigned}`);
    dailyReportLines.push(`Ships on voyage: ${atSea}`);
    dailyReportLines.push(`Ships in arrivals: ${arrivals}`);
  }

  return {
    state: next,
    newEvents,
    newArrivals,
    resolvedOperations: resolvedOps,
    dailyReportLines,
    businessReportLines,
  };
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
    command: 0,
    commandPerDay: stage.baseCommandPerDay,
    resources: startResources,
    resourceCaps: startCaps,
    metrics,
    berthCap: stage.berthCap,
    ships: [],
    buildings: [],
    activeOperations: [],
    queuedDepartures: [],
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
  const cmdBonus = deriveBuildingCommandBonus(next, catalog);
  const extraStart = stage.starting.command ?? 0;
  return {
    ...next,
    commandPerDay: stage.baseCommandPerDay + cmdBonus,
    command: stage.baseCommandPerDay + cmdBonus + extraStart,
  };
}

/* re-export helpers for tests */
export { metricPressureBand };
