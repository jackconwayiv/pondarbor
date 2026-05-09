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
  deriveUnloadCommandReserved,
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
  PendingBuildingProject,
  PendingHullOrder,
  PendingShipwrightProject,
  Resource,
  ScheduledConsequence,
  ShipInstance,
  StageId,
} from "./types";

/** Age 1 building + shipwright commissions complete after this many end-day ticks. */
export const AGE1_CONSTRUCTION_DAYS = 2;

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
  let metrics = { ...state.metrics };
  let moraleHit = false;
  for (const r of ALL_RESOURCES_LIST) {
    const cap = caps[r] ?? state.resourceCaps[r] ?? 0;
    const v = resources[r] ?? 0;
    if (v < 0) resources[r] = 0;
    else if (v > cap && cap >= 0) {
      if (cap === 0) {
        resources[r] = 0;
      } else {
        const surplus = v - cap;
        const kept = surplus * 0.5;
        resources[r] = cap + kept;
      }
      moraleHit = true;
    }
  }
  if (moraleHit) {
    metrics = {
      ...metrics,
      morale: Math.max(0, (metrics.morale ?? 0) - 1),
    };
  }
  return { ...state, resources, resourceCaps: caps, metrics };
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
 * in mooring or berthed; the ship moves to "voyage" status. For `recruit`
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
    if (ship.status === "sea_laden") throw new EngineError("Berth returning cargo first.");
    if (ship.status === "sea_waiting") {
      throw new EngineError("Bring the ship alongside a berth before sending it on operations.");
    }
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
  return next;
}

/**
 * Move a ship between berth slots / mooring / in_port / sea_laden / sea_waiting.
 * Age 1: berth moves are free except berthing a returned laden ship from sea (1 ⚓).
 * Age 2+: costs 1 command per move.
 */
export function reassignShipBerth(
  state: HarborState,
  catalog: HarborCatalog,
  shipId: string,
  /** Target berth index (0..effectiveCap-1) or null for mooring. */
  targetBerthIndex: number | null,
): HarborState {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship) throw new EngineError("Ship not found.");
  if (ship.status === "voyage" || ship.status === "repair") {
    throw new EngineError("Cannot reassign a ship that's away.");
  }
  if (ship.status === "sea_laden" && targetBerthIndex == null) {
    throw new EngineError("Laden ships must take a berth to unload.");
  }
  if (ship.status === "sea_waiting" && targetBerthIndex == null) {
    throw new EngineError(
      "This ship is waiting offshore for a berth — drag it onto a berth to bring it in.",
    );
  }

  const effCap = deriveEffectiveBerthCap(state, catalog);
  if (targetBerthIndex != null) {
    if (targetBerthIndex < 0 || targetBerthIndex >= effCap) {
      throw new EngineError("Invalid berth.");
    }
  }

  const sameSlot =
    (targetBerthIndex == null &&
      (ship.status === "mooring" || ship.status === "in_port")) ||
    (targetBerthIndex != null &&
      ship.status === "berthed" &&
      ship.berthIndex === targetBerthIndex);
  if (sameSlot) return state;

  let next = state;
  if (state.stageId > 1) {
    next = spendCommand(state, 1);
  } else if (ship.status === "sea_laden" && targetBerthIndex != null) {
    next = spendCommand(state, 1);
  }

  let occupant: ShipInstance | undefined;
  if (targetBerthIndex != null) {
    occupant = next.ships.find(
      (s) => s.id !== ship.id && s.status === "berthed" && s.berthIndex === targetBerthIndex,
    );
  }

  const hasLadenCargo =
    ship.pendingCargo != null &&
    Object.values(ship.pendingCargo).some((v) => (v ?? 0) > 0);

  next = {
    ...next,
    ships: next.ships.map((s) => {
      if (s.id === ship.id) {
        const nextStatus = targetBerthIndex == null ? "mooring" : "berthed";
        let ladenBerthArrivalDay = ship.ladenBerthArrivalDay ?? null;
        if (
          nextStatus === "berthed" &&
          hasLadenCargo &&
          ship.status !== "berthed"
        ) {
          ladenBerthArrivalDay = state.day;
        }
        return {
          ...s,
          status: nextStatus,
          berthIndex: targetBerthIndex,
          ladenBerthArrivalDay,
        };
      }
      if (occupant && s.id === occupant.id) {
        if (ship.status === "berthed" && ship.berthIndex != null) {
          return { ...s, berthIndex: ship.berthIndex };
        }
        return { ...s, status: "mooring", berthIndex: null };
      }
      return s;
    }),
  };
  return next;
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
  if (ship.status !== "mooring" && ship.status !== "berthed") {
    throw new EngineError("Ship must be in mooring or a berth.");
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

/** Clears the persisted morning report after the player dismisses the daybreak UI. */
export function dismissMorningReport(state: HarborState): HarborState {
  return { ...state, pendingMorningReport: null };
}

function completePendingBuilding(
  state: HarborState,
  catalog: HarborCatalog,
  p: PendingBuildingProject,
): HarborState {
  const def = catalog.buildings.find((b) => b.slug === p.slug);
  if (!def) return state;
  const owned = state.buildings.find((b) => b.slug === p.slug);
  const buildings = owned
    ? state.buildings.map((b) =>
        b.slug === p.slug ? { ...b, level: p.targetLevel } : b,
      )
    : [...state.buildings, { slug: p.slug, level: p.targetLevel }];
  let next = { ...state, buildings };
  next = clampResources(next, catalog);
  next = tryPromoteToAge2(next);
  return pushLog(next, {
    kind: "good",
    text: `${def.name} upgraded to L${p.targetLevel}.`,
  });
}

function completePendingShipwright(
  state: HarborState,
  catalog: HarborCatalog,
  p: PendingShipwrightProject,
): HarborState {
  const up = catalog.ship_upgrades?.find((u) => u.slug === p.upgradeSlug);
  if (!up) return state;
  const ship = state.ships.find((s) => s.id === p.shipId);
  if (!ship) return state;
  const attachments = [...(ship.attachments ?? []), p.upgradeSlug];
  const next = {
    ...state,
    ships: state.ships.map((s) =>
      s.id === p.shipId ? { ...s, attachments } : s,
    ),
  };
  return pushLog(next, { kind: "good", text: `Installed ${up.name}.` });
}

/** Age 1: advances construction timers at each end-day (before `day` increments). */
function tickAge1Construction(
  state: HarborState,
  catalog: HarborCatalog,
): HarborState {
  if (state.stageId !== 1) return state;
  let next = state;
  const remainingBuild: PendingBuildingProject[] = [];
  for (const p of next.pendingBuildingProjects) {
    const rd = p.remainingDays - 1;
    if (rd > 0) remainingBuild.push({ ...p, remainingDays: rd });
    else next = completePendingBuilding(next, catalog, p);
  }
  next = { ...next, pendingBuildingProjects: remainingBuild };

  const remainingShip: PendingShipwrightProject[] = [];
  for (const p of next.pendingShipwrightProjects) {
    const rd = p.remainingDays - 1;
    if (rd > 0) remainingShip.push({ ...p, remainingDays: rd });
    else next = completePendingShipwright(next, catalog, p);
  }
  next = { ...next, pendingShipwrightProjects: remainingShip };

  const hullOrders = next.pendingHullOrders ?? [];
  const remainingHull: PendingHullOrder[] = [];
  for (const p of hullOrders) {
    const rd = p.remainingDays - 1;
    if (rd > 0) remainingHull.push({ ...p, remainingDays: rd });
    else next = grantShip(next, catalog, p.shipSlug);
  }
  return { ...next, pendingHullOrders: remainingHull };
}

/** Commission a catalog hull sold at the shipwright (Age 1): pay upfront, completes after `AGE1_CONSTRUCTION_DAYS`. */
export function commissionHullOrder(
  state: HarborState,
  catalog: HarborCatalog,
  shipSlug: string,
): HarborState {
  if (state.stageId !== 1) throw new EngineError("Hull commissions unlock in Age 1.");
  const def = catalog.ships.find((s) => s.slug === shipSlug);
  if (!def) throw new EngineError("Unknown ship.");
  const purchase = def.extra.shipwright_purchase;
  if (!purchase || typeof purchase !== "object") {
    throw new EngineError("That hull is not sold at the shipwright.");
  }
  const cap = deriveEffectiveBerthCap(state, catalog);
  const pendingHullOrders = state.pendingHullOrders ?? [];
  if (state.ships.length + pendingHullOrders.length >= cap) {
    throw new EngineError("No spare berth for a new hull.");
  }
  const cmdCost = Math.max(0, Math.floor(purchase.command ?? 1));
  let next = spendCommand(state, cmdCost);
  next = applyCost(next, purchase.cost ?? {});
  const idResult = nextId(next, "hullord");
  const shipName = def.name;
  return pushLog(
    {
      ...idResult.nextState,
      pendingHullOrders: [
        ...(idResult.nextState.pendingHullOrders ?? []),
        {
          id: idResult.id,
          shipSlug,
          remainingDays: AGE1_CONSTRUCTION_DAYS,
        },
      ],
    },
    {
      kind: "info",
      text: `${shipName}: hull laid (${AGE1_CONSTRUCTION_DAYS} days).`,
    },
  );
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
  if (ship.status !== "mooring" && ship.status !== "berthed") {
    throw new EngineError("Ship must be moored or berthed.");
  }
  const up = catalog.ship_upgrades?.find((u) => u.slug === upgradeSlug);
  if (!up) throw new EngineError("Unknown upgrade.");
  if ((ship.attachments ?? []).includes(upgradeSlug)) {
    throw new EngineError("Already installed.");
  }
  if (state.pendingShipwrightProjects.some((x) => x.shipId === shipId)) {
    throw new EngineError("That ship already has a shipwright project underway.");
  }
  let next = spendCommand(state, 1);
  next = applyCost(next, up.extra.cost);
  const idResult = nextId(next, "shipproj");
  return pushLog(
    {
      ...idResult.nextState,
      pendingShipwrightProjects: [
        ...idResult.nextState.pendingShipwrightProjects,
        {
          id: idResult.id,
          shipId,
          upgradeSlug,
          remainingDays: AGE1_CONSTRUCTION_DAYS,
        },
      ],
    },
    {
      kind: "info",
      text: `${up.name}: shipwright work (${AGE1_CONSTRUCTION_DAYS} days).`,
    },
  );
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

/** Place a mooring or offshore-waiting hull into the lowest free berth when capacity allows. */
function autoAssignBerthForShip(
  state: HarborState,
  catalog: HarborCatalog,
  shipId: string,
): HarborState {
  const ship = state.ships.find((s) => s.id === shipId);
  if (!ship || (ship.status !== "mooring" && ship.status !== "sea_waiting")) {
    return state;
  }
  const eff = deriveEffectiveBerthCap(state, catalog);
  const taken = new Set<number>();
  for (const s of state.ships) {
    if (s.id === shipId) continue;
    if (s.status === "berthed" && s.berthIndex != null) taken.add(s.berthIndex);
  }
  for (let i = 0; i < eff; i += 1) {
    if (!taken.has(i)) {
      return {
        ...state,
        ships: state.ships.map((s) =>
          s.id === shipId ? { ...s, status: "berthed", berthIndex: i } : s,
        ),
      };
    }
  }
  return state;
}

/** Try to berth every mooring or sea_waiting ship (e.g. after loading an older save). */
export function compactMooringIntoBerths(
  state: HarborState,
  catalog: HarborCatalog,
): HarborState {
  let next = state;
  const ids = next.ships
    .filter((s) => s.status === "mooring" || s.status === "sea_waiting")
    .map((s) => s.id);
  for (const id of ids) {
    next = autoAssignBerthForShip(next, catalog, id);
  }
  return next;
}

/** Add a ship instance from a catalog ship slug; ties up at first free berth when possible. */
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
    status: "mooring",
    berthIndex: null,
    activeOpId: null,
    ladenBerthArrivalDay: null,
  };
  let next: HarborState = {
    ...idResult.nextState,
    ships: [...idResult.nextState.ships, ship],
  };
  next = autoAssignBerthForShip(next, catalog, ship.id);
  const placed = next.ships.find((s) => s.id === ship.id);
  if (placed?.status === "mooring") {
    next = {
      ...next,
      ships: next.ships.map((s) =>
        s.id === ship.id ? { ...s, status: "sea_waiting" as const } : s,
      ),
    };
  }
  const atBerth = next.ships.find((s) => s.id === ship.id)?.status === "berthed";
  const logText = atBerth
    ? `Commissioned vessel: ${def.name}.`
    : `Commissioned vessel: ${def.name} — waiting offshore until a berth is free.`;
  return pushLog(next, { kind: "good", text: logText });
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
  if (state.pendingBuildingProjects.some((p) => p.slug === slug)) {
    throw new EngineError("That site is already under construction.");
  }
  const cost = def.extra.level_costs?.[currentLevel];
  const nextLevel = currentLevel + 1;

  if (state.stageId === 1) {
    let next = spendCommand(state, 1);
    next = applyCost(next, cost);
    const idResult = nextId(next, "bproj");
    return pushLog(
      {
        ...idResult.nextState,
        pendingBuildingProjects: [
          ...idResult.nextState.pendingBuildingProjects,
          {
            id: idResult.id,
            slug,
            targetLevel: nextLevel,
            remainingDays: AGE1_CONSTRUCTION_DAYS,
          },
        ],
      },
      {
        kind: "info",
        text: `${def.name} construction (${AGE1_CONSTRUCTION_DAYS} days).`,
      },
    );
  }

  let next = spendCommand(state, 1);
  next = applyCost(next, cost);
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
    const unloadCost = deriveUnloadCommandReserved(next);
    if (next.command < unloadCost) {
      throw new EngineError(
        "Not enough command to end the day (unload laden vessels).",
      );
    }
    next = { ...next, command: next.command - unloadCost };
    for (const s of next.ships) {
      if (s.status !== "berthed" || !s.pendingCargo) continue;
      const arrivalDay = s.ladenBerthArrivalDay;
      if (arrivalDay == null || next.day <= arrivalDay) continue;
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
          x.id === s.id
            ? { ...x, pendingCargo: null, ladenBerthArrivalDay: null }
            : x,
        ),
      };
    }
  }

  if (age1 && next.queuedDepartures.length > 0) {
    const queuedCmd = deriveCommandReserved(next);
    if (next.command < queuedCmd) {
      throw new EngineError("Not enough command to end the day (queued departures).");
    }
    next = { ...next, command: next.command - queuedCmd };
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

  next = tickAge1Construction(next, catalog);

  const stillRunning: ActiveOperation[] = [];
  for (const op of next.activeOperations) {
    /** Tick same end-day the ship sails so one hourglass comes off immediately;
     * N-night voyages still need N end-days before return. */
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
                status: "sea_laden",
                activeOpId: null,
                berthIndex: null,
                pendingCargo: { ...(ticked.resolveRewards ?? {}) },
              }
            : s,
        ),
      };
      next = pushLog(next, {
        kind: "good",
        text: `A ship returned — assign a berth to unload.`,
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
            ? { ...s, status: "mooring", activeOpId: null }
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

  if (next.stageId === 1) {
    for (const s of next.ships) {
      if (s.status !== "voyage" && s.status !== "repair") continue;
      const op = next.activeOperations.find((o) => o.id === s.activeOpId);
      if (!op || op.remainingDays <= 0) continue;
      const def = catalog.ships.find((x) => x.slug === s.defSlug);
      const name = def?.name ?? s.defSlug;
      const nights = Math.max(1, Math.floor(op.remainingDays));
      dailyReportLines.push(`${name}: ${nights} night(s) out at sea.`);
    }
    for (const s of next.ships) {
      if (s.status !== "sea_laden") continue;
      const def = catalog.ships.find((x) => x.slug === s.defSlug);
      const name = def?.name ?? s.defSlug;
      dailyReportLines.push(`${name}: returned with cargo — assign a berth to unload.`);
    }
  }

  next = {
    ...next,
    pendingMorningReport: {
      gameDay: next.day,
      dailyReportLines,
      businessReportLines,
      newEvents,
      newArrivals,
    },
  };

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
    pendingBuildingProjects: [],
    pendingShipwrightProjects: [],
    pendingHullOrders: [],
    activeOperations: [],
    queuedDepartures: [],
    pendingArrivals: [],
    activeEvents: [],
    scheduledConsequences: [],
    activePolicies: [],
    doctrine: null,
    log: [],
    idCounter: 0,
    pendingMorningReport: null,
  };

  let next = state;
  for (const [slug, count] of Object.entries(stage.starting.ships)) {
    for (let i = 0; i < count; i += 1) {
      next = grantShip(next, catalog, slug);
    }
  }
  next = compactMooringIntoBerths(next, catalog);
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
