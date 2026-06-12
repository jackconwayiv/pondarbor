import type { HallOfFameRow } from "./types";

function trophySortKey(
  row: HallOfFameRow,
  viewerId: number,
): [number, number, number, string] {
  const count = row.earner_count;
  const viewerHas = row.earners.some((e) => e.id === viewerId);
  let tier: number;
  if (count === 1 && viewerHas) {
    tier = 0;
  } else if (count === 1) {
    tier = 1;
  } else {
    tier = 2;
  }
  const countKey = tier < 2 ? 0 : count;
  return [tier, countKey, row.catalog_order, row.slug];
}

/** Rarity-first ordering (matches backend `achievement_trophy_case_payload`). */
export function sortHallOfFameRows(
  rows: HallOfFameRow[],
  viewerId: number,
): HallOfFameRow[] {
  return [...rows].sort((a, b) => {
    const ka = trophySortKey(a, viewerId);
    const kb = trophySortKey(b, viewerId);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    }
    return 0;
  });
}

export function hallOfFameCountLabel(
  row: HallOfFameRow,
  viewerId: number,
): string {
  if (row.earner_count === 1 && row.earners.some((e) => e.id === viewerId)) {
    return "Only you";
  }
  if (row.earner_count === 1) {
    return "1 person";
  }
  return `${row.earner_count} people`;
}
