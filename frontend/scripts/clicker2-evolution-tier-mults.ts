/**
 * Print and validate evolution tier multiplier tables.
 * Run: npm run clicker2:evolution-tier-mults
 */
import { getDenizenDef } from "../src/clicker2/denizens";
import {
  DENIZEN_EVOLUTION_TIER_MULT,
  RIPPLE_EARLY_PRICE_ANCHORS,
  RIPPLE_EVOLUTION_TIER_MULT,
  TRANSCENDENCE_TIER_15_PRICE,
} from "../src/clicker2/evolutionTierMults";

function main(): void {
  const errors: string[] = [];
  for (let i = 1; i < DENIZEN_EVOLUTION_TIER_MULT.length; i++) {
    if (DENIZEN_EVOLUTION_TIER_MULT[i]! <= DENIZEN_EVOLUTION_TIER_MULT[i - 1]!) {
      errors.push(`DENIZEN mult not increasing at ${i}`);
    }
  }
  for (let i = 1; i < RIPPLE_EVOLUTION_TIER_MULT.length; i++) {
    if (RIPPLE_EVOLUTION_TIER_MULT[i]! <= RIPPLE_EVOLUTION_TIER_MULT[i - 1]!) {
      errors.push(`RIPPLE mult not increasing at ${i}`);
    }
  }

  const trans = getDenizenDef("transcendence")!;
  const tier14Price = Math.round(
    trans.baseCost * DENIZEN_EVOLUTION_TIER_MULT[14]!,
  );
  if (
    Math.abs(tier14Price / TRANSCENDENCE_TIER_15_PRICE - 1) > 1e-9
  ) {
    errors.push(
      `transcendence tier 15 price ${tier14Price} !== pin ${TRANSCENDENCE_TIER_15_PRICE}`,
    );
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
