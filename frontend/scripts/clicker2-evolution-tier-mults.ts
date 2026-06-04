/**
 * Print and validate evolution tier multiplier tables.
 * Run: npm run clicker2:evolution-tier-mults
 */
import { getDenizenDef } from "../src/clicker2/denizens";
import { denizenEvolutionPrice } from "../src/clicker2/evolutionPricing";
import {
  DENIZEN_DOUBLING_FIRST_MULT,
  DENIZEN_DOUBLING_SECOND_MULT,
  DENIZEN_EVOLUTION_TIER_MULT,
  RIPPLE_EARLY_PRICE_ANCHORS,
  RIPPLE_EVOLUTION_TIER_MULT,
} from "../src/clicker2/evolutionTierMults";

function main(): void {
  const errors: string[] = [];
  for (let i = 1; i < DENIZEN_EVOLUTION_TIER_MULT.length; i++) {
    if (DENIZEN_EVOLUTION_TIER_MULT[i]! <= DENIZEN_EVOLUTION_TIER_MULT[i - 1]!) {
      errors.push(`DENIZEN mult not increasing at ${i}`);
    }
  }
  if (DENIZEN_EVOLUTION_TIER_MULT[0] !== DENIZEN_DOUBLING_FIRST_MULT) {
    errors.push("M[0] must be 10 (first doubling = 10× baseCost)");
  }
  if (DENIZEN_EVOLUTION_TIER_MULT[1] !== DENIZEN_DOUBLING_SECOND_MULT) {
    errors.push("M[1] must be 50 (second doubling = 5× first)");
  }
  if (
    DENIZEN_EVOLUTION_TIER_MULT[1]! / DENIZEN_EVOLUTION_TIER_MULT[0]! !==
    5
  ) {
    errors.push("M[1] / M[0] must be 5");
  }
  for (let i = 2; i < DENIZEN_EVOLUTION_TIER_MULT.length; i++) {
    if (
      DENIZEN_EVOLUTION_TIER_MULT[i]! / DENIZEN_EVOLUTION_TIER_MULT[i - 1]! !==
      10
    ) {
      errors.push(`M[${i}] / M[${i - 1}] must be 10`);
    }
  }

  for (let i = 1; i < RIPPLE_EVOLUTION_TIER_MULT.length; i++) {
    if (RIPPLE_EVOLUTION_TIER_MULT[i]! <= RIPPLE_EVOLUTION_TIER_MULT[i - 1]!) {
      errors.push(`RIPPLE mult not increasing at ${i}`);
    }
  }

  const fungi = getDenizenDef("fungi")!;
  const p0 = denizenEvolutionPrice("fungi", 0);
  const p1 = denizenEvolutionPrice("fungi", 1);
  const p2 = denizenEvolutionPrice("fungi", 2);
  if (p0 !== Math.round(fungi.baseCost * 10)) {
    errors.push(`fungi tier 0 price ${p0} !== 10× baseCost`);
  }
  if (p1 !== 5 * p0) {
    errors.push(`fungi tier 1 price ${p1} !== 5× tier 0`);
  }
  if (p2 !== 10 * p1) {
    errors.push(`fungi tier 2 price ${p2} !== 10× tier 1`);
  }

  console.log("DENIZEN_EVOLUTION_TIER_MULT");
  for (let i = 0; i < DENIZEN_EVOLUTION_TIER_MULT.length; i++) {
    console.log(`  [${i}] ${DENIZEN_EVOLUTION_TIER_MULT[i]}`);
  }
  console.log("\nRIPPLE prices (base 15)");
  for (let i = 0; i < 15; i++) {
    const price =
      i < 5
        ? RIPPLE_EARLY_PRICE_ANCHORS[i]
        : Math.round(15 * RIPPLE_EVOLUTION_TIER_MULT[i]!);
    console.log(`  tier ${i + 1}: ${price}`);
  }

  if (errors.length) {
    console.error("\nViolations:");
    for (const e of errors) console.error(e);
    process.exit(1);
  }
  console.error("\nOK");
}

main();
