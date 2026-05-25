import { describe, expect, it } from "vitest";

import {
  normalizeSpecialtyAcquiredAtMs,
  resolveSpecialtyAcquiredAtMs,
  specialtyAcquiredMigrationPending,
} from "./specialtyAcquiredAt";

describe("specialtyAcquiredAt", () => {
  it("stamps missing owned specialties once at resolve", () => {
    const owned = { 1: true, 2: true };
    const resolved = resolveSpecialtyAcquiredAtMs({}, owned, 1_000);
    expect(resolved[1]).toBe(1_000);
    expect(resolved[2]).toBe(1_000);

    const again = resolveSpecialtyAcquiredAtMs(resolved, owned, 9_999);
    expect(again[1]).toBe(1_000);
    expect(again[2]).toBe(1_000);
  });

  it("keeps valid stamps and drops unowned entries", () => {
    const owned = { 3: true };
    const raw = { 3: 500, 4: 600 };
    expect(normalizeSpecialtyAcquiredAtMs(raw, owned)).toEqual({ 3: 500 });
  });

  it("detects migration pending when raw lacks stamps for owned rows", () => {
    const owned = { 1: true };
    expect(specialtyAcquiredMigrationPending({}, owned)).toBe(true);
    expect(
      specialtyAcquiredMigrationPending(
        { specialty_acquired_at_ms: { 1: 100 } },
        owned,
      ),
    ).toBe(false);
  });
});
