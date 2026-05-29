import type { AttackCard, CombatCard, DefendCard } from "./shantiesTypes";
import { DEFEND_TARGETING } from "./shantiesTypes";

const meleeAttackCard: AttackCard = {
  name: "Melee Attack",
  attackKind: "melee",
  strong: false,
};

const rangedAttackCard: AttackCard = {
  name: "Ranged Attack",
  attackKind: "ranged",
  strong: false,
};

const strongMeleeAttackCard: AttackCard = {
  name: "Strong Melee Attack",
  attackKind: "melee",
  strong: true,
};

const strongRangedAttackCard: AttackCard = {
  name: "Strong Ranged Attack",
  attackKind: "ranged",
  strong: true,
};

const defendCard: DefendCard = {
  name: "Defend",
  targeting: DEFEND_TARGETING,
};

/** 7 Melee, 7 Ranged, 1 Strong Melee, 1 Strong Ranged, 4 Defend. */
export function createStarterDeck(): CombatCard[] {
  return [
    ...Array.from({ length: 7 }, () => ({ ...meleeAttackCard })),
    ...Array.from({ length: 7 }, () => ({ ...rangedAttackCard })),
    { ...strongMeleeAttackCard },
    { ...strongRangedAttackCard },
    ...Array.from({ length: 4 }, () => ({ ...defendCard, targeting: { ...DEFEND_TARGETING } })),
  ];
}

export function cloneCombatCard(card: CombatCard): CombatCard {
  if (card.name === "Defend") {
    return {
      name: "Defend",
      targeting: { ...card.targeting },
    };
  }
  return { ...card };
}

export function cloneCombatDeck(cards: CombatCard[]): CombatCard[] {
  return cards.map(cloneCombatCard);
}
