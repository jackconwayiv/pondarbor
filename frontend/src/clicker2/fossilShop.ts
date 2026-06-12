import { getSpecialtyDef, type SpecialtyDef, type SpecialtyEffect } from "./specialties";
import {
  GATHERING_CLOUDS_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
} from "./treeCloudEvolutions";
import { isSpecialtyUnlocked } from "./visibility";

export type FossilShopTreeNode = {
  id: number;
  parentId: number | null;
  children: number[];
};

export type FossilShopTreeGraph = {
  rootId: number;
  nodes: ReadonlyMap<number, FossilShopTreeNode>;
};

/** Display header: "🦴 FOSSILS: 12" */
export function formatFossilsBalanceHeader(fossils: number): string {
  return `${FOSSIL_EMOJI} ${FOSSILS_BALANCE_LABEL}: ${Math.max(0, Math.floor(fossils)).toLocaleString()}`;
}

const FOSSILS_BALANCE_LABEL = "FOSSILS";

/** Tooltip / cost label: "12 🦴" */
export function formatFossilCost(amount: number): string {
  return `${Math.max(0, Math.floor(amount)).toLocaleString()} ${FOSSIL_EMOJI}`;
}

/** Prerequisite tree for the cycle interstitial fossil shop. */
export function buildFossilShopTreeGraph(): FossilShopTreeGraph {
  const nodes = new Map<number, FossilShopTreeNode>();

  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    const def = getSpecialtyDef(id);
    if (!def) continue;
    const parentId = def.requiresOwnedSpecialtyId ?? null;
    nodes.set(id, { id, parentId, children: [] });
  }

  for (const node of nodes.values()) {
    if (node.parentId == null) continue;
    const parent = nodes.get(node.parentId);
    if (!parent) continue;
    parent.children.push(node.id);
  }

  for (const node of nodes.values()) {
    node.children.sort(compareFossilShopTreeSiblingOrder);
  }

  return {
    rootId: STRATIFIED_POND_SPECIALTY_ID,
    nodes,
  };
}

function compareFossilShopTreeSiblingOrder(a: number, b: number): number {
  const aIndex = FOSSIL_SHOP_TREE_SIBLING_ORDER.get(a);
  const bIndex = FOSSIL_SHOP_TREE_SIBLING_ORDER.get(b);
  if (aIndex != null && bIndex != null && aIndex !== bIndex) {
    return aIndex - bIndex;
  }
  if (aIndex != null && bIndex == null) return -1;
  if (aIndex == null && bIndex != null) return 1;
  return a - b;
}

/** Owned nodes expand to show children; ancestors expand so owned nodes stay reachable. */
export function initialExpandedFossilShopTreeNodes(
  ownedSpecialties: Record<number, boolean>,
  graph: FossilShopTreeGraph = buildFossilShopTreeGraph(),
): Set<number> {
  const expanded = new Set<number>();

  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    if (!ownedSpecialties[id]) continue;
    expanded.add(id);
    let parentId = graph.nodes.get(id)?.parentId ?? null;
    while (parentId != null) {
      expanded.add(parentId);
      parentId = graph.nodes.get(parentId)?.parentId ?? null;
    }
  }

  return expanded;
}

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

/** 5% EpS for first hour offline; requires Stratified Pond. */
export const FAE_PORTAL_SPECIALTY_ID = 720;

/** +10% offline EpS; requires Fae Portal. */
export const PIXIES_SPECIALTY_ID = 721;

/** 2-hour full-rate offline window; requires Fae Portal. */
export const IMPS_SPECIALTY_ID = 722;

/** +10% offline EpS; requires Pixies. */
export const GNOMES_SPECIALTY_ID = 723;

/** 4-hour full-rate offline window; requires Imps. */
export const GREMLINS_SPECIALTY_ID = 724;

/** Etch one owned evolution into eternity; requires Fossil Record. */
export const PETROGLYPH_I_SPECIALTY_ID = 725;

/** Cost-per-EpS denizen tooltips through Zooplankton; requires Stratified Pond. */
export const MICROSCOPE_SPECIALTY_ID = 726;

/** Cost-per-EpS denizen tooltips through Large Fish; requires Microscope. */
export const GLASSES_SPECIALTY_ID = 727;

/** Cost-per-EpS denizen tooltips through Humans; requires Glasses. */
export const BINOCULARS_SPECIALTY_ID = 728;

/** Cost-per-EpS denizen tooltips through Celestials; requires Binoculars. */
export const TELESCOPE_SPECIALTY_ID = 729;

export const FOSSIL_SHOP_SPECIALTY_IDS: readonly number[] = [
  STRATIFIED_POND_SPECIALTY_ID,
  FOSSIL_RECORD_SPECIALTY_ID,
  PETROGLYPH_I_SPECIALTY_ID,
  MICROSCOPE_SPECIALTY_ID,
  GLASSES_SPECIALTY_ID,
  BINOCULARS_SPECIALTY_ID,
  TELESCOPE_SPECIALTY_ID,
  FAE_PORTAL_SPECIALTY_ID,
  PIXIES_SPECIALTY_ID,
  IMPS_SPECIALTY_ID,
  GNOMES_SPECIALTY_ID,
  GREMLINS_SPECIALTY_ID,
  RIPPLES_OF_ETERNITY_SPECIALTY_ID,
  EL_NINO_SPECIALTY_ID,
  WOODED_SHORE_SPECIALTY_ID,
  GATHERING_CLOUDS_SPECIALTY_ID,
];

/** Sibling display order in the fossil shop prerequisite tree. */
const FOSSIL_SHOP_TREE_SIBLING_ORDER = new Map(
  FOSSIL_SHOP_SPECIALTY_IDS.map((id, index) => [id, index]),
);

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

/** Merge cycle-start grants into owned denizens (e.g. after buying Ripples of Eternity mid-interstitial). */
export function mergeCycleStartOwnedDenizens(
  ownedDenizens: Record<string, number>,
  ownedSpecialties: Record<number, boolean>,
): Record<string, number> {
  const granted = cycleStartOwnedDenizens(ownedSpecialties);
  if (Object.keys(granted).length === 0) return ownedDenizens;

  let changed = false;
  const next = { ...ownedDenizens };
  for (const [denizenId, count] of Object.entries(granted)) {
    const merged = Math.max(next[denizenId] ?? 0, count);
    if (merged !== (next[denizenId] ?? 0)) changed = true;
    next[denizenId] = merged;
  }
  return changed ? next : ownedDenizens;
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

/** True when the player can still buy at least one for-sale fossil shop item. */
export function hasAffordableFossilShopPurchase(
  fossils: number,
  ownedSpecialties: Record<number, boolean>,
): boolean {
  const balance = Math.max(0, Math.floor(fossils));
  for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
    const def = getSpecialtyDef(id);
    if (!def || !isFossilShopItemForSale(def, ownedSpecialties)) continue;
    if (balance >= (def.priceFossils ?? 0)) return true;
  }
  return false;
}
