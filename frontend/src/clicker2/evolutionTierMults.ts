/**
 * Evolution tier multipliers: denizen baseCost × M[tier], ripple baseCost × R[tier].
 * Late tiers M[5..14] ramp geometrically to pin transcendence tier 15 at 25×10^66.
 */

const NICE_MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 5, 6, 7.5, 10] as const;

const DENIZEN_MULT_LOCKED = [
  10,
  50,
  500,
  50_000,
  5_000_000,
] as const;

/** transcendence.baseCost × M[14] = 25 unvigintillion */
export const TRANSCENDENCE_TIER_15_PRICE = 25e66;

const TRANSCENDENCE_BASE_COST = 540_000_000_000_000_000_000_000_000;
const DENIZEN_MULT_END = TRANSCENDENCE_TIER_15_PRICE / TRANSCENDENCE_BASE_COST;

const RIPPLE_BASE_COST = 15;

export const RIPPLE_EARLY_PRICE_ANCHORS = [
  100,
  500,
  10_000,
  100_000,
  10_000_000,
] as const;

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

/** Geometric ramp from M[4] to pinned M[14] with nice snapping. */
function buildDenizenLateMults(): number[] {
  const start = DENIZEN_MULT_LOCKED[4]!;
  const end = DENIZEN_MULT_END;
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

/** Ripple late mults: same step ratios as denizen ramp applied from R[4]. */
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

const _denizenLate = buildDenizenLateMults();

export const DENIZEN_EVOLUTION_TIER_MULT: readonly number[] = [
  ...DENIZEN_MULT_LOCKED,
  ..._denizenLate,
] as const;

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
