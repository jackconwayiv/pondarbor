import type { CombatCard, EnemyType } from "./shantiesTypes";
import {
  isAttackCard,
  isDefendCard,
  targetsSelfAutomatically,
} from "./shantiesTypes";

export const MAX_ENERGY_PER_TURN = 3;
export const CARDS_DRAWN_PER_TURN = 5;
export const COMBAT_LOG_MAX_ENTRIES = 5;

export function appendCombatLog(prev: string[], ...entries: string[]): string[] {
  if (entries.length === 0) return prev;
  return [...prev, ...entries].slice(-COMBAT_LOG_MAX_ENTRIES);
}

export function clampHp(value: number): number {
  return Math.max(0, value);
}

/** Fresh combat copy with max_hp guaranteed (current hp at spawn). */
export function rollD4(): number {
  return Math.floor(Math.random() * 4) + 1;
}

export function rollEnemyIntent(): EnemyType["intent"] {
  return Math.random() < 0.25 ? "defend" : "attack";
}

export function spawnEnemy(
  template: Pick<EnemyType, "name" | "level" | "hp"> & {
    max_hp?: number;
  },
): EnemyType {
  const max_hp = clampHp(template.max_hp ?? template.hp);
  return {
    name: template.name,
    level: template.level,
    hp: clampHp(template.hp),
    max_hp,
    intent: rollEnemyIntent(),
    armor: 0,
  };
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

export function assignEnemyIntents(enemies: EnemyType[]): EnemyType[] {
  return enemies.map((enemy) =>
    isEnemyAlive(enemy)
      ? { ...enemy, intent: rollEnemyIntent() }
      : enemy,
  );
}

export function formatEnemyHp(enemy: EnemyType): string {
  const max = clampHp(enemy.max_hp ?? enemy.hp);
  return `${clampHp(enemy.hp)}/${max}`;
}

export function formatEnemyIntentLabel(intent: EnemyType["intent"]): string {
  return intent === "attack" ? "Attack" : "Defend";
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

export function executeEnemyIntent(
  enemy: EnemyType,
  heroName: string,
  heroHp: number,
  playerArmor: number,
): {
  enemy: EnemyType;
  heroHp: number;
  playerArmor: number;
  message: string;
} {
  if (enemy.intent === "defend") {
    const gained = rollD4();
    return {
      enemy: { ...enemy, armor: enemy.armor + gained },
      heroHp,
      playerArmor,
      message: `${enemy.name} defends and gains ${gained} armor.`,
    };
  }

  const damage = rollD4();
  const armorBroken = Math.min(playerArmor, damage);
  const damageDealt = Math.max(0, damage - armorBroken);
  return {
    enemy,
    heroHp: clampHp(heroHp - damageDealt),
    playerArmor: playerArmor - armorBroken,
    message: formatEnemyAttackLog(
      enemy.name,
      heroName,
      armorBroken,
      damageDealt,
    ),
  };
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
  return card.name === "Strong Attack" ? 2 : 1;
}

export function getCardEffectText(card: CombatCard): string {
  if (isAttackCard(card)) {
    return `${card.minDamage}–${card.maxDamage} damage`;
  }
  if (isDefendCard(card) || targetsSelfAutomatically(card)) {
    return "Gain 1 armor";
  }
  return "";
}

