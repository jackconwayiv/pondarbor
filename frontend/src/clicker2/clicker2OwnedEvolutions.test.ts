import { describe, expect, it } from "vitest";

import {
  compareOwnedEvolutionStatsTieBreak,
  listOwnedEvolutionDefs,
} from "./clicker2OwnedEvolutions";
import { SPECIALTIES } from "./specialties";

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
    const cheap = SPECIALTIES.reduce((min, s) => (s.price < min.price ? s : min));
    const expensive = SPECIALTIES.reduce((max, s) =>
      s.price > max.price ? s : max,
    );
    const owned = { [cheap.id]: true, [expensive.id]: true };
    const acquired = { [cheap.id]: 200, [expensive.id]: 100 };
    const sorted = listOwnedEvolutionDefs(owned, acquired).map((d) => d.id);
    expect(sorted[0]).toBe(cheap.id);
  });
});
