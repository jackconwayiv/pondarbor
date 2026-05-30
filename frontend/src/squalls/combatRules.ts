import {
  initializeEnemyActionDeck,
} from "./enemyActions";
import type { CombatCard, CombatLogEntry, CombatLogSide, EnemyType, EquippedGear } from "./shantiesTypes";
import {
  countEvasiveStacks,
  countShockingStacks,
  getAttackEffectRangeText,
  getDefendEffectRangeText,
} from "./combatEquipment";
import {
  isAttackCard,
  cardRequiresAmmo,
  isDefendCard,
  isStrongAttackCard,
  targetsSelfAutomatically,
} from "./shantiesTypes";

export const MAX_ENERGY_PER_TURN = 3;
export const CARDS_DRAWN_PER_TURN = 5;
export const COMBAT_LOG_MAX_ENTRIES = 5;

export function appendCombatLog(
  prev: CombatLogEntry[],
  ...entries: CombatLogEntry[]
): CombatLogEntry[] {
  if (entries.length === 0) return prev;
  return [...prev, ...entries].slice(-COMBAT_LOG_MAX_ENTRIES);
}

export function combatLogLine(text: string, side: CombatLogSide): CombatLogEntry {
  return { text, side };
}

export function clampHp(value: number): number {
  return Math.max(0, value);
}

/** Fresh combat copy with max_hp guaranteed (current hp at spawn). */
export function rollD4(): number {
  return Math.floor(Math.random() * 4) + 1;
}

export function spawnEnemy(
  template: Pick<EnemyType, "name" | "level" | "hp" | "traits"> & {
    max_hp?: number;
    armor?: number;
  },
): EnemyType {
  const max_hp = clampHp(template.max_hp ?? template.hp);
  return initializeEnemyActionDeck({
    name: template.name,
    level: template.level,
    hp: clampHp(template.hp),
    max_hp,
    armor: Math.max(0, template.armor ?? 0),
    ...(template.traits && template.traits.length > 0
      ? { traits: template.traits }
      : {}),
  });
}

export function isEnemyAlive(enemy: EnemyType): boolean {
  return enemy.hp > 0;
}

export function countLivingEnemies(enemies: EnemyType[]): number {
  return enemies.filter(isEnemyAlive).length;
}

/** Next living enemy at or after `startIndex`, or null if none remain. */
export function findNextLivingEnemyIndex(
  enemies: EnemyType[],
  startIndex: number,
): number | null {
  for (let i = startIndex; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (enemy && isEnemyAlive(enemy)) return i;
  }
  return null;
}

export function formatEnemyHp(enemy: EnemyType): string {
  const max = clampHp(enemy.max_hp ?? enemy.hp);
  return `${clampHp(enemy.hp)}/${max}`;
}

export { formatEnemyBroadcastLabel } from "./enemyActions";

export function formatEnemyTraitLabel(trait: NonNullable<EnemyType["traits"]>[number]): string {
  if (trait === "evasive") return "Evasive";
  if (trait === "shocking") return "Shocking";
  return trait;
}

export function formatEvasiveTraitLabel(stacks: number): string {
  if (stacks <= 0) return "Evasive";
  return stacks === 1 ? "Evasive" : `Evasive ×${stacks}`;
}

export function formatShockingTraitLabel(stacks: number): string {
  if (stacks <= 0) return "Shocking";
  return stacks === 1 ? "Shocking" : `Shocking ×${stacks}`;
}

export function getEnemyDisplayTraits(enemy: EnemyType): string[] {
  const labels: string[] = [];
  const evasiveStacks = countEvasiveStacks(enemy);
  if (evasiveStacks > 0) {
    labels.push(formatEvasiveTraitLabel(evasiveStacks));
  }
  const shockingStacks = countShockingStacks(enemy);
  if (shockingStacks > 0) {
    labels.push(formatShockingTraitLabel(shockingStacks));
  }
  return labels;
}

/** Player attack: armor absorbs damage first; leftover reduces HP. */
export function applyAttackDamageToEnemy(
  enemy: EnemyType,
  rawDamage: number,
): {
  enemy: EnemyType;
  armorBroken: number;
  damageDealt: number;
} {
  const armorBroken = Math.min(enemy.armor, rawDamage);
  const damageDealt = Math.max(0, rawDamage - armorBroken);
  return {
    enemy: {
      ...enemy,
      armor: enemy.armor - armorBroken,
      hp: clampHp(enemy.hp - damageDealt),
    },
    armorBroken,
    damageDealt,
  };
}

function formatAttackLogLine(
  attackerName: string,
  targetName: string,
  armorBroken: number,
  damageDealt: number,
): string {
  if (armorBroken > 0 && damageDealt > 0) {
    return `${attackerName} attacked ${targetName}, broke ${armorBroken} armor, and dealt ${damageDealt} damage.`;
  }
  if (armorBroken > 0) {
    return `${attackerName} attacked ${targetName} and broke ${armorBroken} armor.`;
  }
  if (damageDealt > 0) {
    return `${attackerName} attacked ${targetName} and dealt ${damageDealt} damage.`;
  }
  return `${attackerName} attacked ${targetName} (no effect).`;
}

export function formatPlayerAttackLog(
  attackerName: string,
  targetName: string,
  armorBroken: number,
  damageDealt: number,
): string {
  return formatAttackLogLine(attackerName, targetName, armorBroken, damageDealt);
}

export function formatEnemyAttackLog(
  attackerName: string,
  targetName: string,
  armorBroken: number,
  damageDealt: number,
): string {
  return formatAttackLogLine(attackerName, targetName, armorBroken, damageDealt);
}

/** Fisher–Yates shuffle on a copy of the deck. */
export function shuffleCards(cards: CombatCard[]): CombatCard[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Full deck shuffled into the draw pile; opening hand drawn from the top. */
export function setupCombatDeck(masterDeck: CombatCard[]): {
  drawPile: CombatCard[];
  discardPile: CombatCard[];
  hand: CombatCard[];
} {
  const shuffledDrawPile = shuffleCards(masterDeck);
  const { drawPile, discardPile, drawn } = drawFromPiles(
    shuffledDrawPile,
    [],
    CARDS_DRAWN_PER_TURN,
  );
  return { drawPile, discardPile, hand: drawn };
}

/** Draw up to `count` cards; reshuffles discard into draw when draw is empty. */
export function drawFromPiles(
  drawPile: CombatCard[],
  discardPile: CombatCard[],
  count: number,
): {
  drawPile: CombatCard[];
  discardPile: CombatCard[];
  drawn: CombatCard[];
} {
  let draw = [...drawPile];
  let discard = [...discardPile];
  const drawn: CombatCard[] = [];

  while (drawn.length < count) {
    if (draw.length === 0) {
      if (discard.length === 0) break;
      draw = shuffleCards(discard);
      discard = [];
    }
    drawn.push(draw.shift()!);
  }

  return { drawPile: draw, discardPile: discard, drawn };
}

export function getCardEnergyCost(card: CombatCard): number {
  return isStrongAttackCard(card) ? 2 : 1;
}

export function getCardEffectText(
  card: CombatCard,
  equipped?: EquippedGear,
): string {
  if (isAttackCard(card)) {
    if (equipped) {
      return getAttackEffectRangeText(equipped, card);
    }
    const ammoSuffix = cardRequiresAmmo(card) ? " · 1 ammo" : "";
    return card.strong
      ? `Best of 2 × weapon damage${ammoSuffix}`
      : `Weapon damage${ammoSuffix}`;
  }
  if (isDefendCard(card) || targetsSelfAutomatically(card)) {
    if (equipped) {
      return getDefendEffectRangeText(equipped);
    }
    return "Gain armor from equipped gear";
  }
  return "";
}

