/** Sell price is half the buy price, rounded down. */
export function sellPriceFromBuyPrice(buyPrice: number): number {
  return Math.floor(buyPrice * 0.5);
}
