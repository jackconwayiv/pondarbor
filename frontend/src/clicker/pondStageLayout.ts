/**
 * Deterministic, non-overlapping scatter layout for PondStage emojis.
 *
 * Goal: haphazard scatter that stays stable per-upgrade, but avoids obvious overlaps/touching.
 */

export type Anchor = { left: number; top: number };

/** FNV-1a 32-bit */
export function hash32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lcg32(x: number): number {
  // Numerical Recipes LCG (32-bit)
  return (Math.imul(1664525, x) + 1013904223) >>> 0;
}

function dist2(a: Anchor, b: Anchor): number {
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  return dx * dx + dy * dy;
}

export type ScatterBounds = {
  leftMin: number;
  leftMax: number;
  topMin: number;
  topMax: number;
};

export type ScatterOptions = {
  /** Minimum separation in % units (roughly “not touching”). */
  minDistance: number;
  /** Try count per id before giving up. */
  maxAttempts: number;
};

/**
 * Deterministically pick non-overlapping anchors.
 * - Stable: depends only on each `id` string and the set/order of `ids`.
 * - Haphazard: hash-driven candidate jitter.
 */
export function scatterNonOverlapping(
  ids: readonly string[],
  bounds: ScatterBounds,
  options: ScatterOptions,
  fixed: ReadonlyArray<{ id: string; anchor: Anchor }>,
  preferred?: Readonly<Record<string, Anchor>>,
): Record<string, Anchor> {
  const placed: { id: string; anchor: Anchor }[] = [...fixed];
  const out: Record<string, Anchor> = {};
  const minD2 = options.minDistance * options.minDistance;

  const fits = (a: Anchor) => {
    for (const p of placed) {
      if (dist2(a, p.anchor) < minD2) return false;
    }
    return true;
  };

  const clamp = (a: Anchor): Anchor => ({
    left: Math.min(bounds.leftMax, Math.max(bounds.leftMin, a.left)),
    top: Math.min(bounds.topMax, Math.max(bounds.topMin, a.top)),
  });

  for (const id of ids) {
    const pref = preferred?.[id];
    if (pref) {
      const c = clamp(pref);
      if (fits(c)) {
        out[id] = c;
        placed.push({ id, anchor: c });
        continue;
      }
    }

    let seed = hash32(id);
    let chosen: Anchor | null = null;
    for (let attempt = 0; attempt < options.maxAttempts; attempt++) {
      seed = lcg32(seed);
      const r1 = seed / 2 ** 32;
      seed = lcg32(seed);
      const r2 = seed / 2 ** 32;

      // Uniform scatter across bounds (edges/corners included).
      const left = bounds.leftMin + (bounds.leftMax - bounds.leftMin) * r1;
      const top = bounds.topMin + (bounds.topMax - bounds.topMin) * r2;
      const a = clamp({ left, top });
      if (fits(a)) {
        chosen = a;
        break;
      }
    }

    // Last resort: accept the best-effort clamped preferred/first candidate.
    if (!chosen) {
      const fallback = clamp(
        preferred?.[id] ?? {
          left: (bounds.leftMin + bounds.leftMax) / 2,
          top: (bounds.topMin + bounds.topMax) / 2,
        },
      );
      chosen = fallback;
    }

    out[id] = chosen;
    placed.push({ id, anchor: chosen });
  }

  return out;
}

