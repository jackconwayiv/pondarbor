import { getCardDefinition } from "./squallsCardCatalog";
import {
  EQUIPMENT_DEFINITIONS,
} from "./shantiesEquipment";
import type {
  CombatCard,
  CombatTag,
  EnemyType,
  EquippedGear,
  EquipmentId,
} from "./shantiesTypes";
import {
  getAttackKind,
  getCardEffect,
  isAttackCard,
  isDefendCard,
  targetsSelfAutomatically,
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

function rollWeaponDamage(
  equipped: EquippedGear,
  kind: "melee" | "ranged",
  mode: "normal" | "lucky" | "strong",
): number {
  const { min, max } = getEquippedWeaponStats(equipped, kind);
  if (mode === "lucky") {
    return Math.max(rollUniform(min, max), rollUniform(min, max));
  }
  if (mode === "strong") {
    return rollUniform(min, max) + rollUniform(min, max);
  }
  return rollUniform(min, max);
}

function rollArmorValue(
  equipped: EquippedGear,
  mode: "normal" | "lucky" | "strong",
): number {
  const { min, max } = getEquippedArmorStats(equipped);
  if (mode === "lucky") {
    return Math.max(rollUniform(min, max), rollUniform(min, max));
  }
  if (mode === "strong") {
    return rollUniform(min, max) + rollUniform(min, max);
  }
  return rollUniform(min, max);
}

export function rollAttackDamage(
  equipped: EquippedGear,
  card: CombatCard,
): number {
  const kind = getAttackKind(card);
  const effect = getCardEffect(card);
  if (
    effect === "lucky_melee" ||
    effect === "lucky_ranged"
  ) {
    return rollWeaponDamage(equipped, kind, "lucky");
  }
  if (
    effect === "strong_melee" ||
    effect === "strong_ranged"
  ) {
    return rollWeaponDamage(equipped, kind, "strong");
  }
  return rollWeaponDamage(equipped, kind, "normal");
}

export function rollDefendArmor(
  equipped: EquippedGear,
  card?: CombatCard,
): number {
  if (!card) {
    return rollArmorValue(equipped, "normal");
  }
  const effect = getCardEffect(card);
  if (effect === "lucky_armor") {
    return rollArmorValue(equipped, "lucky");
  }
  if (effect === "strong_armor") {
    return rollArmorValue(equipped, "strong");
  }
  return rollArmorValue(equipped, "normal");
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

export function formatLuckyRollRangeText(
  min: number,
  max: number,
  noun: string,
): string {
  return `Better of two rolls: ${min} - ${max} ${noun}`;
}

export function formatStrongRollRangeText(
  min: number,
  max: number,
  noun: string,
): string {
  return `2 rolls of ${min} - ${max} ${noun}`;
}

export function getAttackEffectRangeText(
  equipped: EquippedGear,
  card: CombatCard,
): string {
  const kind = getAttackKind(card);
  const effect = getCardEffect(card);
  const { min, max } = getEquippedWeaponStats(equipped, kind);

  if (effect === "melee_all_enemies") {
    return `Melee vs each foe · ${min}–${max} each`;
  }
  if (effect === "ranged_all_enemies") {
    return `Ranged vs each foe · ${min}–${max} each`;
  }
  if (effect === "steal") {
    return `${min}–${max} damage · steal Ld4 gold if hit`;
  }

  let mode: "normal" | "lucky" | "strong" = "normal";
  if (effect === "lucky_melee" || effect === "lucky_ranged") mode = "lucky";
  if (effect === "strong_melee" || effect === "strong_ranged") mode = "strong";

  if (mode === "lucky") {
    return formatLuckyRollRangeText(min, max, "damage");
  }
  if (mode === "strong") {
    return formatStrongRollRangeText(min, max, "damage");
  }

  return `${min}–${max} damage`;
}

export function getDefendEffectRangeText(
  equipped: EquippedGear,
  card?: CombatCard,
): string {
  const { min, max } = getEquippedArmorStats(equipped);
  if (card && getCardEffect(card) === "swish") {
    return `Gain ${min}–${max} armor · Evasive`;
  }
  if (card) {
    const effect = getCardEffect(card);
    if (effect === "lucky_armor") {
      return formatLuckyRollRangeText(min, max, "armor");
    }
    if (effect === "strong_armor") {
      return formatStrongRollRangeText(min, max, "armor");
    }
  }
  return `Gain ${min}–${max} armor`;
}

export type CardEffectDetail = {
  basisLabel: string;
  equipmentId: EquipmentId | null;
  effectText: string;
};

function getEquippedItemId(
  equipped: EquippedGear,
  slot: "melee" | "ranged" | "armor",
): EquipmentId | null {
  return equipped[slot];
}

/** Detail view: which equipped item drives this card's effect, plus the rolled range text. */
export function getCardEffectDetail(
  card: CombatCard,
  equipped: EquippedGear,
): CardEffectDetail | null {
  if (isAttackCard(card)) {
    const kind = getAttackKind(card);
    return {
      basisLabel:
        kind === "melee"
          ? "Based on yer equipped melee weapon"
          : "Based on yer equipped ranged weapon",
      equipmentId: getEquippedItemId(equipped, kind),
      effectText: getAttackEffectRangeText(equipped, card),
    };
  }
  if (isDefendCard(card) || targetsSelfAutomatically(card)) {
    return {
      basisLabel: "Based on yer equipped armor",
      equipmentId: getEquippedItemId(equipped, "armor"),
      effectText: getDefendEffectRangeText(equipped, card),
    };
  }
  return null;
}

export function isEnemyEvasive(enemy: EnemyType): boolean {
  return countEvasiveStacks(enemy) > 0;
}

export function rollMeleeMiss(enemy: EnemyType): boolean {
  const stacks = countEvasiveStacks(enemy);
  if (stacks <= 0) return false;
  return Math.random() < evasiveMissChanceForStacks(stacks);
}

export function rollHeroEvasiveMiss(heroEvasiveStacks: number): boolean {
  if (heroEvasiveStacks <= 0) return false;
  return Math.random() < evasiveMissChanceForStacks(heroEvasiveStacks);
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

export function getCardDisplayName(card: CombatCard): string {
  return getCardDefinition(card.id).name;
}

export function getCardClassBorderColor(card: CombatCard): string {
  return getCardDefinition(card.id).cardClass;
}
