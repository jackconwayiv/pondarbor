/** Retired East/South/West/North Wind evolutions (removed from catalog). */
export const RETIRED_WIND_SPECIALTY_IDS = [675, 676, 677, 678] as const;

const RETIRED_WIND_SET = new Set<number>(RETIRED_WIND_SPECIALTY_IDS);

export function isRetiredWindSpecialtyId(id: number): boolean {
  return RETIRED_WIND_SET.has(id);
}

/** Drop retired wind cards from owned map (saves may still list them until rewritten). */
export function stripRetiredWindFromOwnedSpecialties(
  owned: Record<number, boolean>,
): Record<number, boolean> {
  let changed = false;
  const out: Record<number, boolean> = {};
  for (const [rawId, value] of Object.entries(owned)) {
    const id = Number(rawId);
    if (isRetiredWindSpecialtyId(id)) {
      changed = true;
      continue;
    }
    if (value) out[id] = true;
  }
  return changed ? out : owned;
}
