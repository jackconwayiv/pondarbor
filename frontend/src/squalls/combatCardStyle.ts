import { isAttackCard, isDefendCard } from "./shantiesTypes";
import type { CardTag, CombatCard } from "./shantiesTypes";

export const ATTACK_CARD_TAGS: readonly [CardTag, CardTag] = [
  "physical",
  "attack",
];
export const DEFEND_CARD_TAGS: readonly [CardTag, CardTag] = [
  "physical",
  "defense",
];

export function getCardTags(card: CombatCard): readonly CardTag[] {
  if ("tags" in card && card.tags.length > 0) return card.tags;
  if (isAttackCard(card)) return ATTACK_CARD_TAGS;
  if (isDefendCard(card)) return DEFEND_CARD_TAGS;
  return [];
}

/** Defend: light gray; attacks: slightly darker gray. */
export function getCardBackground(card: CombatCard): string {
  if (isDefendCard(card)) return "gray.100";
  if (isAttackCard(card)) return "gray.200";
  return "white";
}
