/**
 * Denizen baseCost + baseEps ramp generator.
 * Run: npm run clicker2:denizen-cost-curve
 */
import { DENIZENS } from "../src/clicker2/denizens";

const STEPS = 19;
const NICE_MANTISSAS = [1, 1.2, 1.5, 2, 2.5, 3, 5, 6, 7.5, 10] as const;

export type RampSpec = {
  start: number;
  end: number;
  mStart: number;
};

export function solveRampEndMultiplier(spec: RampSpec, steps = STEPS): number {
  const target = spec.end / spec.start;
  let lo = spec.mStart;
  let hi = 50;
  for (let iter = 0; iter < 80; iter++) {
    const mid = (lo + hi) / 2;
    let product = 1;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      product *= spec.mStart + (mid - spec.mStart) * t;
    }
    if (product < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function idealRampMultipliers(mStart: number, mEnd: number, steps = STEPS): number[] {
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    return mStart + (mEnd - mStart) * t;
  });
}

export function snapToNiceValue(ideal: number, minValue: number): number {
  if (ideal < 1000) {
    return Math.max(minValue, Math.round(ideal));
  }
  const exp = Math.floor(Math.log10(ideal));
  const scale = 10 ** exp;
  const mantissa = ideal / scale;
  let best = NICE_MANTISSAS[0]!;
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

/** Ideal geometric ladder (no rounding). */
export function buildIdealRamp(
  start: number,
  mults: number[],
): number[] {
  const out: number[] = [start];
  for (let i = 0; i < mults.length; i++) {
    const prevMult = i > 0 ? out[i]! / out[i - 1]! : mults[0]!;
    out.push(out[i]! * Math.max(mults[i]!, prevMult));
  }
  return out;
}

/**
 * Snap interior tiers to nice mantissas; pin penultimate + end with increasing step ×.
 */
export function buildRoundedRamp(
  start: number,
  mults: number[],
  end: number,
): number[] {
  const n = mults.length;
  if (n === 0) return [end];

  const ideals = buildIdealRamp(start, mults);
  const out: number[] = [start];

  for (let i = 1; i <= n; i++) {
    if (i === n) {
      out.push(end);
      break;
    }

    if (i === n - 1) {
      const prevStepMult =
        i >= 2 ? out[i - 1]! / out[i - 2]! : mults[0]!;
      const finalMult = Math.max(mults[n - 1]!, prevStepMult);
      const maxPenultimate = Math.floor(end / finalMult);
      let penultimate = snapToNiceValue(maxPenultimate, out[i - 1]! + 1);
      penultimate = Math.min(penultimate, maxPenultimate);
      if (penultimate <= out[i - 1]!) {
        penultimate = snapToNiceValue(maxPenultimate, out[i - 1]! + 1);
      }
      out.push(penultimate);
    } else {
      let v = snapToNiceValue(ideals[i]!, out[i - 1]! + 1);
      if (v <= out[i - 1]!) {
        v = snapToNiceValue(ideals[i]! * 1.05, out[i - 1]! + 1);
      }
      out.push(v);
    }
  }

  return out;
}

export function stepMultipliers(values: number[]): number[] {
  const mults: number[] = [];
  for (let i = 1; i < values.length; i++) {
    mults.push(values[i]! / values[i - 1]!);
  }
  return mults;
}

/** Validate ramp segment only (index `rampStart` .. end). */
export function validateRampStepMultipliers(
  values: number[],
  rampStart: number,
  label: string,
): string[] {
  const errors: string[] = [];
  for (let i = rampStart; i < values.length; i++) {
    if (i > 0 && values[i]! <= values[i - 1]!) {
      errors.push(`${label}: value not increasing at tier ${i + 1}`);
    }
  }
  return errors;
}

const LOCKED_COST = [15, 100, 1_000] as const;
const LOCKED_EPS = [0.1, 1, 5] as const;

const COST_SPEC: RampSpec = {
  start: 10_000,
  end: 500_000_000_000_000_000_000_000_000,
  mStart: 12,
};

const EPS_SPEC: RampSpec = {
  start: 10,
  end: 500_000_000_000_000,
  mStart: 3,
};

function buildCostRamp(): number[] {
  const mEnd = solveRampEndMultiplier(COST_SPEC);
  const mults = idealRampMultipliers(COST_SPEC.mStart, mEnd);
  return buildRoundedRamp(COST_SPEC.start, mults, COST_SPEC.end);
}

function buildEpsRamp(): number[] {
  const mEnd = solveRampEndMultiplier(EPS_SPEC);
  const mults = idealRampMultipliers(EPS_SPEC.mStart, mEnd);
  return buildRoundedRamp(EPS_SPEC.start, mults, EPS_SPEC.end);
}

function main(): void {
  const ids = DENIZENS.map((d) => d.id);
  const costs = [...LOCKED_COST, ...buildCostRamp()];
  const eps = [...LOCKED_EPS, ...buildEpsRamp()];

  const errors = [
    ...validateRampStepMultipliers(costs, 3, "baseCost"),
    ...validateRampStepMultipliers(eps, 3, "baseEps"),
  ];

  const costMults = stepMultipliers(costs);
  const epsMults = stepMultipliers(eps);

  console.log(
    ["#", "id", "baseCost", "cost×", "baseEps", "eps×", "payback_s"].join("\t"),
  );

  for (let i = 0; i < ids.length; i++) {
    console.log(
      [
        i + 1,
        ids[i],
        costs[i],
        i === 0 ? "" : costMults[i - 1]!.toFixed(2),
        eps[i],
        i === 0 ? "" : epsMults[i - 1]!.toFixed(2),
        (costs[i]! / eps[i]!).toFixed(1),
      ].join("\t"),
    );
  }

  console.error(
    `\nCost ramp: m_start=${COST_SPEC.mStart}, m_end=${solveRampEndMultiplier(COST_SPEC).toFixed(3)}`,
  );
  console.error(
    `EpS ramp: m_start=${EPS_SPEC.mStart}, m_end=${solveRampEndMultiplier(EPS_SPEC).toFixed(3)}`,
  );

  if (errors.length) {
    console.error("\nViolations:");
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.error("\nOK: monotone ramp values (tiers 4–23)");
}

main();
