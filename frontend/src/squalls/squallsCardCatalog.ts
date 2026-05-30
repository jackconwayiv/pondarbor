import type { EquippedGear, HeroType } from "./shantiesTypes";
import {
  EQUIPMENT_DEFINITIONS,
  EQUIPMENT_SLOTS,
} from "./shantiesEquipment";

export type CardClass =
  | "neutral"
  | "cutlass"
  | "pistol"
  | "light_armor"
  | "scoundrel";

export type CardRarity = "common" | "uncommon" | "rare" | "legendary";

export type CardEffectKind =
  | "melee_attack"
  | "lucky_melee"
  | "strong_melee"
  | "quick_melee"
  | "ranged_attack"
  | "lucky_ranged"
  | "strong_ranged"
  | "cheap_ranged"
  | "defend"
  | "lucky_armor"
  | "strong_armor"
  | "dodge"
  | "melee_all_enemies"
  | "ranged_all_enemies"
  | "swish"
  | "steal";

export type CardTargetingMode = "manual_enemy" | "all_enemies" | "self";

export type CardDefinition = {
  id: CardId;
  name: string;
  energy: number;
  rarity: CardRarity;
  cardClass: CardClass;
  effect: CardEffectKind;
  targeting: CardTargetingMode;
};

export const CARD_IDS = [
  "melee_attack",
  "lucky_attack",
  "strong_attack",
  "quick_attack",
  "ranged_shot",
  "lucky_shot",
  "strong_shot",
  "cheap_shot",
  "defend",
  "hunker_down",
  "lucky_break",
  "dodge",
  "blade_dance",
  "bullet_rain",
  "swish",
  "steal",
] as const;

export type CardId = (typeof CARD_IDS)[number];

export const CARD_CLASS_BORDER_COLORS: Record<CardClass, string> = {
  neutral: "#9CA3AF",
  cutlass: "#B91C1C",
  pistol: "#CA8A04",
  light_armor: "#38BDF8",
  scoundrel: "#A78BFA",
};

export const CARD_CLASS_LABELS: Record<CardClass, string> = {
  neutral: "Neutral",
  cutlass: "Cutlass",
  pistol: "Pistol",
  light_armor: "Light Armor",
  scoundrel: "Scoundrel",
};

/** Binder tab display order. */
export const CARD_CLASS_TAB_ORDER: readonly CardClass[] = [
  "neutral",
  "cutlass",
  "pistol",
  "light_armor",
  "scoundrel",
];

export const RARITY_COPY_LIMITS: Record<CardRarity, number> = {
  common: 4,
  uncommon: 3,
  rare: 2,
  legendary: 1,
};

/** Level-up / tavern offer weights (higher = more likely). */
export const RARITY_OFFER_WEIGHTS: Record<CardRarity, number> = {
  common: 4,
  uncommon: 2,
  rare: 1,
  legendary: 0,
};

export const CARD_CATALOG: Record<CardId, CardDefinition> = {
  melee_attack: {
    id: "melee_attack",
    name: "Melee Attack",
    energy: 1,
    rarity: "common",
    cardClass: "neutral",
    effect: "melee_attack",
    targeting: "manual_enemy",
  },
  lucky_attack: {
    id: "lucky_attack",
    name: "Lucky Attack",
    energy: 1,
    rarity: "uncommon",
    cardClass: "neutral",
    effect: "lucky_melee",
    targeting: "manual_enemy",
  },
  strong_attack: {
    id: "strong_attack",
    name: "Strong Attack",
    energy: 2,
    rarity: "common",
    cardClass: "neutral",
    effect: "strong_melee",
    targeting: "manual_enemy",
  },
  quick_attack: {
    id: "quick_attack",
    name: "Quick Attack",
    energy: 0,
    rarity: "uncommon",
    cardClass: "neutral",
    effect: "quick_melee",
    targeting: "manual_enemy",
  },
  ranged_shot: {
    id: "ranged_shot",
    name: "Ranged Shot",
    energy: 1,
    rarity: "common",
    cardClass: "neutral",
    effect: "ranged_attack",
    targeting: "manual_enemy",
  },
  lucky_shot: {
    id: "lucky_shot",
    name: "Lucky Shot",
    energy: 1,
    rarity: "uncommon",
    cardClass: "neutral",
    effect: "lucky_ranged",
    targeting: "manual_enemy",
  },
  strong_shot: {
    id: "strong_shot",
    name: "Strong Shot",
    energy: 2,
    rarity: "common",
    cardClass: "neutral",
    effect: "strong_ranged",
    targeting: "manual_enemy",
  },
  cheap_shot: {
    id: "cheap_shot",
    name: "Cheap Shot",
    energy: 0,
    rarity: "uncommon",
    cardClass: "neutral",
    effect: "cheap_ranged",
    targeting: "manual_enemy",
  },
  defend: {
    id: "defend",
    name: "Defend",
    energy: 1,
    rarity: "common",
    cardClass: "neutral",
    effect: "defend",
    targeting: "self",
  },
  hunker_down: {
    id: "hunker_down",
    name: "Hunker Down",
    energy: 2,
    rarity: "common",
    cardClass: "neutral",
    effect: "strong_armor",
    targeting: "self",
  },
  lucky_break: {
    id: "lucky_break",
    name: "Lucky Block",
    energy: 1,
    rarity: "uncommon",
    cardClass: "neutral",
    effect: "lucky_armor",
    targeting: "self",
  },
  dodge: {
    id: "dodge",
    name: "Dodge",
    energy: 0,
    rarity: "uncommon",
    cardClass: "neutral",
    effect: "dodge",
    targeting: "self",
  },
  blade_dance: {
    id: "blade_dance",
    name: "Blade Dance",
    energy: 2,
    rarity: "uncommon",
    cardClass: "cutlass",
    effect: "melee_all_enemies",
    targeting: "all_enemies",
  },
  bullet_rain: {
    id: "bullet_rain",
    name: "Bullet Rain",
    energy: 2,
    rarity: "uncommon",
    cardClass: "pistol",
    effect: "ranged_all_enemies",
    targeting: "all_enemies",
  },
  swish: {
    id: "swish",
    name: "Swish",
    energy: 1,
    rarity: "uncommon",
    cardClass: "light_armor",
    effect: "swish",
    targeting: "self",
  },
  steal: {
    id: "steal",
    name: "Steal",
    energy: 1,
    rarity: "uncommon",
    cardClass: "scoundrel",
    effect: "steal",
    targeting: "manual_enemy",
  },
};

/** New starter deck composition (20 cards at L1). */
export const STARTER_DECK_COMPOSITION: readonly { id: CardId; count: number }[] =
  [
    { id: "melee_attack", count: 4 },
    { id: "ranged_shot", count: 4 },
    { id: "defend", count: 4 },
    { id: "strong_attack", count: 2 },
    { id: "strong_shot", count: 2 },
    { id: "hunker_down", count: 1 },
    { id: "lucky_attack", count: 1 },
    { id: "lucky_shot", count: 1 },
    { id: "lucky_break", count: 1 },
  ];

const LEGACY_NAME_TO_CARD_ID: Record<string, CardId> = {
  "Melee Attack": "melee_attack",
  "Ranged Attack": "ranged_shot",
  "Strong Melee Attack": "strong_attack",
  "Strong Ranged Attack": "strong_shot",
  Defend: "defend",
};

export function isCardId(value: string): value is CardId {
  return value in CARD_CATALOG;
}

export function getCardDefinition(id: CardId): CardDefinition {
  return CARD_CATALOG[id];
}

export function getCardDefinitionOrNull(id: string): CardDefinition | null {
  return isCardId(id) ? CARD_CATALOG[id] : null;
}

export function cardIdFromLegacyName(name: string): CardId | null {
  return LEGACY_NAME_TO_CARD_ID[name] ?? null;
}

export function cardIdFromUnknown(raw: unknown): CardId | null {
  if (typeof raw === "string" && isCardId(raw)) return raw;
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (typeof record.id === "string" && isCardId(record.id)) {
      return record.id;
    }
    if (typeof record.name === "string") {
      return cardIdFromLegacyName(record.name);
    }
  }
  return null;
}

export function createCombatCard(id: CardId): { id: CardId } {
  return { id };
}

export function cloneCombatCard(card: { id: CardId }): { id: CardId } {
  return { id: card.id };
}

export function buildDeckFromComposition(
  composition: readonly { id: CardId; count: number }[],
): CardId[] {
  const deck: CardId[] = [];
  for (const row of composition) {
    for (let i = 0; i < row.count; i++) {
      deck.push(row.id);
    }
  }
  return deck;
}

export function countCardCopies(cards: readonly CardId[], cardId: CardId): number {
  return cards.filter((id) => id === cardId).length;
}

/** @deprecated Prefer countCardCopies — deck is also a card list. */
export const countDeckCopies = countCardCopies;

export function getCardClassesFromEquipped(equipped: EquippedGear): Set<CardClass> {
  const classes = new Set<CardClass>();
  for (const slot of EQUIPMENT_SLOTS) {
    const equipmentId = equipped[slot];
    if (!equipmentId) continue;
    const cardClass = EQUIPMENT_DEFINITIONS[equipmentId].cardClass;
    if (cardClass) classes.add(cardClass);
  }
  return classes;
}

export function getAllowedCardClasses(equipped: EquippedGear): Set<CardClass> {
  const classes = getCardClassesFromEquipped(equipped);
  classes.add("neutral");
  return classes;
}

export function isCardClassAllowed(
  cardClass: CardClass,
  equipped: EquippedGear,
): boolean {
  return getAllowedCardClasses(equipped).has(cardClass);
}

export function isCardAtCopyCap(cards: readonly CardId[], cardId: CardId): boolean {
  const def = CARD_CATALOG[cardId];
  return countCardCopies(cards, cardId) >= RARITY_COPY_LIMITS[def.rarity];
}

export function spareCollectionCopies(
  collection: readonly CardId[],
  deck: readonly CardId[],
  cardId: CardId,
): number {
  return Math.max(0, countCardCopies(collection, cardId) - countCardCopies(deck, cardId));
}

export function getLevelUpCardPool(hero: HeroType): CardId[] {
  const allowed = getAllowedCardClasses(hero.equipped);
  return CARD_IDS.filter((id) => {
    const def = CARD_CATALOG[id];
    if (!allowed.has(def.cardClass)) return false;
    if (RARITY_OFFER_WEIGHTS[def.rarity] <= 0) return false;
    return !isCardAtCopyCap(hero.cardCollection, id);
  });
}

export function rollLevelUpCardChoices(hero: HeroType, count = 3): CardId[] {
  const pool = getLevelUpCardPool(hero);
  if (pool.length === 0) return [];

  const weighted: CardId[] = [];
  for (const id of pool) {
    const weight = RARITY_OFFER_WEIGHTS[CARD_CATALOG[id].rarity];
    for (let i = 0; i < weight; i++) {
      weighted.push(id);
    }
  }

  const choices: CardId[] = [];
  const remaining = new Set(pool);

  while (choices.length < count && remaining.size > 0) {
    const candidates = weighted.filter((id) => remaining.has(id));
    if (candidates.length === 0) break;
    const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
    choices.push(pick);
    remaining.delete(pick);
  }

  return choices;
}

export type LevelUpPickResult = {
  hero: HeroType;
  nextChoices: CardId[];
  picksRemaining: number;
  picked: boolean;
  levelUpComplete: boolean;
};

/** Apply one level-up pick, then roll the next offers from the updated hero state. */
export function applyLevelUpCardPick(
  hero: HeroType,
  chosenId: CardId,
  picksRemaining: number,
): LevelUpPickResult {
  if (
    !isCardId(chosenId) ||
    !getLevelUpCardPool(hero).includes(chosenId) ||
    isCardAtCopyCap(hero.cardCollection, chosenId)
  ) {
    return {
      hero,
      nextChoices: rollLevelUpCardChoices(hero),
      picksRemaining,
      picked: false,
      levelUpComplete: false,
    };
  }

  const nextHero = unlockCardForHero(hero, chosenId);
  const remaining = Math.max(0, picksRemaining - 1);
  if (remaining > 0) {
    return {
      hero: nextHero,
      nextChoices: rollLevelUpCardChoices(nextHero),
      picksRemaining: remaining,
      picked: true,
      levelUpComplete: false,
    };
  }
  return {
    hero: nextHero,
    nextChoices: [],
    picksRemaining: 0,
    picked: true,
    levelUpComplete: true,
  };
}

export function unlockCardForHero(hero: HeroType, cardId: CardId): HeroType {
  return {
    ...hero,
    cardCollection: [...hero.cardCollection, cardId],
    deck: [...hero.deck, cardId],
  };
}

/** Unique card ids owned in this class (first-seen collection order). */
export function cardsOwnedInClass(
  collection: readonly CardId[],
  cardClass: CardClass,
): CardId[] {
  const seen = new Set<CardId>();
  const owned: CardId[] = [];
  for (const id of collection) {
    if (CARD_CATALOG[id].cardClass !== cardClass) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    owned.push(id);
  }
  return owned;
}
