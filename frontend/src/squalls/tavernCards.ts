import { cloneCombatCard } from "./combatDeck";
import { shopBuyPrice } from "./shantiesShop";
import type { AttackCardName, CombatCard, HeroType } from "./shantiesTypes";
import { DEFEND_TARGETING } from "./shantiesTypes";

export type TavernCardOfferId =
  | "melee"
  | "ranged"
  | "defend"
  | "strong_melee"
  | "strong_ranged";

export type TavernCardOffer = {
  id: TavernCardOfferId;
  label: string;
  basePrice: number;
  createCard: () => CombatCard;
};

const TAVERN_OFFERS: TavernCardOffer[] = [
  {
    id: "melee",
    label: "Melee Attack",
    basePrice: 12,
    createCard: () => ({
      name: "Melee Attack",
      attackKind: "melee",
      strong: false,
    }),
  },
  {
    id: "ranged",
    label: "Ranged Attack",
    basePrice: 12,
    createCard: () => ({
      name: "Ranged Attack",
      attackKind: "ranged",
      strong: false,
    }),
  },
  {
    id: "defend",
    label: "Defend",
    basePrice: 10,
    createCard: () => ({
      name: "Defend",
      targeting: { ...DEFEND_TARGETING },
    }),
  },
  {
    id: "strong_melee",
    label: "Strong Melee Attack",
    basePrice: 25,
    createCard: () => ({
      name: "Strong Melee Attack",
      attackKind: "melee",
      strong: true,
    }),
  },
  {
    id: "strong_ranged",
    label: "Strong Ranged Attack",
    basePrice: 25,
    createCard: () => ({
      name: "Strong Ranged Attack",
      attackKind: "ranged",
      strong: true,
    }),
  },
];

export const TAVERN_REFINE_COST = 15;

export function getTavernCardOffers(): readonly TavernCardOffer[] {
  return TAVERN_OFFERS;
}

export function getTavernCardOffer(
  offerId: string,
): TavernCardOffer | undefined {
  return TAVERN_OFFERS.find((offer) => offer.id === offerId);
}

export function countMatchingDeckCards(
  deck: CombatCard[],
  cardName: AttackCardName | "Defend",
): number {
  return deck.filter((card) => card.name === cardName).length;
}

export function getTavernBuyPrice(
  hero: HeroType,
  offer: TavernCardOffer,
): number {
  const owned = countMatchingDeckCards(hero.deck, offer.createCard().name);
  return shopBuyPrice(offer.basePrice, hero.level, owned);
}

export type TavernBuyCheck =
  | { ok: true; price: number }
  | { ok: false; message: string };

export function checkBuyTavernCard(
  hero: HeroType,
  offerId: string,
): TavernBuyCheck {
  const offer = getTavernCardOffer(offerId);
  if (!offer) return { ok: false, message: "Unknown card." };
  const price = getTavernBuyPrice(hero, offer);
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
  return { ok: true };
}

export function applyBuyTavernCard(
  hero: HeroType,
  offerId: string,
  price: number,
): HeroType {
  const offer = getTavernCardOffer(offerId);
  if (!offer) return hero;
  return {
    ...hero,
    gold: hero.gold - price,
    deck: [...hero.deck, cloneCombatCard(offer.createCard())],
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
