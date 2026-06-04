/**
 * Validate denizen baseCost + baseEps against canonical tables.
 * Run: npm run clicker2:denizen-cost-curve
 */
import { DENIZENS } from "../src/clicker2/denizens";

export const EXPECTED_COST = [
  15,
  100,
  1_000,
  11_000,
  132_000,
  2_000_000,
  24_000_000,
  360_000_000,
  6_000_000_000,
  98_000_000_000,
  2_000_000_000_000,
  33_000_000_000_000,
  670_000_000_000_000,
  14_000_000_000_000_000,
  310_000_000_000_000_000,
  7_000_000_000_000_000_000,
  171_000_000_000_000_000_000,
  5_000_000_000_000_000_000_000,
  110_000_000_000_000_000_000_000,
  5_000_000_000_000_000_000_000_000,
  85_000_000_000_000_000_000_000_000,
  3_000_000_000_000_000_000_000_000_000,
  75_000_000_000_000_000_000_000_000_000,
] as const;

export const EXPECTED_EPS = [
  0.1,
  1,
  8,
  45,
  260,
  1_500,
  9_360,
  48_000,
  274_000,
  1_560_000,
  9_200_000,
  55_000_000,
  335_000_000,
  2_080_000_000,
  13_100_000_000,
  84_000_000_000,
  550_000_000_000,
  3_660_000_000_000,
  24_900_000_000_000,
  173_000_000_000_000,
  1_230_000_000_000_000,
  8_930_000_000_000_000,
  69_000_000_000_000_000,
] as const;

export function stepMultipliers(values: readonly number[]): number[] {
  const mults: number[] = [];
  for (let i = 1; i < values.length; i++) {
    mults.push(values[i]! / values[i - 1]!);
  }
  return mults;
}

/** Validate ramp segment only (index `rampStart` .. end). */
export function validateRampStepMultipliers(
  values: readonly number[],
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

function main(): void {
  const ids = DENIZENS.map((d) => d.id);
  const costs = DENIZENS.map((d) => d.baseCost);
  const eps = DENIZENS.map((d) => d.baseEps);

  const errors: string[] = [];

  if (DENIZENS.length !== EXPECTED_COST.length) {
    errors.push(
      `DENIZENS length ${DENIZENS.length} !== expected ${EXPECTED_COST.length}`,
    );
  }

  for (let i = 0; i < Math.min(DENIZENS.length, EXPECTED_COST.length); i++) {
    if (costs[i] !== EXPECTED_COST[i]) {
      errors.push(
        `baseCost mismatch tier ${i + 1} (${ids[i]}): got ${costs[i]}, want ${EXPECTED_COST[i]}`,
      );
    }
    if (eps[i] !== EXPECTED_EPS[i]) {
      errors.push(
        `baseEps mismatch tier ${i + 1} (${ids[i]}): got ${eps[i]}, want ${EXPECTED_EPS[i]}`,
      );
    }
  }

  errors.push(
    ...validateRampStepMultipliers(costs, 0, "baseCost"),
    ...validateRampStepMultipliers(eps, 0, "baseEps"),
  );

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

  if (errors.length) {
    console.error("\nViolations:");
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.error("\nOK: catalog matches canonical baseCost / baseEps tables");
}

main();
