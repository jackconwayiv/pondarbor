import { describe, expect, it } from "vitest";

import { createStarterDeck, createStarterCardCollection, minDeckSize } from "./combatDeck";
import { isDeckValid, validateDeck } from "./deckValidation";
import { createInitialHero } from "./shantiesLocalSave";
import { createStarterEquipped } from "./shantiesEquipment";
import {
  CARD_CATALOG,
  applyLevelUpCardPick,
  getLevelUpCardPool,
  rollLevelUpCardChoices,
  cardsOwnedInClass,
} from "./squallsCardCatalog";
import { checkRefineTavernCard } from "./tavernCards";

describe("deck minimum rules", () => {
  it("uses 19 + level", () => {
    expect(minDeckSize(1)).toBe(20);
    expect(minDeckSize(2)).toBe(21);
    expect(minDeckSize(7)).toBe(26);
  });

  it("prevents refine at minimum size", () => {
    const hero = { ...createInitialHero(), gold: 999 };
    expect(checkRefineTavernCard(hero, 0)).toEqual({
      ok: false,
      message: "Yer deck is already at the minimum for yer level.",
    });
  });
});

describe("deck validation", () => {
  it("accepts starter hero deck", () => {
    const hero = createInitialHero();
    expect(isDeckValid(hero)).toBe(true);
  });

  it("rejects deck below minimum size", () => {
    const hero = createInitialHero();
    const result = validateDeck({ ...hero, deck: hero.deck.slice(0, 5) });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("need at least"))).toBe(true);
  });

  it("rejects class not allowed by loadout", () => {
    const hero = createInitialHero();
    const result = validateDeck({
      ...hero,
      deck: [...hero.deck, "steal"],
      cardCollection: [...hero.cardCollection, "steal"],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Steal"))).toBe(true);
  });
});

describe("starter collection", () => {
  it("matches starter deck copy counts", () => {
    const collection = createStarterCardCollection();
    const deck = createStarterDeck();
    expect(collection).toEqual(deck);
    expect(collection).toHaveLength(20);
  });

  it("starter hero owns only starter cards", () => {
    const hero = createInitialHero();
    expect(cardsOwnedInClass(hero.cardCollection, "cutlass")).not.toContain(
      "blade_dance",
    );
  });
});

describe("starter deck composition", () => {
  it("has 20 cards with expected counts", () => {
    const deck = createStarterDeck();
    expect(deck).toHaveLength(20);
    const counts = deck.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.melee_attack).toBe(4);
    expect(counts.ranged_shot).toBe(4);
    expect(counts.defend).toBe(4);
    expect(counts.strong_attack).toBe(2);
    expect(counts.strong_shot).toBe(2);
    expect(counts.hunker_down).toBe(1);
    expect(counts.lucky_attack).toBe(1);
    expect(counts.lucky_shot).toBe(1);
    expect(counts.lucky_break).toBe(1);
  });
});

describe("rollLevelUpCardChoices", () => {
  it("returns three cards by default", () => {
    const hero = createInitialHero();
    const cards = rollLevelUpCardChoices(hero);
    expect(cards).toHaveLength(3);
  });

  it("includes equipment-class cards allowed by starter loadout", () => {
    const hero = createInitialHero();
    const pool = getLevelUpCardPool(hero);
    expect(pool).toContain("blade_dance");
    expect(pool).toContain("bullet_rain");
    expect(pool).toContain("swish");
  });

  it("excludes scoundrel without lockpick equipped", () => {
    const hero = createInitialHero();
    const pool = getLevelUpCardPool(hero);
    expect(pool).not.toContain("steal");
  });

  it("includes scoundrel when lockpick equipped", () => {
    const hero = {
      ...createInitialHero(),
      equipped: { ...createStarterEquipped(), relic: "lockpick" as const },
    };
    const pool = getLevelUpCardPool(hero);
    expect(pool).toContain("steal");
  });

  it("excludes cards already at collection copy cap", () => {
    const hero = createInitialHero();
    const pool = getLevelUpCardPool(hero);
    expect(pool).not.toContain("melee_attack");
    expect(pool).not.toContain("ranged_shot");
    expect(pool).not.toContain("defend");
  });

  it("never rolls choices above copy cap", () => {
    const hero = createInitialHero();
    for (let i = 0; i < 20; i++) {
      const choices = rollLevelUpCardChoices(hero);
      for (const id of choices) {
        expect(getLevelUpCardPool(hero)).toContain(id);
      }
    }
  });

  it("returns distinct offers", () => {
    const hero = createInitialHero();
    const cards = rollLevelUpCardChoices(hero);
    expect(new Set(cards).size).toBe(3);
    for (const id of cards) {
      expect(CARD_CATALOG[id]).toBeDefined();
    }
  });

  it("re-rolls next choices from updated hero after a pick", () => {
    const hero = createInitialHero();
    const result = applyLevelUpCardPick(hero, "blade_dance", 2);
    expect(result.picked).toBe(true);
    expect(result.hero.cardCollection.filter((id) => id === "blade_dance")).toHaveLength(1);
    for (const id of result.nextChoices) {
      expect(getLevelUpCardPool(result.hero)).toContain(id);
    }
  });
});
