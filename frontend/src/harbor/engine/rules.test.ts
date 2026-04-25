import { describe, expect, it } from "vitest";

import {
  EngineError,
  acceptArrival,
  advanceDay,
  createDefaultHarborState,
  declineArrival,
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
    const next = reassignShipBerth(state, catalog, ship.id, 0);
    const moved = next.ships.find((s) => s.id === ship.id)!;
    expect(moved.status).toBe("berthed");
    expect(moved.berthIndex).toBe(0);
    expect(next.command).toBe(state.command - 1);
  });
});
