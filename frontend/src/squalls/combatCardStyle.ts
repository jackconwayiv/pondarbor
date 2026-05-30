import {
  CARD_CLASS_BORDER_COLORS,
  getCardDefinition,
} from "./squallsCardCatalog";
import { getCardDisplayTags } from "./combatEquipment";
import { isAttackCard, isDefendCard } from "./shantiesTypes";
import type { CombatCard, CombatTag, EquippedGear } from "./shantiesTypes";

/** @deprecated Tags are computed from equipment at display time. */
export const ATTACK_CARD_TAGS: readonly [CombatTag] = ["attack"];
/** @deprecated Tags are computed from equipment at display time. */
export const DEFEND_CARD_TAGS: readonly [CombatTag] = ["defense"];

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

export function getCardBorderColor(card: CombatCard): string {
  const cardClass = getCardDefinition(card.id).cardClass;
  return CARD_CLASS_BORDER_COLORS[cardClass];
}

/** @deprecated Inner card face is white; class color is the outer strip only. */
export function getCardBackground(_card: CombatCard): string {
  return "#FFFFFF";
}

export function getCardRarityLabel(card: CombatCard): string {
  return getCardDefinition(card.id).rarity;
}

/** Standard playing-card proportions (width : height). */
export const CARD_ASPECT_RATIO = "2.5/3.5";
/** Max width for a three-column card grid (≈3× preview width + gaps). */
export const CARD_GRID_3COL_MAX_WIDTH = "24rem";
