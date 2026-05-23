import { getOwnedDenizenCount, nextDenizenCost, type DenizenDef } from "./denizens";
import type { SpecialtyDef } from "./specialties";

/** Shop prices that can flip canAfford while spendable energy drifts. */
export function collectShopAffordThresholds(
  denizens: readonly DenizenDef[],
  specialties: readonly SpecialtyDef[],
  ownedDenizens: Record<string, number>,
): number[] {
  const thresholds = new Set<number>();
  for (const def of denizens) {
    const cost = nextDenizenCost(def, getOwnedDenizenCount(ownedDenizens, def.id));
    if (cost != null) thresholds.add(cost);
  }
  for (const s of specialties) {
    thresholds.add(s.price);
  }
  return [...thresholds].sort((a, b) => a - b);
}

export function spendableCrossedAffordBoundary(
  prevSpendable: number,
  nextSpendable: number,
  thresholds: readonly number[],
): boolean {
  for (const price of thresholds) {
    if (
      (prevSpendable < price && nextSpendable >= price) ||
      (prevSpendable >= price && nextSpendable < price)
    ) {
      return true;
    }
  }
  return false;
}
