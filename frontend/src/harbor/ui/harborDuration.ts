/**
 * Duration display shared with voyaging ships on the berth board (hourglasses only).
 */

/** One hourglass per calendar day remaining (matches BerthBoard voyaging chips). */
export function hourglassLine(days: number): string {
  const d = Math.max(1, Math.floor(days));
  return "⏳".repeat(d);
}

/** Accessible label for construction ticks (no emoji-only screen readers). */
export function constructionRemainingLabel(days: number): string {
  const d = Math.max(1, Math.floor(days));
  return d === 1 ? "1 day remaining" : `${d} days remaining`;
}
