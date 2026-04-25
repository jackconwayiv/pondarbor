/**
 * Stage progression for Harbormaster (1..12).
 *
 * Stages are *cumulative*: each entry in `STAGE_UNLOCKS` lists what is *added*
 * at that stage; the helpers below compose all stages 1..N to produce the
 * stage's effective `StageDef`. Berth cap follows the spec: `min(stageId, 9)`,
 * with stages 10..12 inheriting cap 9.
 *
 * Content (ships/buildings/...) is *not* defined here — it lives in the
 * backend catalog. Stages only declare which engine surfaces light up.
 */

import type {
  Metric,
  PanelKind,
  Resource,
  StageDef,
  StageId,
  VoyageType,
} from "../engine/types";

type StageUnlock = {
  id: StageId;
  title: string;
  era: string;
  ageQuestion: string;
  coreTension: string;
  mainLesson: string;
  /** Resources newly visible at this stage. */
  resources?: readonly Resource[];
  /** Metrics newly visible at this stage. */
  metrics?: readonly Metric[];
  /** Voyage types newly unlocked. */
  voyageTypes?: readonly VoyageType[];
  /** Panels newly shown. */
  panels?: readonly PanelKind[];
  /** Tags added to filter catalog content. */
  contentTags?: readonly string[];
  /** When the player gets to choose a permanent doctrine (stage 12). */
  doctrineUnlocked?: boolean;
  /** Base command/day at this stage. Falls back to previous stage if omitted. */
  baseCommandPerDay?: number;
};

const UNLOCKS: StageUnlock[] = [
  {
    id: 1,
    title: "Dock",
    era: "Hand-built harbor",
    ageQuestion: "Can you keep one boat fed?",
    coreTension: "Every coin matters; every voyage is small.",
    mainLesson: "Limited attention is the real resource.",
    resources: ["food", "timber", "wealth"],
    metrics: ["population", "morale"],
    voyageTypes: ["trade"],
    panels: ["harbor", "operations"],
    contentTags: ["starter"],
    baseCommandPerDay: 3,
  },
  {
    id: 2,
    title: "Cove",
    era: "Settled cove",
    ageQuestion: "What gets built first?",
    coreTension: "Buildings vs. ships vs. arrivals.",
    mainLesson: "Choose what to skip.",
    resources: ["stone"],
    metrics: ["prestige"],
    panels: ["arrivals", "buildings"],
    baseCommandPerDay: 4,
  },
  {
    id: 3,
    title: "Wharf",
    era: "Working wharf",
    ageQuestion: "Who keeps the harbor safe?",
    coreTension: "Patrol vs. profit.",
    mainLesson: "Pressure builds invisibly until it breaks.",
    resources: ["metal"],
    metrics: ["security"],
    voyageTypes: ["patrol"],
    baseCommandPerDay: 4,
  },
  {
    id: 4,
    title: "Quay",
    era: "Diplomatic quay",
    ageQuestion: "Who do you befriend?",
    coreTension: "Allies and obligations.",
    mainLesson: "Influence is its own currency.",
    metrics: ["influence"],
    voyageTypes: ["diplomacy"],
    baseCommandPerDay: 5,
  },
  {
    id: 5,
    title: "Pier",
    era: "Industrial pier",
    ageQuestion: "What can you make in bulk?",
    coreTension: "Specialization vs. resilience.",
    mainLesson: "Industry compounds.",
    voyageTypes: ["industry"],
    baseCommandPerDay: 5,
  },
  {
    id: 6,
    title: "Marina",
    era: "Civic marina",
    ageQuestion: "Who do you save?",
    coreTension: "Relief work vs. self-reliance.",
    mainLesson: "Values are revealed by triage.",
    metrics: ["readiness"],
    voyageTypes: ["relief"],
    baseCommandPerDay: 6,
  },
  {
    id: 7,
    title: "Anchorage",
    era: "Crowded anchorage",
    ageQuestion: "Who gets the berth?",
    coreTension: "Sanitation under crowding.",
    mainLesson: "Maintenance is identity.",
    metrics: ["sanitation"],
    baseCommandPerDay: 6,
  },
  {
    id: 8,
    title: "Port",
    era: "Regional port",
    ageQuestion: "How do you say no?",
    coreTension: "Throughput vs. character.",
    mainLesson: "Refusal shapes the harbor.",
    metrics: ["congestion"],
    baseCommandPerDay: 7,
  },
  {
    id: 9,
    title: "Harbor",
    era: "Major harbor",
    ageQuestion: "What is your harbor *for*?",
    coreTension: "Specialization peaks.",
    mainLesson: "Clarity of purpose beats raw scale.",
    baseCommandPerDay: 7,
  },
  {
    id: 10,
    title: "Bay",
    era: "Far horizons",
    ageQuestion: "What can you reach?",
    coreTension: "Long-range voyages, long delays.",
    mainLesson: "Time horizons stretch.",
    resources: ["oil"],
    baseCommandPerDay: 8,
  },
  {
    id: 11,
    title: "Capital",
    era: "Capital harbor",
    ageQuestion: "What do others copy?",
    coreTension: "Influence at scale.",
    mainLesson: "You are watched.",
    resources: ["rareMinerals"],
    baseCommandPerDay: 8,
  },
  {
    id: 12,
    title: "Endgame",
    era: "Doctrine of the harbor",
    ageQuestion: "What is this harbor *known for*?",
    coreTension: "Permanent identity.",
    mainLesson: "Choose, then live with it.",
    panels: ["doctrine", "policies"],
    doctrineUnlocked: true,
    contentTags: ["endgame"],
    baseCommandPerDay: 9,
  },
];

const STAGE_BY_ID = new Map<StageId, StageUnlock>(
  UNLOCKS.map((u) => [u.id, u]),
);

function dedupe<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const v of values) {
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

const DEFAULT_STARTING = {
  command: 3,
  resources: { food: 8, timber: 6, wealth: 6 } as Partial<Record<Resource, number>>,
  resourceCaps: { food: 30, timber: 30, wealth: 30 } as Partial<Record<Resource, number>>,
  metrics: { population: 12, morale: 5, prestige: 0 } as Partial<Record<Metric, number>>,
  ships: { skiff: 1 },
  buildings: { warehouse: 1, fishery: 1 },
};

/** Compose a `StageDef` from cumulative unlocks 1..stageId. */
export function buildStageDef(stageId: StageId): StageDef {
  const accumulated: {
    resources: Resource[];
    metrics: Metric[];
    voyageTypes: VoyageType[];
    panels: PanelKind[];
    contentTags: string[];
  } = {
    resources: [],
    metrics: [],
    voyageTypes: [],
    panels: [],
    contentTags: [],
  };
  let baseCommandPerDay = 3;
  let doctrineUnlocked = false;

  for (let id = 1 as number; id <= stageId; id += 1) {
    const u = STAGE_BY_ID.get(id as StageId);
    if (!u) continue;
    if (u.resources) accumulated.resources.push(...u.resources);
    if (u.metrics) accumulated.metrics.push(...u.metrics);
    if (u.voyageTypes) accumulated.voyageTypes.push(...u.voyageTypes);
    if (u.panels) accumulated.panels.push(...u.panels);
    if (u.contentTags) accumulated.contentTags.push(...u.contentTags);
    if (typeof u.baseCommandPerDay === "number") {
      baseCommandPerDay = u.baseCommandPerDay;
    }
    if (u.doctrineUnlocked) doctrineUnlocked = true;
  }

  const head = STAGE_BY_ID.get(stageId);
  if (!head) {
    throw new Error(`Unknown stage id: ${stageId}`);
  }

  return {
    id: stageId,
    title: head.title,
    era: head.era,
    ageQuestion: head.ageQuestion,
    coreTension: head.coreTension,
    mainLesson: head.mainLesson,
    resources: dedupe(accumulated.resources),
    metrics: dedupe(accumulated.metrics),
    voyageTypes: dedupe(accumulated.voyageTypes),
    panels: dedupe(accumulated.panels),
    contentTags: dedupe(accumulated.contentTags),
    berthCap: Math.min(stageId, 9),
    doctrineUnlocked,
    baseCommandPerDay,
    starting: DEFAULT_STARTING,
  };
}

/** All 12 stage defs, indexed by stage id. */
export const STAGES: ReadonlyMap<StageId, StageDef> = new Map(
  ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as StageId[]).map((id) => [
    id,
    buildStageDef(id),
  ]),
);

export function getStageDef(stageId: StageId): StageDef {
  const def = STAGES.get(stageId);
  if (!def) throw new Error(`Unknown stage id: ${stageId}`);
  return def;
}

export const STAGE_IDS: readonly StageId[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
];
