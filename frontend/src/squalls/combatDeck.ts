import {
  buildDeckFromComposition,
  cloneCombatCard,
  createCombatCard,
  STARTER_DECK_COMPOSITION,
  type CardId,
} from "./squallsCardCatalog";
import type { CombatCard } from "./shantiesTypes";

export function minDeckSize(level: number): number {
  return 19 + Math.max(1, Math.floor(level));
}

/** 4 Melee Attack, 4 Ranged Shot, 4 Defend, 2 Strong Attack, 2 Strong Shot, 1 each Lucky/Hunker. */
export function createStarterDeck(): CardId[] {
  return buildDeckFromComposition(STARTER_DECK_COMPOSITION);
}

export function createStarterCardCollection(): CardId[] {
  return buildDeckFromComposition(STARTER_DECK_COMPOSITION);
}

export { cloneCombatCard, createCombatCard };

export function cloneCombatDeck(cards: readonly CardId[]): CardId[] {
  return cards.map((id) => id);
}

export function combatDeckAsCards(deck: readonly CardId[]): CombatCard[] {
  return deck.map((id) => createCombatCard(id));
}
