import { minDeckSize } from "./combatDeck";
import {
  CARD_CATALOG,
  getAllowedCardClasses,
  RARITY_COPY_LIMITS,
  type CardId,
} from "./squallsCardCatalog";
import type { HeroType } from "./shantiesTypes";

export type DeckValidationResult = {
  valid: boolean;
  errors: string[];
};

export function validateDeck(hero: HeroType): DeckValidationResult {
  const errors: string[] = [];
  const minimum = minDeckSize(hero.level);
  const allowed = getAllowedCardClasses(hero.equipped);
  const owned = new Map<CardId, number>();
  for (const cardId of hero.cardCollection) {
    owned.set(cardId, (owned.get(cardId) ?? 0) + 1);
  }
  const counts = new Map<CardId, number>();

  if (hero.deck.length < minimum) {
    errors.push(
      `Deck has ${hero.deck.length} cards; need at least ${minimum} for level ${hero.level}.`,
    );
  }

  for (const cardId of hero.deck) {
    const def = CARD_CATALOG[cardId];
    if (!def) {
      errors.push(`Unknown card in deck: ${cardId}.`);
      continue;
    }
    const ownedCount = owned.get(cardId) ?? 0;
    const inDeck = counts.get(cardId) ?? 0;
    if (inDeck + 1 > ownedCount) {
      errors.push(`${def.name}: more copies in deck than owned.`);
    }
    if (!allowed.has(def.cardClass)) {
      errors.push(
        `${def.name} (${def.cardClass}) is not allowed by yer current loadout.`,
      );
    }
    counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
  }

  for (const [cardId, count] of counts) {
    const def = CARD_CATALOG[cardId];
    const cap = RARITY_COPY_LIMITS[def.rarity];
    if (count > cap) {
      errors.push(
        `${def.name}: ${count} copies (max ${cap} for ${def.rarity}).`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isDeckValid(hero: HeroType): boolean {
  return validateDeck(hero).valid;
}
