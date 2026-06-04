/**
 * Denizen doubling tier multipliers (non-ripple): M[0]=10, M[1]=50, M[n]=10×M[n−1].
 * Ripple late tiers use a frozen legacy denizen ramp for step ratios only — not repriced
 * when non-ripple denizen rules change.
 */

const NICE_MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 5, 6, 7.5, 10] as const;

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

/** Build M[0..length−1]: 10, 50, then ×10 per tier (non-ripple doubling chains). */
export function buildDenizenDoublingTierMults(length = 15): number[] {
  const mults: number[] = [DENIZEN_DOUBLING_FIRST_MULT, DENIZEN_DOUBLING_SECOND_MULT];
  while (mults.length < length) {
    mults.push(mults[mults.length - 1]! * 10);
  }
  return mults;
}

export const DENIZEN_EVOLUTION_TIER_MULT: readonly number[] =
  buildDenizenDoublingTierMults(15);

/** Legacy denizen ramp (pre–non-ripple repricing) — ripple late tiers only. */
const LEGACY_DENIZEN_MULT_LOCKED = [
  10,
  50,
  500,
  50_000,
  5_000_000,
] as const;

const LEGACY_TRANSCENDENCE_TIER_15_PRICE = 25e66;
const LEGACY_TRANSCENDENCE_BASE_COST = 540_000_000_000_000_000_000_000_000;
const LEGACY_DENIZEN_MULT_END =
  LEGACY_TRANSCENDENCE_TIER_15_PRICE / LEGACY_TRANSCENDENCE_BASE_COST;

function snapToNiceValue(ideal: number, minValue: number): number {
  if (ideal < 1000) {
    return Math.max(minValue, Math.round(ideal));
  }
  const exp = Math.floor(Math.log10(ideal));
  const scale = 10 ** exp;
  const mantissa = ideal / scale;
  let best: number = NICE_MANTISSAS[0];
  let bestErr = Infinity;
  for (const m of NICE_MANTISSAS) {
    const err = Math.abs(Math.log(mantissa) - Math.log(m));
    if (err < bestErr) {
      bestErr = err;
      best = m;
    }
  }
  return Math.max(minValue, Math.round(best * scale));
}

/** Geometric ramp from M[4] to pinned M[14] — used only for ripple step ratios. */
function buildLegacyDenizenLateMultsForRipple(): number[] {
  const start = LEGACY_DENIZEN_MULT_LOCKED[4]!;
  const end = LEGACY_DENIZEN_MULT_END;
  const steps = 10;
  const ratio = (end / start) ** (1 / steps);
  const late: number[] = [];
  for (let i = 5; i <= 13; i++) {
    const ideal = start * ratio ** (i - 4);
    late.push(snapToNiceValue(ideal, (late[late.length - 1] ?? start) + 1));
  }
  late.push(end);
  return late;
}

const LEGACY_DENIZEN_MULT_FOR_RIPPLE: readonly number[] = [
  ...LEGACY_DENIZEN_MULT_LOCKED,
  ...buildLegacyDenizenLateMultsForRipple(),
];

/** Ripple late mults: step ratios from legacy denizen ramp, not current denizen mults. */
function buildRippleLateMults(denizenMults: readonly number[]): number[] {
  const r4 = RIPPLE_EARLY_PRICE_ANCHORS[4]! / RIPPLE_BASE_COST;
  const late: number[] = [];
  for (let i = 5; i < 14; i++) {
    const stepMult = denizenMults[i]! / denizenMults[i - 1]!;
    late.push(
      snapToNiceValue(
        (late[late.length - 1] ?? r4) * stepMult,
        (late[late.length - 1] ?? r4) + 1,
      ),
    );
  }
  const lastStep = denizenMults[14]! / denizenMults[13]!;
  late.push(
    snapToNiceValue(
      late[late.length - 1]! * lastStep,
      late[late.length - 1]! + 1,
    ),
  );
  return late;
}

const _rippleEarlyMult = RIPPLE_EARLY_PRICE_ANCHORS.map(
  (p) => p / RIPPLE_BASE_COST,
);
const _rippleLate = buildRippleLateMults(LEGACY_DENIZEN_MULT_FOR_RIPPLE);

export const RIPPLE_EVOLUTION_TIER_MULT: readonly number[] = [
  ..._rippleEarlyMult,
  ..._rippleLate,
] as const;

/** @deprecated Use RIPPLE_EARLY_PRICE_ANCHORS */
export const RIPPLE_PRICE_ANCHORS: readonly number[] = [
  ...RIPPLE_EARLY_PRICE_ANCHORS,
  ..._rippleLate.map((m) => Math.round(RIPPLE_BASE_COST * m)),
] as const;
