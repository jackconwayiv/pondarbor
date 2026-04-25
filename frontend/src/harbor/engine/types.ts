/**
 * Harbormaster engine types.
 *
 * The engine is pure functional: every transition takes
 * `(state, stage, catalog)` and returns a new `HarborState`. Content
 * referenced by `defSlug` lives in the backend catalog tables; in-flight
 * arrivals/events snapshot the def fields they care about so the UI keeps
 * working even if the catalog row is later edited or deleted.
 */

export type Resource =
  | "food"
  | "timber"
  | "stone"
  | "metal"
  | "oil"
  | "rareMinerals"
  | "wealth";

export const ALL_RESOURCES: readonly Resource[] = [
  "food",
  "timber",
  "stone",
  "metal",
  "oil",
  "rareMinerals",
  "wealth",
] as const;

export type Metric =
  | "population"
  | "prestige"
  | "influence"
  | "morale"
  | "security"
  | "sanitation"
  | "readiness"
  | "congestion";

export const ALL_METRICS: readonly Metric[] = [
  "population",
  "prestige",
  "influence",
  "morale",
  "security",
  "sanitation",
  "readiness",
  "congestion",
] as const;

export type VoyageType =
  | "trade"
  | "patrol"
  | "diplomacy"
  | "industry"
  | "relief";

export type PanelKind =
  | "harbor"
  | "operations"
  | "arrivals"
  | "buildings"
  | "policies"
  | "doctrine";

export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type ShipStatus = "berthed" | "reserve" | "voyage" | "repair";

export type ShipInstance = {
  id: string;
  defSlug: string;
  hp: number;
  status: ShipStatus;
  /** Index into `state.berths` if `status === "berthed"`. */
  berthIndex: number | null;
  /** Active operation id when `status === "voyage" | "repair"`. */
  activeOpId?: string | null;
};

export type ActiveOperation = {
  id: string;
  defSlug: string;
  startedDay: number;
  /** Days remaining; reaches 0 on resolution. */
  remainingDays: number;
  /** Optional ship assigned to a voyage/repair operation. */
  shipId?: string | null;
  /** Snapshot of the rewards/cost so resolution is stable across catalog edits. */
  resolveRewards: Partial<Record<Resource, number>>;
  resolveMetricEffects: Partial<Record<Metric, number>>;
  resolveRisk: number;
  /** For `recruit` ops, the ship slug to spawn on resolution. */
  grantsShipSlug?: string | null;
  kind: OperationKind;
};

export type OperationKind =
  | "voyage"
  | "recruit"
  | "repair"
  | "convert"
  | "public_works";

export type ArrivalSnapshot = {
  /** Unique id within the save (not catalog id). */
  id: string;
  defSlug: string;
  name: string;
  description: string;
  commandCost: number;
  offer: Partial<Record<Resource, number>>;
  request: Partial<Record<Resource, number>>;
  metricEffects: Partial<Record<Metric, number>>;
  givesShipSlug?: string | null;
};

export type EventSnapshot = {
  id: string;
  defSlug: string;
  name: string;
  description: string;
  severity: "minor" | "serious" | "crisis";
  commandCost: number;
  cost: Partial<Record<Resource, number>>;
  /** Per-day effects while active. */
  metricEffects: Partial<Record<Metric, number>>;
  onResolveMetricEffects: Partial<Record<Metric, number>>;
  daysActive: number;
};

export type ScheduledConsequence = {
  id: string;
  consequenceSlug: string;
  /** Day number on which the consequence fires. */
  triggerDay: number;
  firesEventSlug: string;
};

export type BuildingInstance = {
  slug: string;
  level: number;
};

export type LogEntry = {
  day: number;
  text: string;
  /** Coarse classification used for icon/color in the log feed. */
  kind: "info" | "good" | "bad" | "warn";
};

export type PressureBand = "low" | "neutral" | "high";

/**
 * Top-level save shape. Persisted in `HarborGameSave.state` on the backend.
 */
export type HarborState = {
  schemaVersion: number;
  /** Catalog version observed when this save was last written. */
  catalogVersion: number;
  stageId: StageId;
  day: number;
  /** Spendable command tokens this day. */
  command: number;
  /** Base command/day for this stage; refilled at end-of-day. */
  commandPerDay: number;
  resources: Record<Resource, number>;
  resourceCaps: Record<Resource, number>;
  metrics: Record<Metric, number>;
  /** Berths at indices 0..berthCap-1; we just store the cap and use ship.berthIndex. */
  berthCap: number;
  ships: ShipInstance[];
  buildings: BuildingInstance[];
  activeOperations: ActiveOperation[];
  pendingArrivals: ArrivalSnapshot[];
  activeEvents: EventSnapshot[];
  scheduledConsequences: ScheduledConsequence[];
  /** Active policy slugs (one per exclusive group). */
  activePolicies: string[];
  /** Permanent doctrine slug, set once at stage 12. */
  doctrine: string | null;
  log: LogEntry[];
  /** Bumped each time we mint a new instance id; deterministic for tests. */
  idCounter: number;
};

/**
 * Stage definition (lives in code; not editable via staff UI).
 */
export type StageDef = {
  id: StageId;
  /** Short title shown in HUD ("Dock", "Cove", ...). */
  title: string;
  /** Era label used as a subtitle. */
  era: string;
  /** Big question the player sits with this stage. */
  ageQuestion: string;
  /** One-line tension hook. */
  coreTension: string;
  /** What the player should learn by end-of-stage. */
  mainLesson: string;
  /** Resources visible in the HUD this stage. */
  resources: readonly Resource[];
  /** Metrics visible in the HUD this stage. */
  metrics: readonly Metric[];
  /** Voyage types unlocked this stage. */
  voyageTypes: readonly VoyageType[];
  /** Panels shown on the player route this stage. */
  panels: readonly PanelKind[];
  /** Tags used to filter catalog content for this stage. */
  contentTags: readonly string[];
  /** Berth cap at this stage (caps at 9 in stage 9). */
  berthCap: number;
  /** Whether the player picks a permanent doctrine this stage. */
  doctrineUnlocked: boolean;
  /** Base command/day at this stage. */
  baseCommandPerDay: number;
  /** Starting resources/metrics for a fresh save in this stage. */
  starting: {
    command: number;
    resources: Partial<Record<Resource, number>>;
    resourceCaps: Partial<Record<Resource, number>>;
    metrics: Partial<Record<Metric, number>>;
    /** Slug -> count of ships granted at game start. */
    ships: Record<string, number>;
    /** Slug -> level of pre-existing buildings. */
    buildings: Record<string, number>;
  };
};

/* -------------------------------------------------------------------------- */
/* Catalog (mirrors backend rows; defs are read-only at runtime in the game). */
/* -------------------------------------------------------------------------- */

export type CatalogDef<TExtra = Record<string, unknown>> = {
  id: number;
  slug: string;
  name: string;
  description: string;
  stage_min: number;
  stage_max: number | null;
  tags: string[];
  extra: TExtra;
  enabled: boolean;
  sort_order: number;
};

export type ShipDefExtra = {
  role?: string;
  capacity?: number;
  base_cost?: number;
  hull?: number;
};

export type BuildingDefExtra = {
  district?: string;
  max_level?: number;
  level_costs?: Array<Partial<Record<Resource, number>>>;
  level_effects?: Array<{
    caps?: Partial<Record<Resource, number>>;
    command?: number;
    metric_effects?: Partial<Record<Metric, number>>;
    per_day_resource_effects?: Partial<Record<Resource, number>>;
    unlocks_operation_slugs?: string[];
  }>;
  prerequisites?: string[];
};

export type OperationDefExtra = {
  kind: OperationKind;
  voyage_type?: VoyageType;
  command_cost?: number;
  duration_days?: number;
  cost?: Partial<Record<Resource, number>>;
  rewards?: Partial<Record<Resource, number>>;
  metric_effects?: Partial<Record<Metric, number>>;
  risk?: number;
  prerequisites?: string[];
  requires_building?: { slug: string; min_level: number };
  grants_ship_slug?: string;
};

export type ArrivalDefExtra = {
  kind?: string;
  command_cost?: number;
  offer?: Partial<Record<Resource, number>>;
  request?: Partial<Record<Resource, number>>;
  metric_effects?: Partial<Record<Metric, number>>;
  spawn_weight?: number;
  gives_ship_slug?: string;
};

export type EventDefExtra = {
  severity?: "minor" | "serious" | "crisis";
  command_cost?: number;
  cost?: Partial<Record<Resource, number>>;
  metric_effects?: Partial<Record<Metric, number>>;
  trigger?: {
    random_weight?: number;
    pressure?: { metric: Metric; band: PressureBand } | null;
  };
  on_resolve_metric_effects?: Partial<Record<Metric, number>>;
};

export type ConsequenceDefExtra = {
  source_kind?: "arrival" | "operation" | "policy" | "event";
  source_slug?: string;
  delay_days_min?: number;
  delay_days_max?: number;
  probability?: number;
  fires_event_slug?: string;
};

export type PolicyDefExtra = {
  exclusive_group?: string;
  per_day_metric_effects?: Partial<Record<Metric, number>>;
  per_day_resource_effects?: Partial<Record<Resource, number>>;
  modifiers?: {
    spawn_weights?: Record<string, number>;
    voyage_costs?: Partial<Record<VoyageType, Partial<Record<Resource, number>>>>;
    voyage_risk?: Partial<Record<VoyageType, number>>;
  };
  command_cost_to_toggle?: number;
};

export type DoctrineDefExtra = {
  permanent_metric_effects?: Partial<Record<Metric, number>>;
  permanent_modifiers?: PolicyDefExtra["modifiers"];
};

export type HarborCatalog = {
  catalog_version: number;
  ships: CatalogDef<ShipDefExtra>[];
  buildings: CatalogDef<BuildingDefExtra>[];
  operations: CatalogDef<OperationDefExtra>[];
  arrivals: CatalogDef<ArrivalDefExtra>[];
  events: CatalogDef<EventDefExtra>[];
  consequences: CatalogDef<ConsequenceDefExtra>[];
  policies: CatalogDef<PolicyDefExtra>[];
  doctrines: CatalogDef<DoctrineDefExtra>[];
};
