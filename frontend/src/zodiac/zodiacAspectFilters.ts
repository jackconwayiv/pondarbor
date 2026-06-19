import type { NatalChartPayload } from "./chartTypes";
import {
  INTERPRETABLE_ASPECT_TYPES,
  type AspectTypeKey,
} from "./zodiacAspectCopy";
import { aspectWithinInterpretOrb } from "./zodiacAspectStrength";
import { ZODIAC_ASPECT_ANCHOR_BODIES } from "./zodiacDisplayConfig";

export type ChartAspectRow = NatalChartPayload["aspects"][number];

export function sortAspectsByOrb<T extends ChartAspectRow>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const byOrb = a.orb_deg - b.orb_deg;
    if (byOrb !== 0) return byOrb;
    const ka = `${a.body_a}\0${a.type}\0${a.body_b}`;
    const kb = `${b.body_a}\0${b.type}\0${b.body_b}`;
    return ka.localeCompare(kb);
  });
}

/** Pager tile id → aspect row body key. */
export function aspectBodyKeyFromPlacementTile(tileId: string): string {
  if (tileId === "rising") return "ascendant";
  return tileId;
}

/** Aspect row body key → pager placement tile id. */
export function placementTileIdFromAspectBody(body: string): string {
  if (body === "ascendant") return "rising";
  return body;
}

export function filterAspectsForInterpret(
  aspects: readonly ChartAspectRow[],
  options: {
    birthTimeUnknown: boolean;
    types?: readonly AspectTypeKey[];
  },
): ChartAspectRow[] {
  const allowed = new Set(options.types ?? INTERPRETABLE_ASPECT_TYPES);
  let raw = aspects.filter((a) => allowed.has(a.type as AspectTypeKey));
  if (options.birthTimeUnknown) {
    const isAngle = (b: string) => b === "ascendant" || b === "midheaven";
    raw = raw.filter((a) => !isAngle(a.body_a) && !isAngle(a.body_b));
  }
  raw = raw.filter(
    (a) => ZODIAC_ASPECT_ANCHOR_BODIES.has(a.body_a) || ZODIAC_ASPECT_ANCHOR_BODIES.has(a.body_b),
  );
  raw = raw.filter((a) => aspectWithinInterpretOrb(a));
  return sortAspectsByOrb(raw);
}

/** @deprecated Use `filterAspectsForInterpret`. */
export function filterSextilesForInterpret(
  aspects: readonly ChartAspectRow[],
  options: { birthTimeUnknown: boolean },
): ChartAspectRow[] {
  return filterAspectsForInterpret(aspects, {
    ...options,
    types: ["sextile"],
  });
}

export function aspectsForPlacementTile(
  tileId: string,
  chart: NatalChartPayload,
  options: { birthTimeUnknown: boolean },
): ChartAspectRow[] {
  const bodyKey = aspectBodyKeyFromPlacementTile(tileId);
  return filterAspectsForInterpret(chart.aspects, options).filter(
    (a) => a.body_a === bodyKey || a.body_b === bodyKey,
  );
}
