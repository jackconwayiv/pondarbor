/** Max simultaneous click feedback nodes on the pond stage. */
export const MAX_POND_CLICK_POPS = 8;
export const MAX_POND_RIPPLES = 6;
/** Lighter cap during rain / other high-rate click bursts. */
export const MAX_POND_CLICK_POPS_LIGHT = 3;

export function capClickFxList<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  return items.slice(items.length - max);
}
