import { describe, expect, it } from "vitest";

import { createInitialHero } from "./shantiesLocalSave";
import { createStarterEquipped } from "./shantiesEquipment";
import type { CardId } from "./squallsCardCatalog";
import {
  applyLevelUpCardPick,
  getLevelUpCardPool,
  isCardAtCopyCap,
  rollLevelUpCardChoices,
} from "./squallsCardCatalog";
import type { HeroType } from "./shantiesTypes";

function heroWithExtraCopies(cardId: CardId, extra: number): HeroType {
  const base = createInitialHero();
  const copies = Array.from({ length: extra }, () => cardId);
  return {
    ...base,
    cardCollection: [...base.cardCollection, ...copies],
    deck: [...base.deck, ...copies],
  };
}

describe("applyLevelUpCardPick", () => {
  it("drops an uncommon from later offers after reaching copy cap", () => {
    const hero = heroWithExtraCopies("blade_dance", 2);
    expect(isCardAtCopyCap(hero.cardCollection, "blade_dance")).toBe(false);

    const result = applyLevelUpCardPick(hero, "blade_dance", 1);
    expect(result.picked).toBe(true);
    expect(isCardAtCopyCap(result.hero.cardCollection, "blade_dance")).toBe(true);
    expect(getLevelUpCardPool(result.hero)).not.toContain("blade_dance");
    expect(result.nextChoices).not.toContain("blade_dance");
  });

  it("rejects picks that are no longer legal", () => {
    const hero: HeroType = {
      ...heroWithExtraCopies("steal", 3),
      equipped: { ...createStarterEquipped(), relic: "lockpick" },
    };
    const result = applyLevelUpCardPick(hero, "steal", 1);
    expect(result.picked).toBe(false);
    expect(result.hero).toBe(hero);
    expect(rollLevelUpCardChoices(hero)).not.toContain("steal");
  });
});
