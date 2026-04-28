import type { ResourcePurse } from "./pondsteadBuildingCosts";

/** Collect sorted numeric seat indices from string-keyed per-seat payloads. */
export function seatIndicesFromOptionalRecord<T>(
  obj: Record<string, T> | null | undefined,
  fallbackSeatCount?: number,
): number[] {
  const fromObj = obj
    ? Object.keys(obj)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n) && n >= 0)
    : [];
  if (fromObj.length > 0) return Array.from(new Set(fromObj)).sort((a, b) => a - b);
  if (fallbackSeatCount != null && fallbackSeatCount > 0) {
    return Array.from({ length: fallbackSeatCount }, (_, i) => i);
  }
  return [0, 1];
}

export function emptyPursesTemplate(seats: readonly number[]): Record<number, ResourcePurse> {
  const blank: ResourcePurse = { food: 10, wood: 10, stone: 0 };
  const out: Record<number, ResourcePurse> = {};
  for (const s of seats) out[s] = { ...blank };
  return out;
}

export function emptyNumericRecord<T>(seats: readonly number[], zero: T): Record<number, T> {
  const out: Record<number, T> = {};
  for (const s of seats) out[s] = zero;
  return out;
}

export function cloneSeatKeyedSets(s: Record<number, Set<string>>): Record<number, Set<string>> {
  const out: Record<number, Set<string>> = {};
  for (const k of Object.keys(s)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    out[n] = new Set(s[n]);
  }
  return out;
}

export function cloneSeatKeyedMovement(
  m: Record<number, Record<string, number>>,
): Record<number, Record<string, number>> {
  const out: Record<number, Record<string, number>> = {};
  for (const k of Object.keys(m)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    out[n] = { ...(m[n] ?? {}) };
  }
  return out;
}

export function clonePursesLoose(p: Record<number, ResourcePurse>): Record<number, ResourcePurse> {
  const out: Record<number, ResourcePurse> = {};
  for (const k of Object.keys(p)) {
    const n = Number(k);
    if (!Number.isFinite(n)) continue;
    out[n] = { ...p[n]! };
  }
  return out;
}
