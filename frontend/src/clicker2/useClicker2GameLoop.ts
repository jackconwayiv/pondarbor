import { useEffect, useRef, type MutableRefObject } from "react";

import { publishDisplayEpsIfChanged } from "./clicker2DisplayEps";
import { formatEnergyAmount } from "./formatEnergy";
import { simulateGame } from "./simulation";
import {
  computeEffectiveEnergy,
  computeEffectiveEnergyAtBlusterEnd,
} from "./useEffectiveEnergy";
import {
  spendableCrossedAffordBoundary,
  type collectShopAffordThresholds,
} from "./clicker2Afford";
import {
  effectiveEnergyPerSecond,
  type ActiveBlusterBoost,
} from "./weatherEvents";

const COUNTER_LERP_HALF_LIFE_MS = 1000 / 60;
/** Min interval between game-loop ticks while the tab is hidden. */
const HIDDEN_TAB_TICK_MS = 1000;

function counterLerpFactor(deltaMs: number): number {
  return 1 - Math.pow(0.5, deltaMs / COUNTER_LERP_HALF_LIFE_MS);
}

function counterSnapThreshold(energyPerSecond: number): number {
  return Math.max(50, energyPerSecond * 2);
}

export type Clicker2GameLoopRefs = {
  ownedDenizens: MutableRefObject<Record<string, number>>;
  ownedSpecialties: MutableRefObject<Record<number, boolean>>;
  denizenMutationLevels: MutableRefObject<Record<string, number>>;
  energy: MutableRefObject<number>;
  energyAnchorMs: MutableRefObject<number>;
  activeBlusterBoost: MutableRefObject<ActiveBlusterBoost | null>;
  affordThresholds: MutableRefObject<ReturnType<typeof collectShopAffordThresholds>>;
  spendableEnergy: MutableRefObject<number>;
  lastSpendableForAfford: MutableRefObject<number>;
  displayValue: MutableRefObject<number>;
  lastShownCounterInt: MutableRefObject<number>;
};

function runGameLoopTick(
  refs: Clicker2GameLoopRefs,
  now: number,
  deltaMs: number,
  opts: { hidden: boolean },
): { affordCrossed: boolean } {
  const sim = simulateGame(
    refs.ownedDenizens.current,
    refs.ownedSpecialties.current,
    refs.denizenMutationLevels.current,
  );
  const eps = effectiveEnergyPerSecond(
    sim.energyPerSecond,
    refs.activeBlusterBoost.current,
    now,
  );
  const spendable = computeEffectiveEnergy(
    refs.energy.current,
    eps,
    refs.energyAnchorMs.current,
    now,
  );

  publishDisplayEpsIfChanged(eps);

  let affordCrossed = false;
  if (!opts.hidden) {
    const prevSpendable = refs.lastSpendableForAfford.current;
    if (
      spendableCrossedAffordBoundary(
        prevSpendable,
        spendable,
        refs.affordThresholds.current,
      )
    ) {
      affordCrossed = true;
    }
    refs.lastSpendableForAfford.current = spendable;
  }

  refs.spendableEnergy.current = spendable;

  if (!opts.hidden) {
    const target = spendable;
    const drift = Math.abs(target - refs.displayValue.current);
    if (drift > counterSnapThreshold(eps)) {
      refs.displayValue.current = target;
    } else {
      const factor = counterLerpFactor(deltaMs);
      refs.displayValue.current +=
        (target - refs.displayValue.current) * factor;
    }
  } else {
    refs.displayValue.current = spendable;
  }

  return { affordCrossed };
}

export function useClicker2GameLoop(
  enabled: boolean,
  refsBox: MutableRefObject<Clicker2GameLoopRefs>,
  onCounterDisplay: (text: string) => void,
  onAffordBoundaryCross: () => void,
): void {
  const onCounterDisplayRef = useRef(onCounterDisplay);
  onCounterDisplayRef.current = onCounterDisplay;
  const onAffordBoundaryCrossRef = useRef(onAffordBoundaryCross);
  onAffordBoundaryCrossRef.current = onAffordBoundaryCross;

  const lastFrameMsRef = useRef(performance.now());
  const lastHiddenTickMsRef = useRef(0);
  const counterTextQueuedRef = useRef<string | null>(null);
  const counterFlushRafRef = useRef(0);

  const queueCounterDisplay = (text: string) => {
    counterTextQueuedRef.current = text;
    if (counterFlushRafRef.current) return;
    counterFlushRafRef.current = requestAnimationFrame(() => {
      counterFlushRafRef.current = 0;
      const queued = counterTextQueuedRef.current;
      counterTextQueuedRef.current = null;
      if (queued != null) onCounterDisplayRef.current(queued);
    });
  };

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);

      const hidden = document.hidden;
      if (hidden && now - lastHiddenTickMsRef.current < HIDDEN_TAB_TICK_MS) {
        return;
      }
      if (hidden) {
        lastHiddenTickMsRef.current = now;
      }

      const deltaMs = Math.min(100, Math.max(0, now - lastFrameMsRef.current));
      lastFrameMsRef.current = now;

      const refs = refsBox.current;
      const result = runGameLoopTick(refs, now, deltaMs, { hidden });
      if (result.affordCrossed) {
        onAffordBoundaryCrossRef.current();
      }

      if (!hidden) {
        const shown = Math.round(Math.max(0, refs.displayValue.current));
        if (shown !== refs.lastShownCounterInt.current) {
          refs.lastShownCounterInt.current = shown;
          queueCounterDisplay(formatEnergyAmount(shown));
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (counterFlushRafRef.current) {
        cancelAnimationFrame(counterFlushRafRef.current);
      }
    };
  }, [enabled]);
}

/** Snap counter display and spendable ref to true effective energy (tab resume, etc.). */
export function snapClicker2CounterToEffective(
  refsBox: MutableRefObject<Clicker2GameLoopRefs>,
  onCounterDisplay: (text: string) => void,
  nowMs: number = performance.now(),
): void {
  const refs = refsBox.current;
  const sim = simulateGame(
    refs.ownedDenizens.current,
    refs.ownedSpecialties.current,
    refs.denizenMutationLevels.current,
  );
  const eps = effectiveEnergyPerSecond(
    sim.energyPerSecond,
    refs.activeBlusterBoost.current,
    nowMs,
  );
  const target = computeEffectiveEnergy(
    refs.energy.current,
    eps,
    refs.energyAnchorMs.current,
    nowMs,
  );
  refs.displayValue.current = target;
  refs.spendableEnergy.current = target;
  refs.lastSpendableForAfford.current = target;
  const shown = Math.round(Math.max(0, target));
  refs.lastShownCounterInt.current = shown;
  publishDisplayEpsIfChanged(eps);
  onCounterDisplay(formatEnergyAmount(shown));
}

export function snapClicker2CounterDisplay(
  refs: Pick<
    Clicker2GameLoopRefs,
    | "energy"
    | "energyAnchorMs"
    | "ownedDenizens"
    | "ownedSpecialties"
    | "denizenMutationLevels"
    | "activeBlusterBoost"
    | "displayValue"
    | "lastShownCounterInt"
    | "spendableEnergy"
    | "lastSpendableForAfford"
  >,
  displayEnergyPerSecond: number,
  nowMs: number = performance.now(),
): string {
  const target = computeEffectiveEnergy(
    refs.energy.current,
    displayEnergyPerSecond,
    refs.energyAnchorMs.current,
    nowMs,
  );
  const drift = Math.abs(target - refs.displayValue.current);
  if (drift > counterSnapThreshold(displayEnergyPerSecond)) {
    refs.displayValue.current = target;
  }
  refs.spendableEnergy.current = target;
  refs.lastSpendableForAfford.current = target;
  const shown = Math.round(Math.max(0, refs.displayValue.current));
  refs.lastShownCounterInt.current = shown;
  publishDisplayEpsIfChanged(displayEnergyPerSecond);
  return formatEnergyAmount(shown);
}

export function snapClicker2CounterAtBlusterEnd(
  refs: Pick<
    Clicker2GameLoopRefs,
    | "energy"
    | "energyAnchorMs"
    | "ownedDenizens"
    | "ownedSpecialties"
    | "denizenMutationLevels"
    | "activeBlusterBoost"
    | "displayValue"
    | "lastShownCounterInt"
    | "spendableEnergy"
    | "lastSpendableForAfford"
  >,
  boost: ActiveBlusterBoost,
): string {
  const sim = simulateGame(
    refs.ownedDenizens.current,
    refs.ownedSpecialties.current,
    refs.denizenMutationLevels.current,
  );
  const target = computeEffectiveEnergyAtBlusterEnd(
    refs.energy.current,
    sim.energyPerSecond,
    refs.energyAnchorMs.current,
    boost.untilPerfMs,
    boost.peakMultiplier,
  );
  refs.displayValue.current = target;
  refs.spendableEnergy.current = target;
  refs.lastSpendableForAfford.current = target;
  const shown = Math.round(Math.max(0, target));
  refs.lastShownCounterInt.current = shown;
  const eps = effectiveEnergyPerSecond(
    sim.energyPerSecond,
    null,
    boost.untilPerfMs,
  );
  publishDisplayEpsIfChanged(eps);
  return formatEnergyAmount(shown);
}
