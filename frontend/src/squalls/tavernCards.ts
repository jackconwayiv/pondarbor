import { minDeckSize } from "./combatDeck";
import {
  CARD_CATALOG,
  countDeckCopies,
  createCombatCard,
  getLevelUpCardPool,
  isCardAtCopyCap,
  rollLevelUpCardChoices,
  unlockCardForHero,
  applyLevelUpCardPick,
  type CardId,
} from "./squallsCardCatalog";
import { shopBuyPrice } from "./shantiesShop";
import type { CombatCard, HeroType } from "./shantiesTypes";

export {
  rollLevelUpCardChoices,
  getLevelUpCardPool,
  unlockCardForHero,
  applyLevelUpCardPick,
};

export type TavernCardOffer = {
  id: CardId;
  label: string;
  basePrice: number;
};

const TAVERN_BASE_PRICES: Record<CardId, number> = {
  melee_attack: 12,
  lucky_attack: 18,
  strong_attack: 25,
  quick_attack: 18,
  ranged_shot: 12,
  lucky_shot: 18,
  strong_shot: 25,
  cheap_shot: 18,
  defend: 10,
  hunker_down: 25,
  lucky_break: 18,
  dodge: 18,
  blade_dance: 30,
  bullet_rain: 30,
  swish: 28,
  steal: 28,
};

export const TAVERN_REFINE_COST = 15;

export function getTavernCardOffers(hero: HeroType): TavernCardOffer[] {
  const pool = getLevelUpCardPool(hero);
  return pool.map((id) => ({
    id,
    label: CARD_CATALOG[id].name,
    basePrice: TAVERN_BASE_PRICES[id] ?? 15,
  }));
}

export function getTavernBuyPrice(hero: HeroType, cardId: CardId): number {
  const owned = countDeckCopies(hero.deck, cardId);
  const basePrice = TAVERN_BASE_PRICES[cardId] ?? 15;
  return shopBuyPrice(basePrice, hero.level, owned);
}

export type TavernBuyCheck =
  | { ok: true; price: number }
  | { ok: false; message: string };

export function checkBuyTavernCard(
  hero: HeroType,
  offerId: string,
): TavernBuyCheck {
  if (!(offerId in CARD_CATALOG)) {
    return { ok: false, message: "Unknown card." };
  }
  const cardId = offerId as CardId;
  if (!getLevelUpCardPool(hero).includes(cardId)) {
    return { ok: false, message: "That card isn't available for yer loadout." };
  }
  if (isCardAtCopyCap(hero.cardCollection, cardId)) {
    return { ok: false, message: "Yer deck already has the max copies." };
  }
  const price = getTavernBuyPrice(hero, cardId);
  if (hero.gold < price) {
    return { ok: false, message: "Not enough gold." };
  }
  return { ok: true, price };
}

export type TavernRefineCheck =
  | { ok: true }
  | { ok: false; message: string };

export function checkRefineTavernCard(
  hero: HeroType,
  deckIndex: number,
): TavernRefineCheck {
  if (deckIndex < 0 || deckIndex >= hero.deck.length) {
    return { ok: false, message: "Pick a card from yer deck." };
  }
  if (hero.gold < TAVERN_REFINE_COST) {
    return { ok: false, message: "Not enough gold." };
  }
  if (hero.deck.length <= minDeckSize(hero.level)) {
    return { ok: false, message: "Yer deck is already at the minimum for yer level." };
  }
  return { ok: true };
}

export function applyBuyTavernCard(
  hero: HeroType,
  offerId: string,
  price: number,
): HeroType {
  if (!(offerId in CARD_CATALOG)) return hero;
  const cardId = offerId as CardId;
  return {
    ...hero,
    gold: hero.gold - price,
    cardCollection: [...hero.cardCollection, cardId],
    deck: [...hero.deck, cardId],
  };
}

export function applyRefineTavernCard(
  hero: HeroType,
  deckIndex: number,
): HeroType {
  return {
    ...hero,
    gold: hero.gold - TAVERN_REFINE_COST,
    deck: hero.deck.filter((_, index) => index !== deckIndex),
  };
}

export function levelUpChoicesAsCombatCards(choices: CardId[]): CombatCard[] {
  return choices.map((id) => createCombatCard(id));
}

export function cardIdAtDeckIndex(hero: HeroType, deckIndex: number): CardId | null {
  return hero.deck[deckIndex] ?? null;
}
