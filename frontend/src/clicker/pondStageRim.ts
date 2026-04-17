import { getOwnedCount } from "./catalog";

export type PondRimTierLayer = {
  readonly upgradeId: string;
  /** Key for `PondRimDecal.tsx` SVG variant. */
  readonly layerClass: string;
};

/**
 * Phase 2: up to two representative plant / structure / hydrology milestones per tier.
 * When the upgrade is owned (`getOwnedCount >= 1`), PondStage paints the matching rim layer.
 * `fallen_branch` → 🪵; `reed_fringe` and `cattail_stand` → 🌾; `tangled_roots` → 🌿 (PondStage emoji, not rim SVG).
 */
export const POND_RIM_LAYERS_BY_TIER: readonly (readonly PondRimTierLayer[])[] = [
  [],
  [{ upgradeId: "spawning_shallows", layerClass: "pondRimSpawningShallows" }],
  [
    { upgradeId: "open_water", layerClass: "pondRimOpenWater" },
  ],
  [
    { upgradeId: "lily_pads", layerClass: "pondRimLilyPads" },
    { upgradeId: "deep_pool", layerClass: "pondRimDeepPool" },
  ],
  [
    { upgradeId: "deepwater_channels", layerClass: "pondRimDeepwaterChannels" },
  ],
  [
    { upgradeId: "duckweed_mat", layerClass: "pondRimDuckweedMat" },
    { upgradeId: "canopy_perch", layerClass: "pondRimCanopyPerch" },
  ],
];

export function pondRimLayersOwned(
  ownedUpgrades: Record<string, number>,
): PondRimTierLayer[] {
  const out: PondRimTierLayer[] = [];
  for (const tier of POND_RIM_LAYERS_BY_TIER) {
    for (const layer of tier) {
      if (getOwnedCount(ownedUpgrades, layer.upgradeId) >= 1) {
        out.push(layer);
      }
    }
  }
  return out;
}

export function pondMidgeLayerVisible(
  ownedUpgrades: Record<string, number>,
): boolean {
  return getOwnedCount(ownedUpgrades, "midge_hatch") >= 1;
}

export function pondWaterFleaLayerVisible(
  ownedUpgrades: Record<string, number>,
): boolean {
  return getOwnedCount(ownedUpgrades, "water_fleas") >= 1;
}

/** Tier VII fireflies: soft glowing dots (separate positions from midge hatch). */
export function pondFireflyLayerVisible(
  ownedUpgrades: Record<string, number>,
): boolean {
  return getOwnedCount(ownedUpgrades, "fireflies") >= 1;
}
