/**
 * Evolution tier multipliers: denizen baseCost × M[tier] for non-ripple doubling chains.
 * M[0]=10, M[1]=5×M[0], M[n]=10×M[n−1] for n≥2. Ripple late tiers follow denizen step ratios.
 */

const RIPPLE_BASE_COST = 15;

export const RIPPLE_EARLY_PRICE_ANCHORS = [
  100,
  500,
  10_000,
  100_000,
  10_000_000,
] as const;

/** First doubling evolution: 10× denizen baseCost. */
export const DENIZEN_DOUBLING_FIRST_MULT = 10;

/** Second doubling evolution: 5× the first doubling price → 50× baseCost. */
export const DENIZEN_DOUBLING_SECOND_MULT = 50;

/** Build M[0..length−1]: 10, 50, then ×10 per tier. */
export function buildDenizenDoublingTierMults(length = 15): number[] {
  const mults: number[] = [DENIZEN_DOUBLING_FIRST_MULT, DENIZEN_DOUBLING_SECOND_MULT];
  while (mults.length < length) {
    mults.push(mults[mults.length - 1]! * 10);
  }
  return mults;
}

/** Ripple late mults: same step ratios as denizen ramp applied from R[4]. */
function buildRippleLateMults(denizenMults: readonly number[]): number[] {
  const r4 = RIPPLE_EARLY_PRICE_ANCHORS[4]! / RIPPLE_BASE_COST;
  const late: number[] = [];
  for (let i = 5; i < 14; i++) {
    const stepMult = denizenMults[i]! / denizenMults[i - 1]!;
    late.push((late[late.length - 1] ?? r4) * stepMult);
  }
  const lastStep = denizenMults[14]! / denizenMults[13]!;
  late.push(late[late.length - 1]! * lastStep);
  return late;
}

export const DENIZEN_EVOLUTION_TIER_MULT: readonly number[] =
  buildDenizenDoublingTierMults(15);

const _rippleEarlyMult = RIPPLE_EARLY_PRICE_ANCHORS.map(
  (p) => p / RIPPLE_BASE_COST,
);
const _rippleLate = buildRippleLateMults(DENIZEN_EVOLUTION_TIER_MULT);

export const RIPPLE_EVOLUTION_TIER_MULT: readonly number[] = [
  ..._rippleEarlyMult,
  ..._rippleLate,
] as const;

/** @deprecated Use RIPPLE_EARLY_PRICE_ANCHORS */
export const RIPPLE_PRICE_ANCHORS: readonly number[] = [
  ...RIPPLE_EARLY_PRICE_ANCHORS,
  ..._rippleLate.map((m) => Math.round(RIPPLE_BASE_COST * m)),
] as const;
