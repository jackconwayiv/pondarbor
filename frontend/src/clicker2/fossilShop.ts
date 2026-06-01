import { getSpecialtyDef, type SpecialtyDef, type SpecialtyEffect } from "./specialties";
import {
  GATHERING_CLOUDS_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
} from "./treeCloudEvolutions";
import { isSpecialtyUnlocked } from "./visibility";

export {
  GATHERING_CLOUDS_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
} from "./treeCloudEvolutions";

/** Fossil shop (bone currency) — Stratified Pond and related ids. */

export const FOSSIL_EMOJI = "🦴";

export const STRATIFIED_POND_SPECIALTY_ID = 679;

/** Permanent +10% EpS; requires Stratified Pond. */
export const FOSSIL_RECORD_SPECIALTY_ID = 685;

/** Start each pond cycle with 10 ripples; requires Stratified Pond. */
export const RIPPLES_OF_ETERNITY_SPECIALTY_ID = 686;

/** Weather spawn waits ×0.95; requires Stratified Pond. */
export const EL_NINO_SPECIALTY_ID = 687;

export const FOSSIL_SHOP_SPECIALTY_IDS: readonly number[] = [
  STRATIFIED_POND_SPECIALTY_ID,
  FOSSIL_RECORD_SPECIALTY_ID,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  EL_NINO_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
  GATHERING_CLOUDS_SPECIALTY_ID,
];

const FOSSIL_SHOP_SPECIALTY_ID_SET = new Set(FOSSIL_SHOP_SPECIALTY_IDS);

export function isFossilShopSpecialtyId(id: number): boolean {
  return FOSSIL_SHOP_SPECIALTY_ID_SET.has(id);
}

/** Fossil Shop section appears after the player has earned at least one fossil. */
export function isFossilShopUnlocked(totalFossilsEarned: number): boolean {
  return totalFossilsEarned >= 1;
}

/** Fossil shop grid: cheapest first, then id ascending. */
export function compareFossilShopByFossilPrice(
  a: Pick<SpecialtyDef, "id" | "priceFossils">,
  b: Pick<SpecialtyDef, "id" | "priceFossils">,
): number {
  const aPrice = a.priceFossils ?? 0;
  const bPrice = b.priceFossils ?? 0;
  if (aPrice !== bPrice) return aPrice - bPrice;
  return a.id - b.id;
}

export function isStratifiedPondOwned(
  ownedSpecialties: Record<number, boolean>,
): boolean {
  return ownedSpecialties[STRATIFIED_POND_SPECIALTY_ID] === true;
}

function specialtyEffects(def: SpecialtyDef): readonly SpecialtyEffect[] {
  return def.effects ?? [def.effect];
}

/** Denizen counts granted at the start of each pond cycle (fossil shop bonuses). */
export function cycleStartOwnedDenizens(
  ownedSpecialties: Record<number, boolean>,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    if (!ownedSpecialties[id]) continue;
    const def = getSpecialtyDef(id);
    if (!def) continue;
    for (const effect of specialtyEffects(def)) {
      if (effect.type !== "cycle_start_denizen") continue;
      next[effect.denizenId] =
        (next[effect.denizenId] ?? 0) + Math.max(0, effect.count);
    }
  }
  return next;
}

/** Multiplier on weather spawn delay (lower = more frequent). */
export function weatherSpawnDelayScale(
  ownedSpecialties: Record<number, boolean>,
): number {
  let scale = 1;
  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    if (!ownedSpecialties[id]) continue;
    const def = getSpecialtyDef(id);
    if (!def) continue;
    for (const effect of specialtyEffects(def)) {
      if (effect.type !== "weather_spawn_frequency_bonus") continue;
      scale *= 1 - Math.max(0, effect.percent) / 100;
    }
  }
  return scale;
}

/** Unowned fossil-shop specialty the player may buy (prerequisites met). */
export function isFossilShopItemForSale(
  def: SpecialtyDef,
  ownedSpecialties: Record<number, boolean>,
): boolean {
  if (!def.fossilShopOnly || def.priceFossils == null) return false;
  if (ownedSpecialties[def.id]) return false;
  return isSpecialtyUnlocked(def, {}, 0, 0, 0, ownedSpecialties);
}
