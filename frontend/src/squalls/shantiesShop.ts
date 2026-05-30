import type { ShopVariant } from "./shantiesTypes";

/** Sell price is half the base price, rounded down. */
export function sellPriceFromBasePrice(basePrice: number): number {
  return Math.floor(basePrice * 0.5);
}

/** Shop buy price: base + 5 per hero level + 5 per copy already owned. */
export function shopBuyPrice(
  basePrice: number,
  heroLevel: number,
  ownedCount: number,
): number {
  return basePrice + 5 * heroLevel + 5 * ownedCount;
}

/** Island traders and port marketplaces buy surplus; ship provisions are buy-only. */
export function shopAllowsSelling(shopVariant: ShopVariant | null): boolean {
  return shopVariant === "island_trader" || shopVariant === "port";
}
