import { useEffect, useRef, useState } from "react";

export function computeEffectiveEnergy(
  syncedEnergy: number,
  energyPerSecond: number,
  anchorMs: number,
  nowMs: number = performance.now(),
): number {
  const elapsedSec = Math.max(0, (nowMs - anchorMs) / 1000);
  return syncedEnergy + Math.max(0, energyPerSecond) * elapsedSec;
}

/** Freeze passive total at boost end using boosted EpS through `boostUntilPerfMs`. */
export function computeEffectiveEnergyAtBlusterEnd(
  syncedEnergy: number,
  baseEnergyPerSecond: number,
  anchorMs: number,
  boostUntilPerfMs: number,
  boostMultiplier: number,
): number {
  const boostedEps = baseEnergyPerSecond * boostMultiplier;
  const endMs = Math.max(anchorMs, boostUntilPerfMs);
  return computeEffectiveEnergy(syncedEnergy, boostedEps, anchorMs, endMs);
}

/**
 * Cookie Clicker–style energy: synced total plus passive drift from anchor time.
 * Updates every animation frame so integer display can tick up smoothly.
 */
export function useEffectiveEnergy(
  syncedEnergy: number,
  energyPerSecond: number,
  anchorMs: number,
): number {
  const syncedRef = useRef(syncedEnergy);
  const rateRef = useRef(energyPerSecond);
  const anchorRef = useRef(anchorMs);
  syncedRef.current = syncedEnergy;
  rateRef.current = energyPerSecond;
  anchorRef.current = anchorMs;

  const [effective, setEffective] = useState(() =>
    computeEffectiveEnergy(syncedEnergy, energyPerSecond, anchorMs),
  );

  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      setEffective(
        computeEffectiveEnergy(
          syncedRef.current,
          rateRef.current,
          anchorRef.current,
        ),
      );
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return effective;
}
