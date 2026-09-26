/** Campaign acts + scenario objectives for the pocket voyage RPG. */

export type CampaignActId = "act1" | "act2" | "act3";

export type CampaignObjectiveId =
  | "first_sail"
  | "first_landing"
  | "first_victory"
  | "first_dungeon"
  | "first_boss"
  | "first_port"
  | "deep_waters";

export type CampaignEvent =
  | "sail"
  | "land"
  | "victory"
  | "boss_slain"
  | "enter_dungeon"
  | "visit_port";

export type CampaignProgress = {
  completedObjectiveIds: CampaignObjectiveId[];
  sailsCompleted: number;
  islandsLanded: number;
  battlesWon: number;
  bossesSlain: number;
  dungeonsEntered: number;
  portsVisited: number;
};

export type CampaignObjectiveDef = {
  id: CampaignObjectiveId;
  emoji: string;
  /** Short imperative — reads like a button verb. */
  verb: string;
};

export type CampaignActDef = {
  id: CampaignActId;
  emoji: string;
  title: string;
  omen: string;
  objectiveIds: readonly CampaignObjectiveId[];
};

export const CAMPAIGN_OBJECTIVES: Record<
  CampaignObjectiveId,
  CampaignObjectiveDef
> = {
  first_sail: { id: "first_sail", emoji: "⛵", verb: "Sail" },
  first_landing: { id: "first_landing", emoji: "🏝️", verb: "Land" },
  first_victory: { id: "first_victory", emoji: "⚔️", verb: "Win a fight" },
  first_dungeon: { id: "first_dungeon", emoji: "🕳️", verb: "Delve" },
  first_boss: { id: "first_boss", emoji: "💀", verb: "Fell a boss" },
  first_port: { id: "first_port", emoji: "⚓", verb: "Dock" },
  deep_waters: { id: "deep_waters", emoji: "🌊", verb: "Win more fights" },
};

export const CAMPAIGN_ACTS: readonly CampaignActDef[] = [
  {
    id: "act1",
    emoji: "🌩️",
    title: "First Squall",
    omen: "Chart. Land. Strike.",
    objectiveIds: ["first_sail", "first_landing", "first_victory"],
  },
  {
    id: "act2",
    emoji: "🧂",
    title: "Salt & Ruin",
    omen: "Depths. Bone. Harbor.",
    objectiveIds: ["first_dungeon", "first_boss", "first_port"],
  },
  {
    id: "act3",
    emoji: "🌊",
    title: "Deep Water",
    omen: "The voyage continues.",
    objectiveIds: ["deep_waters"],
  },
];

const OBJECTIVE_IDS = Object.keys(CAMPAIGN_OBJECTIVES) as CampaignObjectiveId[];

/** Voyage milestone once Salt & Ruin is complete. */
const DEEP_WATERS_BATTLE_GOAL = 8;

export function createInitialCampaignProgress(): CampaignProgress {
  return {
    completedObjectiveIds: [],
    sailsCompleted: 0,
    islandsLanded: 0,
    battlesWon: 0,
    bossesSlain: 0,
    dungeonsEntered: 0,
    portsVisited: 0,
  };
}

function isObjectiveId(value: unknown): value is CampaignObjectiveId {
  return typeof value === "string" && OBJECTIVE_IDS.includes(value as CampaignObjectiveId);
}

export function normalizeCampaignProgress(raw: unknown): CampaignProgress {
  const defaults = createInitialCampaignProgress();
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Record<string, unknown>;
  const completed: CampaignObjectiveId[] = [];
  if (Array.isArray(record.completedObjectiveIds)) {
    for (const entry of record.completedObjectiveIds) {
      if (isObjectiveId(entry) && !completed.includes(entry)) {
        completed.push(entry);
      }
    }
  }
  const finite = (value: unknown, fallback: number) =>
    typeof value === "number" && Number.isFinite(value)
      ? Math.max(0, Math.floor(value))
      : fallback;

  return {
    completedObjectiveIds: completed,
    sailsCompleted: finite(record.sailsCompleted, 0),
    islandsLanded: finite(record.islandsLanded, 0),
    battlesWon: finite(record.battlesWon, 0),
    bossesSlain: finite(record.bossesSlain, 0),
    dungeonsEntered: finite(record.dungeonsEntered, 0),
    portsVisited: finite(record.portsVisited, 0),
  };
}

function isObjectiveComplete(
  id: CampaignObjectiveId,
  progress: CampaignProgress,
): boolean {
  if (progress.completedObjectiveIds.includes(id)) return true;
  switch (id) {
    case "first_sail":
      return progress.sailsCompleted >= 1;
    case "first_landing":
      return progress.islandsLanded >= 1;
    case "first_victory":
      return progress.battlesWon >= 1;
    case "first_dungeon":
      return progress.dungeonsEntered >= 1;
    case "first_boss":
      return progress.bossesSlain >= 1;
    case "first_port":
      return progress.portsVisited >= 1;
    case "deep_waters":
      return progress.battlesWon >= DEEP_WATERS_BATTLE_GOAL;
    default:
      return false;
  }
}

function syncCompletedObjectives(progress: CampaignProgress): CampaignProgress {
  const completed = [...progress.completedObjectiveIds];
  for (const id of OBJECTIVE_IDS) {
    if (isObjectiveComplete(id, progress) && !completed.includes(id)) {
      completed.push(id);
    }
  }
  if (completed.length === progress.completedObjectiveIds.length) {
    return progress;
  }
  return { ...progress, completedObjectiveIds: completed };
}

export function applyCampaignEvent(
  progress: CampaignProgress,
  event: CampaignEvent,
): CampaignProgress {
  let next = { ...progress };
  switch (event) {
    case "sail":
      next = { ...next, sailsCompleted: next.sailsCompleted + 1 };
      break;
    case "land":
      next = { ...next, islandsLanded: next.islandsLanded + 1 };
      break;
    case "victory":
      next = { ...next, battlesWon: next.battlesWon + 1 };
      break;
    case "boss_slain":
      next = {
        ...next,
        bossesSlain: next.bossesSlain + 1,
        battlesWon: next.battlesWon + 1,
      };
      break;
    case "enter_dungeon":
      next = { ...next, dungeonsEntered: next.dungeonsEntered + 1 };
      break;
    case "visit_port":
      next = { ...next, portsVisited: next.portsVisited + 1 };
      break;
  }
  return syncCompletedObjectives(next);
}

export function isActComplete(
  act: CampaignActDef,
  progress: CampaignProgress,
): boolean {
  return act.objectiveIds.every((id) => isObjectiveComplete(id, progress));
}

export function getCurrentAct(progress: CampaignProgress): CampaignActDef {
  for (const act of CAMPAIGN_ACTS) {
    if (!isActComplete(act, progress)) return act;
  }
  return CAMPAIGN_ACTS[CAMPAIGN_ACTS.length - 1]!;
}

export function getActiveObjective(
  progress: CampaignProgress,
): CampaignObjectiveDef | null {
  const act = getCurrentAct(progress);
  for (const id of act.objectiveIds) {
    if (!isObjectiveComplete(id, progress)) {
      return CAMPAIGN_OBJECTIVES[id];
    }
  }
  return null;
}

export function formatActiveObjectiveLine(progress: CampaignProgress): string {
  const act = getCurrentAct(progress);
  const objective = getActiveObjective(progress);
  if (!objective) {
    return `${act.emoji} ${act.title}`;
  }
  if (objective.id === "deep_waters") {
    const remaining = Math.max(
      0,
      DEEP_WATERS_BATTLE_GOAL - progress.battlesWon,
    );
    return `${act.emoji} ${objective.emoji} ${progress.battlesWon}/${DEEP_WATERS_BATTLE_GOAL} · ${remaining} left`;
  }
  return `${act.emoji} ${objective.emoji} ${objective.verb}`;
}

export function formatActSummaryLine(progress: CampaignProgress): string {
  const act = getCurrentAct(progress);
  const objective = getActiveObjective(progress);
  if (!objective) {
    return `${act.emoji} ${act.title} — complete`;
  }
  return `${act.emoji} ${act.title}: ${objective.emoji} ${objective.verb}`;
}

/** Lobby / resume copy when leaving mid-battle. */
export function formatMidCombatResumeHint(): string {
  return "⚔️ Battle paused — hand, foes, and energy hold.";
}

export function isMidCombatSaveState(
  gameState: string,
  resumeGameState: string | null,
): boolean {
  return gameState === "battle" || resumeGameState === "battle";
}
