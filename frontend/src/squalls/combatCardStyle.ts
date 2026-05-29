import { getCardDisplayTags } from "./combatEquipment";
import { isAttackCard, isDefendCard } from "./shantiesTypes";
import type { CombatCard, CombatTag, EquippedGear } from "./shantiesTypes";

/** @deprecated Tags are computed from equipment at display time. */
export const ATTACK_CARD_TAGS: readonly [CombatTag, CombatTag] = [
  "physical",
  "attack",
];
/** @deprecated Tags are computed from equipment at display time. */
export const DEFEND_CARD_TAGS: readonly [CombatTag, CombatTag] = [
  "physical",
  "defense",
];

export function getCardTags(
  card: CombatCard,
  equipped?: EquippedGear,
): readonly CombatTag[] {
  if (equipped) {
    return getCardDisplayTags(card, equipped);
  }
  if (isAttackCard(card)) return ["attack"];
  if (isDefendCard(card)) return ["defense"];
  return [];
}

/** Defend: light gray; attacks: slightly darker gray. */
export function getCardBackground(card: CombatCard): string {
  if (isDefendCard(card)) return "gray.100";
  if (isAttackCard(card)) return "gray.200";
  return "white";
}
