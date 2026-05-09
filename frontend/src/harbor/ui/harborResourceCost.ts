/**
 * Display resource costs as amounts + emoji (matches HUD / ship cards).
 */

const RESOURCE_EMOJI: Record<string, string> = {
  food: "🐟",
  timber: "🪵",
  stone: "🪨",
  metal: "⚙️",
  oil: "🛢️",
  rareMinerals: "💎",
  wealth: "🪙",
};

export function resourceEmoji(key: string): string {
  return RESOURCE_EMOJI[key] ?? "";
}

/** e.g. `10 🪵 · 4 🐟` or `free`. Separators match anchor/resource rows (middle dot). */
export function formatResourceCostLine(
  cost: Record<string, number | undefined>,
): string {
  const entries = Object.entries(cost).filter(
    ([, v]) => typeof v === "number" && v !== 0,
  );
  if (entries.length === 0) return "free";
  return entries
    .map(([k, v]) => {
      const sym = resourceEmoji(k);
      return sym ? `${v} ${sym}` : `${v} ${k}`;
    })
    .join(" · ");
}
