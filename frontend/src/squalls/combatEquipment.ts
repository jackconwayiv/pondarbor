import {
  EQUIPMENT_DEFINITIONS,
} from "./shantiesEquipment";
import type {
  AttackCard,
  CombatCard,
  CombatTag,
  EnemyType,
  EquippedGear,
} from "./shantiesTypes";
import {
  getAttackKind,
  isAttackCard,
  isDefendCard,
} from "./shantiesTypes";

const EMPTY_SLOT_STATS = { min: 1, max: 1, tags: [] as readonly CombatTag[] };

export const EVASIVE_MISS_CHANCE = 0.25;

export function countEvasiveStacks(enemy: EnemyType): number {
  return enemy.traits?.filter((trait) => trait === "evasive").length ?? 0;
}

/** Each Evasive stack multiplies base miss chance (×2 = 50%). Capped at 100%. */
export function evasiveMissChanceForStacks(stacks: number): number {
  if (stacks <= 0) return 0;
  return Math.min(1, EVASIVE_MISS_CHANCE * stacks);
}

export function rollUniform(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getEquippedWeaponStats(
  equipped: EquippedGear,
  kind: "melee" | "ranged",
): { min: number; max: number; tags: readonly CombatTag[] } {
  const equipmentId = equipped[kind];
  if (!equipmentId) return EMPTY_SLOT_STATS;
  const def = EQUIPMENT_DEFINITIONS[equipmentId];
  if (!def.combat) return EMPTY_SLOT_STATS;
  return {
    min: def.combat.min,
    max: def.combat.max,
    tags: def.tags ?? [],
  };
}

export function getEquippedArmorStats(
  equipped: EquippedGear,
): { min: number; max: number; tags: readonly CombatTag[] } {
  const equipmentId = equipped.armor;
  if (!equipmentId) return EMPTY_SLOT_STATS;
  const def = EQUIPMENT_DEFINITIONS[equipmentId];
  if (!def.combat) return EMPTY_SLOT_STATS;
  return {
    min: def.combat.min,
    max: def.combat.max,
    tags: def.tags ?? [],
  };
}

export function rollAttackDamage(
  equipped: EquippedGear,
  card: AttackCard,
): number {
  const { min, max } = getEquippedWeaponStats(equipped, getAttackKind(card));
  if (card.strong) {
    return Math.max(rollUniform(min, max), rollUniform(min, max));
  }
  return rollUniform(min, max);
}

export function rollDefendArmor(equipped: EquippedGear): number {
  const { min, max } = getEquippedArmorStats(equipped);
  return rollUniform(min, max);
}

export function getCardDisplayTags(
  card: CombatCard,
  equipped: EquippedGear,
): readonly CombatTag[] {
  if (isAttackCard(card)) {
    const weaponTags = getEquippedWeaponStats(
      equipped,
      getAttackKind(card),
    ).tags;
    return [...weaponTags, "attack"];
  }
  if (isDefendCard(card)) {
    const armorTags = getEquippedArmorStats(equipped).tags;
    return [...armorTags, "defense"];
  }
  return [];
}

export function getAttackEffectRangeText(
  equipped: EquippedGear,
  card: AttackCard,
): string {
  const { min, max } = getEquippedWeaponStats(equipped, getAttackKind(card));
  if (card.strong) {
    return `Best of 2 × ${min}–${max} damage`;
  }
  return `${min}–${max} damage`;
}

export function getDefendEffectRangeText(equipped: EquippedGear): string {
  const { min, max } = getEquippedArmorStats(equipped);
  return `Gain ${min}–${max} armor`;
}

export function isEnemyEvasive(enemy: EnemyType): boolean {
  return countEvasiveStacks(enemy) > 0;
}

export function rollMeleeMiss(enemy: EnemyType): boolean {
  const stacks = countEvasiveStacks(enemy);
  if (stacks <= 0) return false;
  return Math.random() < evasiveMissChanceForStacks(stacks);
}

export const SHOCKING_RETALIATION_DAMAGE = 1;

export function countShockingStacks(enemy: EnemyType): number {
  return enemy.traits?.filter((trait) => trait === "shocking").length ?? 0;
}

export function shockingRetaliationDamage(enemy: EnemyType): number {
  return countShockingStacks(enemy) > 0 ? SHOCKING_RETALIATION_DAMAGE : 0;
}

export function formatShockingRetaliationLog(
  heroName: string,
  enemyName: string,
  damage: number,
): string {
  return `${heroName} is shocked by ${enemyName} for ${damage} damage!`;
}

export function formatMissLog(heroName: string, targetName: string): string {
  return `${heroName} swings at ${targetName} but misses!`;
}
