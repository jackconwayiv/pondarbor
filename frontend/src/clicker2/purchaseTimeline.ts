import { DENIZENS, getOwnedDenizenCount } from "./denizens";

/** Max emojis stored (newest kept); avoids huge saves at max ownership. */
export const DENIZEN_PURCHASE_TIMELINE_CAP = 2_000;

export function normalizeDenizenPurchaseTimeline(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || item.length === 0) continue;
    out.push(item);
    if (out.length >= DENIZEN_PURCHASE_TIMELINE_CAP) break;
  }
  return out;
}

/** Newest purchase first (prepended). */
export function prependDenizenPurchase(
  timeline: readonly string[],
  emoji: string,
): string[] {
  if (!emoji) return [...timeline];
  const next = [emoji, ...timeline];
  if (next.length <= DENIZEN_PURCHASE_TIMELINE_CAP) return next;
  return next.slice(0, DENIZEN_PURCHASE_TIMELINE_CAP);
}

/**
 * One-time fill for saves that predate the timeline field.
 * Order is approximate (catalog order, newest types toward the front).
 */
export function bootstrapDenizenPurchaseTimeline(
  ownedDenizens: Record<string, number>,
): string[] {
  const chronological: string[] = [];
  for (const def of DENIZENS) {
    const n = getOwnedDenizenCount(ownedDenizens, def.id);
    for (let i = 0; i < n; i++) chronological.push(def.emoji);
  }
  chronological.reverse();
  if (chronological.length <= DENIZEN_PURCHASE_TIMELINE_CAP) {
    return chronological;
  }
  return chronological.slice(0, DENIZEN_PURCHASE_TIMELINE_CAP);
}

export function resolveDenizenPurchaseTimeline(
  raw: unknown,
  ownedDenizens: Record<string, number>,
): string[] {
  const timeline = normalizeDenizenPurchaseTimeline(raw);
  if (timeline.length > 0) return timeline;
  if (totalOwnedForTimeline(ownedDenizens) <= 0) return [];
  return bootstrapDenizenPurchaseTimeline(ownedDenizens);
}

function totalOwnedForTimeline(owned: Record<string, number>): number {
  let n = 0;
  for (const def of DENIZENS) {
    n += getOwnedDenizenCount(owned, def.id);
  }
  return n;
}
