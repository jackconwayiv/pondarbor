import { describe, expect, it } from "vitest";

import { STRATIFIED_POND_SPECIALTY_ID } from "./fossilShop";
import {
  compareOwnedEvolutionStatsTieBreak,
  listOwnedEvolutionDefs,
  listOwnedFossilShopDefs,
} from "./clicker2OwnedEvolutions";
import { getSpecialtyDef, SPECIALTIES } from "./specialties";

describe("listOwnedEvolutionDefs", () => {
  it("uses price/id order when acquisition timestamps tie", () => {
    const owned = Object.fromEntries(
      SPECIALTIES.slice(0, 5).map((s) => [s.id, true]),
    );
    const sameMs = Object.fromEntries(
      SPECIALTIES.slice(0, 5).map((s) => [s.id, 100]),
    );
    const sorted = listOwnedEvolutionDefs(owned, sameMs).map((d) => d.id);
    const byPrice = SPECIALTIES.filter((s) => owned[s.id])
      .sort(compareOwnedEvolutionStatsTieBreak)
      .map((d) => d.id);
    expect(sorted).toEqual(byPrice);
  });

  it("sorts newer acquisitions before older regardless of price", () => {
    const energyShop = SPECIALTIES.filter((s) => !s.fossilShopOnly);
    const cheap = energyShop.reduce((min, s) => (s.price < min.price ? s : min));
    const expensive = energyShop.reduce((max, s) =>
      s.price > max.price ? s : max,
    );
    const owned = { [cheap.id]: true, [expensive.id]: true };
    const acquired = { [cheap.id]: 200, [expensive.id]: 100 };
    const sorted = listOwnedEvolutionDefs(owned, acquired).map((d) => d.id);
    expect(sorted[0]).toBe(cheap.id);
  });

  it("excludes fossil-shop permanents from evolution stats", () => {
    const owned = { [STRATIFIED_POND_SPECIALTY_ID]: true, 100: true };
    const evolutionIds = listOwnedEvolutionDefs(owned).map((d) => d.id);
    expect(evolutionIds).toEqual([100]);
    expect(getSpecialtyDef(STRATIFIED_POND_SPECIALTY_ID)?.fossilShopOnly).toBe(
      true,
    );
  });

  it("lists only fossil-shop permanents for fossil shop stats", () => {
    const owned = { [STRATIFIED_POND_SPECIALTY_ID]: true, 100: true };
    const fossilIds = listOwnedFossilShopDefs(owned).map((d) => d.id);
    expect(fossilIds).toEqual([STRATIFIED_POND_SPECIALTY_ID]);
  });
});
