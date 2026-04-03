/**
 * Pace check: time to own all TIER1_MARQUEE_IDS with passive 1Hz + effective click rate.
 * Design target ~600s at 0.75 effective cps (25% active @ 3 Hz); economy is tuned in catalog
 * (sunlight passive, nutrient_silt click), not a global multiplier. Run: npx tsx src/clicker/tier1PaceSim.ts
 */
import { CATALOG_UPGRADES, nextPurchaseCost } from "./catalog";
import {
  computeBiodiversity,
  computePondStats,
  isUpgradeUnlocked,
  isUpgradeVisible,
  tier1PondComplete,
} from "./ruleEngine";
import { simulateOwnedUpgrades } from "./simulation";

type Owned = Record<string, number>;

function tryBuyNext(
  owned: Owned,
  resources: { energy: number },
  revealed: Record<string, boolean>,
): { id: string; cost: number } | null {
  const pondStats = computePondStats(owned);
  const biodiversity = computeBiodiversity(owned);
  for (const def of CATALOG_UPGRADES) {
    if (!isUpgradeVisible(def, owned, resources, revealed, pondStats, biodiversity)) continue;
    if (!isUpgradeUnlocked(def, owned, resources, pondStats, biodiversity)) continue;
    const o = owned[def.id] ?? 0;
    const cost = nextPurchaseCost(def, o);
    if (cost === null) continue;
    if (resources.energy >= cost.energy) {
      return { id: def.id, cost: cost.energy };
    }
  }
  return null;
}

function simulateSeconds(clicksPerSec: number, maxSeconds: number): { seconds: number; complete: boolean } {
  const owned: Owned = {};
  const revealed: Record<string, boolean> = {};
  let energy = 0;

  for (let t = 0; t < maxSeconds; t++) {
    const { resourceRates, clickValue } = simulateOwnedUpgrades(owned);
    energy += resourceRates.energy + clickValue * clicksPerSec;

    let guard = 0;
    while (guard++ < 500) {
      const buy = tryBuyNext(owned, { energy }, revealed);
      if (!buy) break;
      energy -= buy.cost;
      owned[buy.id] = (owned[buy.id] ?? 0) + 1;
      revealed[buy.id] = true;
    }

    if (tier1PondComplete(owned)) {
      return { seconds: t + 1, complete: true };
    }
  }
  return { seconds: maxSeconds, complete: tier1PondComplete(owned) };
}

const REFERENCE_CLICK_HZ = 3;
const ACTIVE_FRACTION = 0.25;
const effectiveClicksPerSec = REFERENCE_CLICK_HZ * ACTIVE_FRACTION;

const TARGET_SEC = 600;
const result = simulateSeconds(effectiveClicksPerSec, 200_000);
const minutes = result.seconds / 60;
// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      effectiveClicksPerSec,
      targetSeconds: TARGET_SEC,
      note: "income from upgrade effects only (see sunlight, nutrient_silt)",
      complete: result.complete,
      seconds: result.seconds,
      minutes: Math.round(minutes * 10) / 10,
    },
    null,
    2,
  ),
);
