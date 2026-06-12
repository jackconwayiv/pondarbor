import { getDenizenIndex } from "./denizens";
import {
  BINOCULARS_SPECIALTY_ID,
  GLASSES_SPECIALTY_ID,
  MICROSCOPE_SPECIALTY_ID,
  TELESCOPE_SPECIALTY_ID,
} from "./fossilShop";

/** Highest denizen index included per optics tier (inclusive). */
const OPTICS_YIELD_COST_TIERS: ReadonlyArray<{
  specialtyId: number;
  throughDenizenId: string;
}> = [
  { specialtyId: MICROSCOPE_SPECIALTY_ID, throughDenizenId: "zooplankton" },
  { specialtyId: GLASSES_SPECIALTY_ID, throughDenizenId: "large_fish" },
  { specialtyId: BINOCULARS_SPECIALTY_ID, throughDenizenId: "humans" },
  { specialtyId: TELESCOPE_SPECIALTY_ID, throughDenizenId: "celestials" },
];

export function denizenYieldCostTooltipThroughIndex(
  ownedSpecialties: Record<number, boolean>,
): number | null {
  let throughIndex: number | null = null;
  for (const tier of OPTICS_YIELD_COST_TIERS) {
    if (!ownedSpecialties[tier.specialtyId]) continue;
    const index = getDenizenIndex(tier.throughDenizenId);
    if (index < 0) continue;
    throughIndex = index;
  }
  return throughIndex;
}

export function denizenInYieldCostTooltipRange(
  defId: string,
  throughIndex: number | null,
): boolean {
  if (throughIndex == null) return false;
  const index = getDenizenIndex(defId);
  if (index < 0) return false;
  return index <= throughIndex;
}

/** Next-purchase energy cost per 1 EpS; null when unavailable. */
export function denizenCostPerEps(
  cost: number | null,
  perCopyEps: number,
): number | null {
  if (cost == null || !Number.isFinite(cost) || cost <= 0) return null;
  if (!Number.isFinite(perCopyEps) || perCopyEps <= 0) return null;
  return Math.max(1, Math.round(cost / perCopyEps));
}

export function denizenYieldCostTooltipForOwned(
  ownedSpecialties: Record<number, boolean>,
  defId: string,
  cost: number | null,
  perCopyEps: number,
): number | null {
  const throughIndex = denizenYieldCostTooltipThroughIndex(ownedSpecialties);
  if (!denizenInYieldCostTooltipRange(defId, throughIndex)) return null;
  return denizenCostPerEps(cost, perCopyEps);
}
