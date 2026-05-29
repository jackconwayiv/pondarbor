import type { WorldPanelProps } from "./shantiesTypes";

/** WorldPanel fields driven by game state — must stay frozen during scene fades. */
export type WorldPanelVisualProps = Pick<
  WorldPanelProps,
  | "currentIsland"
  | "currentDungeon"
  | "day"
  | "hero"
  | "armor"
  | "heroWeakened"
  | "enemies"
  | "activeEvent"
  | "hand"
  | "discardPile"
  | "combatLog"
  | "energy"
  | "maxEnergy"
  | "combatPhase"
  | "victoryPending"
  | "combatVictory"
  | "combatLoot"
  | "allCombatLootClaimed"
  | "eventLoot"
  | "allEventLootClaimed"
  | "enemyActionMessage"
  | "dungeonChestUnlocked"
  | "chestMessage"
  | "forceOpenAttempted"
  | "canResumeAdventure"
  | "lobbySaveSummaryLines"
  | "lobbySavedAtLabel"
  | "restComplete"
  | "restMessage"
  | "shopMessage"
  | "shopVariant"
>;

type VisualSource = WorldPanelVisualProps;

/** Snapshot every prop WorldPanel reads for rendering (not action handlers). */
export function pickWorldPanelVisuals(source: VisualSource): WorldPanelVisualProps {
  return {
    currentIsland: source.currentIsland,
    currentDungeon: source.currentDungeon,
    day: source.day,
    hero: source.hero,
    armor: source.armor,
    heroWeakened: source.heroWeakened,
    enemies: source.enemies,
    activeEvent: source.activeEvent,
    hand: source.hand,
    discardPile: source.discardPile,
    combatLog: source.combatLog,
    energy: source.energy,
    maxEnergy: source.maxEnergy,
    combatPhase: source.combatPhase,
    victoryPending: source.victoryPending,
    combatVictory: source.combatVictory,
    combatLoot: source.combatLoot,
    allCombatLootClaimed: source.allCombatLootClaimed,
    eventLoot: source.eventLoot,
    allEventLootClaimed: source.allEventLootClaimed,
    enemyActionMessage: source.enemyActionMessage,
    dungeonChestUnlocked: source.dungeonChestUnlocked,
    chestMessage: source.chestMessage,
    forceOpenAttempted: source.forceOpenAttempted,
    canResumeAdventure: source.canResumeAdventure,
    lobbySaveSummaryLines: source.lobbySaveSummaryLines,
    lobbySavedAtLabel: source.lobbySavedAtLabel,
    restComplete: source.restComplete,
    restMessage: source.restMessage,
    shopMessage: source.shopMessage,
    shopVariant: source.shopVariant,
  };
}
