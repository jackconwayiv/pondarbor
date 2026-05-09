import { describe, expect, it } from "vitest";

import { deriveEffectiveBerthCap } from "./derive";
import {
  AGE1_CONSTRUCTION_DAYS,
  EngineError,
  acceptArrival,
  advanceDay,
  commissionHullOrder,
  createDefaultHarborState,
  declineArrival,
  grantShip,
  queueAge1Departure,
  reassignShipBerth,
  resolveEvent,
  spendCommand,
  startOperation,
  togglePolicy,
  upgradeBuilding,
} from "./rules";
import type {
  ArrivalSnapshot,
  EventSnapshot,
  HarborCatalog,
  HarborState,
} from "./types";

function emptyCatalog(): HarborCatalog {
  return {
    catalog_version: 1,
    ships: [
      {
        id: 1,
        slug: "skiff",
        name: "Skiff",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: { role: "cargo", capacity: 1, hull: 1 },
        enabled: true,
        sort_order: 0,
      },
      {
        id: 2,
        slug: "trader",
        name: "Trader",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: { role: "cargo", capacity: 2, hull: 2 },
        enabled: true,
        sort_order: 1,
      },
      {
        id: 3,
        slug: "fishing-boat",
        name: "Fishing Boat",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          role: "cargo",
          capacity: 1,
          hull: 1,
          voyage_nights: 1,
          voyage_yield: { food: 2 },
        },
        enabled: true,
        sort_order: 2,
      },
      {
        id: 4,
        slug: "timber-skiff",
        name: "Timber Skiff",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          role: "cargo",
          capacity: 1,
          hull: 1,
          voyage_nights: 1,
          voyage_yield: { wealth: 4 },
        },
        enabled: true,
        sort_order: 3,
      },
      {
        id: 5,
        slug: "merchant-sloop",
        name: "Merchant Sloop",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          role: "cargo",
          capacity: 1,
          hull: 1,
          voyage_nights: 1,
          voyage_yield: { wealth: 5 },
          shipwright_purchase: {
            cost: { timber: 1 },
            command: 1,
          },
        },
        enabled: true,
        sort_order: 4,
      },
    ],
    buildings: [
      {
        id: 1,
        slug: "warehouse",
        name: "Warehouse",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          district: "Harbor",
          max_level: 2,
          level_costs: [{ timber: 2 }, { timber: 4 }],
          level_effects: [
            { caps: { food: 30, timber: 30 } },
            { caps: { food: 60, timber: 60 } },
          ],
        },
        enabled: true,
        sort_order: 0,
      },
    ],
    operations: [
      {
        id: 1,
        slug: "coastal-run",
        name: "Coastal Run",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          kind: "voyage",
          voyage_type: "trade",
          command_cost: 1,
          duration_days: 1,
          cost: { food: 1 },
          rewards: { wealth: 4 },
          metric_effects: { morale: 1 },
          risk: 0,
        },
        enabled: true,
        sort_order: 0,
      },
    ],
    arrivals: [
      {
        id: 1,
        slug: "freighter",
        name: "Freighter",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          kind: "trade",
          command_cost: 1,
          offer: { wealth: 4 },
          request: { food: 2 },
          metric_effects: { morale: 1 },
          spawn_weight: 100,
        },
        enabled: true,
        sort_order: 0,
      },
    ],
    events: [
      {
        id: 1,
        slug: "spoiled-grain",
        name: "Spoiled grain",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          severity: "minor",
          command_cost: 1,
          cost: { timber: 1 },
          metric_effects: { morale: -1 },
          on_resolve_metric_effects: { morale: 1 },
          trigger: { random_weight: 0, pressure: null },
        },
        enabled: true,
        sort_order: 0,
      },
    ],
    consequences: [],
    policies: [
      {
        id: 1,
        slug: "strict-customs",
        name: "Strict",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          exclusive_group: "customs",
          per_day_metric_effects: { security: 1 },
          modifiers: {},
          command_cost_to_toggle: 0,
        },
        enabled: true,
        sort_order: 0,
      },
      {
        id: 2,
        slug: "open-customs",
        name: "Open",
        description: "",
        stage_min: 1,
        stage_max: null,
        tags: [],
        extra: {
          exclusive_group: "customs",
          per_day_metric_effects: { morale: 1 },
          modifiers: {},
          command_cost_to_toggle: 0,
        },
        enabled: true,
        sort_order: 1,
      },
    ],
    doctrines: [],
  };
}

function freshState(): { state: HarborState; catalog: HarborCatalog } {
  const catalog = emptyCatalog();
  const state = createDefaultHarborState(2, catalog);
  return { state, catalog };
}

describe("Harbormaster engine", () => {
  it("default state seeds resources, ships, buildings", () => {
    const { state } = freshState();
    expect(state.day).toBe(1);
    expect(state.command).toBeGreaterThan(0);
    expect(state.resources.food).toBeGreaterThan(0);
    expect(state.ships.length).toBeGreaterThan(0);
    expect(state.buildings.find((b) => b.slug === "warehouse")).toBeTruthy();
    expect(Array.isArray(state.queuedDepartures)).toBe(true);
  });

  it("spendCommand throws when not enough", () => {
    const { state } = freshState();
    const drained = { ...state, command: 0 };
    expect(() => spendCommand(drained, 1)).toThrow(EngineError);
  });

  it("startOperation pulls ship to voyage and bills command + cost", () => {
    const { state, catalog } = freshState();
    // Move skiff to a berth so it's reachable; reserve also works.
    const ship = state.ships[0]!;
    const next = startOperation(state, catalog, "coastal-run", ship.id);
    const movedShip = next.ships.find((s) => s.id === ship.id)!;
    expect(movedShip.status).toBe("voyage");
    expect(next.command).toBe(state.command - 1);
    expect(next.resources.food).toBe(state.resources.food - 1);
    expect(next.activeOperations.length).toBe(1);
  });

  it("advanceDay resolves a finished voyage and refills command", () => {
    const { state, catalog } = freshState();
    const started = startOperation(state, catalog, "coastal-run", state.ships[0]!.id);
    const result = advanceDay(started, catalog);
    expect(result.state.day).toBe(state.day + 1);
    expect(result.state.activeOperations.length).toBe(0);
    expect(result.state.resources.wealth).toBeGreaterThan(state.resources.wealth);
    expect(result.state.command).toBeGreaterThan(0);
    expect(Array.isArray(result.dailyReportLines)).toBe(true);
    expect(Array.isArray(result.businessReportLines)).toBe(true);
  });

  it("acceptArrival applies offer/request/metrics", () => {
    const { state, catalog } = freshState();
    const arrival: ArrivalSnapshot = {
      id: "arr-1",
      defSlug: "freighter",
      name: "Freighter",
      description: "",
      commandCost: 1,
      offer: { wealth: 4 },
      request: { food: 2 },
      metricEffects: { morale: 1 },
      givesShipSlug: null,
    };
    const withArrival = { ...state, pendingArrivals: [arrival] };
    const next = acceptArrival(withArrival, catalog, "arr-1");
    expect(next.command).toBe(state.command - 1);
    expect(next.resources.food).toBe(state.resources.food - 2);
    expect(next.resources.wealth).toBe(state.resources.wealth + 4);
  });

  it("declineArrival removes without spending", () => {
    const { state } = freshState();
    const arrival: ArrivalSnapshot = {
      id: "arr-1",
      defSlug: "freighter",
      name: "Freighter",
      description: "",
      commandCost: 1,
      offer: {},
      request: {},
      metricEffects: {},
    };
    const withArrival = { ...state, pendingArrivals: [arrival] };
    const next = declineArrival(withArrival, "arr-1");
    expect(next.command).toBe(state.command);
    expect(next.pendingArrivals.length).toBe(0);
  });

  it("resolveEvent removes the event and applies cost", () => {
    const { state, catalog } = freshState();
    void catalog;
    const ev: EventSnapshot = {
      id: "ev-1",
      defSlug: "spoiled-grain",
      name: "Spoiled grain",
      description: "",
      severity: "minor",
      commandCost: 1,
      cost: { timber: 1 },
      metricEffects: { morale: -1 },
      onResolveMetricEffects: { morale: 1 },
      daysActive: 0,
    };
    const withEv = {
      ...state,
      activeEvents: [ev],
      resources: { ...state.resources, timber: 5 },
    };
    const next = resolveEvent(withEv, "ev-1");
    expect(next.activeEvents.length).toBe(0);
    expect(next.resources.timber).toBe(4);
    expect(next.command).toBe(state.command - 1);
  });

  it("upgradeBuilding bumps level and consumes resources", () => {
    const { state, catalog } = freshState();
    const next = upgradeBuilding(state, catalog, "warehouse");
    const building = next.buildings.find((b) => b.slug === "warehouse")!;
    expect(building.level).toBe(2);
    expect(next.resources.timber).toBe(state.resources.timber - 4);
  });

  it("Age 1 upgradeBuilding queues construction (paid upfront)", () => {
    const catalog = emptyCatalog();
    let state = createDefaultHarborState(1, catalog);
    state = {
      ...state,
      resources: { ...state.resources, timber: 10 },
      command: 5,
    };
    const next = upgradeBuilding(state, catalog, "warehouse");
    expect(next.buildings.some((b) => b.slug === "warehouse")).toBe(false);
    expect(next.pendingBuildingProjects).toHaveLength(1);
    expect(next.pendingBuildingProjects[0].remainingDays).toBe(
      AGE1_CONSTRUCTION_DAYS,
    );
    expect(next.resources.timber).toBe(state.resources.timber - 2);
    expect(next.command).toBe(state.command - 1);
  });

  it("togglePolicy enforces exclusive group", () => {
    const { state, catalog } = freshState();
    const a = togglePolicy(state, catalog, "strict-customs");
    expect(a.activePolicies).toEqual(["strict-customs"]);
    const b = togglePolicy(a, catalog, "open-customs");
    expect(b.activePolicies).toEqual(["open-customs"]);
  });

  it("reassignShipBerth moves a ship and costs 1 command (stage 2+)", () => {
    const { state, catalog } = freshState();
    const ship = state.ships[0]!;
    /** Auto-berthing places the skiff at berth 0; moving to berth 1 exercises the reassignment path. */
    const next = reassignShipBerth(state, catalog, ship.id, 1);
    const moved = next.ships.find((s) => s.id === ship.id)!;
    expect(moved.status).toBe("berthed");
    expect(moved.berthIndex).toBe(1);
    expect(next.command).toBe(state.command - 1);
  });

  it("Age 1 deferred voyage returns sea_laden; berth costs command; unload after full day in berth", () => {
    const catalog = emptyCatalog();
    let state = createDefaultHarborState(1, catalog);
    state = { ...state, command: 12 };
    const ship = state.ships.find((s) => s.defSlug === "timber-skiff");
    expect(ship).toBeDefined();
    state = queueAge1Departure(state, catalog, ship!.id);
    /** 1-night voyage ticks the same end-day as sailing; ship returns next morning. */
    let r = advanceDay(state, catalog);
    const returned = r.state.ships.find((s) => s.id === ship!.id)!;
    expect(returned.status).toBe("sea_laden");
    expect(returned.pendingCargo?.wealth).toBeGreaterThan(0);
    expect(r.dailyReportLines.some((l) => l.includes("returned with cargo"))).toBe(
      true,
    );
    const cmdBeforeBerth = r.state.command;
    const berthed = reassignShipBerth(r.state, catalog, ship!.id, 0);
    expect(berthed.command).toBe(cmdBeforeBerth - 1);
    const bShip = berthed.ships.find((s) => s.id === ship!.id)!;
    expect(bShip.status).toBe("berthed");
    expect(bShip.ladenBerthArrivalDay).toBe(r.state.day);
    const wealthAfterBerth = berthed.resources.wealth;
    r = advanceDay(berthed, catalog);
    expect(r.state.resources.wealth).toBe(wealthAfterBerth);
    const wealthBeforeUnload = r.state.resources.wealth;
    r = advanceDay(r.state, catalog);
    expect(r.state.resources.wealth).toBeGreaterThan(wealthBeforeUnload);
    expect(r.businessReportLines.some((l) => l.includes("Timber Skiff"))).toBe(true);
    expect(r.state.ships.find((s) => s.id === ship!.id)?.pendingCargo).toBeNull();
  });

  it("commissionHullOrder queues hull and completes after Age 1 ticks", () => {
    const catalog = emptyCatalog();
    let state = createDefaultHarborState(1, catalog);
    /** Free one berth slot so a commissioned hull fits Dock capacity. */
    state = {
      ...state,
      ships: state.ships.slice(1),
      resources: { ...state.resources, timber: 50 },
      command: 10,
    };
    const nBefore = state.ships.length;
    const next = commissionHullOrder(state, catalog, "merchant-sloop");
    expect(next.pendingHullOrders).toHaveLength(1);
    expect(next.pendingHullOrders![0].remainingDays).toBe(AGE1_CONSTRUCTION_DAYS);
    expect(next.ships.length).toBe(nBefore);
    expect(next.command).toBe(state.command - 1);
    let r = advanceDay(next, catalog);
    expect(r.state.pendingHullOrders).toHaveLength(1);
    expect(r.state.pendingHullOrders![0].remainingDays).toBe(
      AGE1_CONSTRUCTION_DAYS - 1,
    );
    r = advanceDay(r.state, catalog);
    expect(r.state.pendingHullOrders).toHaveLength(0);
    expect(r.state.ships.length).toBe(nBefore + 1);
    expect(r.state.ships.some((s) => s.defSlug === "merchant-sloop")).toBe(true);
  });

  it("grantShip places new hull offshore when every berth is full", () => {
    const catalog = emptyCatalog();
    let state = createDefaultHarborState(1, catalog);
    const cap = deriveEffectiveBerthCap(state, catalog);
    state = {
      ...state,
      ships: state.ships.map((s, i) =>
        i < cap
          ? { ...s, status: "berthed" as const, berthIndex: i }
          : s,
      ),
    };
    const next = grantShip(state, catalog, "trader");
    const added = next.ships.find((s) => s.defSlug === "trader");
    expect(added).toBeDefined();
    expect(added!.status).toBe("sea_waiting");
    expect(
      next.log[0]?.text?.includes("waiting offshore"),
    ).toBe(true);
  });

  it("reassignShipBerth pulls sea_waiting alongside without starting a voyage", () => {
    const catalog = emptyCatalog();
    let state = createDefaultHarborState(1, catalog);
    const cap = deriveEffectiveBerthCap(state, catalog);
    state = {
      ...state,
      ships: state.ships.map((s, i) =>
        i < cap ? { ...s, status: "berthed" as const, berthIndex: i } : s,
      ),
      command: 5,
    };
    state = grantShip(state, catalog, "trader");
    const hull = state.ships.find((s) => s.defSlug === "trader")!;
    expect(hull.status).toBe("sea_waiting");
    const cmdBefore = state.command;
    const next = reassignShipBerth(state, catalog, hull.id, 0);
    const berthed = next.ships.find((s) => s.id === hull.id)!;
    expect(berthed.status).toBe("berthed");
    expect(berthed.berthIndex).toBe(0);
    expect(next.command).toBe(cmdBefore);
  });

  it("commissionHullOrder throws when no berth capacity", () => {
    const catalog = emptyCatalog();
    const state = createDefaultHarborState(1, catalog);
    /** Dock starts with two ships and berthCap 2 — no room for hull order. */
    expect(state.ships.length).toBeGreaterThanOrEqual(2);
    expect(() => commissionHullOrder(state, catalog, "merchant-sloop")).toThrow(
      EngineError,
    );
  });
});
