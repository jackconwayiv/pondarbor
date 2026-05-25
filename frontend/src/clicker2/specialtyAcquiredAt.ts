import { SPECIALTY_IDS } from "./specialties";

/** Strip invalid ids and entries for unowned specialties. */
export function normalizeSpecialtyAcquiredAtMs(
  raw: unknown,
  ownedSpecialties: Record<number, boolean>,
): Record<number, number> {
  const out: Record<number, number> = {};
  if (!raw || typeof raw !== "object" || raw === null) return out;

  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const id = Number(k);
    if (!SPECIALTY_IDS.has(id) || !ownedSpecialties[id]) continue;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[id] = v;
    }
  }
  return out;
}

/**
 * Owned specialties without a stamp get `nowMs` once (legacy migration).
 * Does not overwrite valid existing timestamps.
 */
export function resolveSpecialtyAcquiredAtMs(
  raw: unknown,
  ownedSpecialties: Record<number, boolean>,
  nowMs: number = Date.now(),
): Record<number, number> {
  const acquired = normalizeSpecialtyAcquiredAtMs(raw, ownedSpecialties);
  for (const id of SPECIALTY_IDS) {
    if (!ownedSpecialties[id]) continue;
    if (acquired[id] == null || acquired[id] <= 0) {
      acquired[id] = nowMs;
    }
  }
  return acquired;
}

/** True when raw save lacks a valid stamp for any currently owned specialty. */
export function specialtyAcquiredMigrationPending(
  raw: unknown,
  normalizedOwned: Record<number, boolean>,
): boolean {
  for (const id of SPECIALTY_IDS) {
    if (!normalizedOwned[id]) continue;
    if (!raw || typeof raw !== "object" || raw === null) return true;
    const o = raw as Record<string, unknown>;
    const map = o.specialty_acquired_at_ms;
    if (!map || typeof map !== "object" || map === null) return true;
    const v = (map as Record<string, unknown>)[String(id)];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return true;
  }
  return false;
}
