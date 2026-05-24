import { Text } from "@chakra-ui/react";
import "@fontsource/major-mono-display/400.css";
import { useEffect, useRef, useState } from "react";

import {
  formatEnergyAmountHud,
  splitEnergyAmountDisplay,
} from "./formatEnergy";
import { computeEffectiveEnergy } from "./useEffectiveEnergy";

const COUNTER_FONT_FAMILY =
  '"Major Mono Display", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

/** Major Mono has no true lowercase; scale words use a normal mono stack. */
const COUNTER_SCALE_SUFFIX_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function EnergyCounterText({
  text,
  fontSize,
}: {
  text: string;
  fontSize: Record<string, string> | string;
}) {
  const { valuePart, scaleSuffix } = splitEnergyAmountDisplay(text);

  return (
    <Text
      fontFamily={COUNTER_FONT_FAMILY}
      fontWeight="bold"
      fontSize={fontSize}
      fontVariantNumeric="tabular-nums"
      letterSpacing="tight"
      lineHeight="1.1"
      textTransform="none"
      aria-live="polite"
      aria-atomic
    >
      {valuePart}
      {scaleSuffix != null ? (
        <>
          {" "}
          <Text
            as="span"
            fontFamily={COUNTER_SCALE_SUFFIX_FONT}
            textTransform="none"
            fontSize="inherit"
            fontWeight="normal"
            letterSpacing="inherit"
            lineHeight="inherit"
          >
            {scaleSuffix}
          </Text>
        </>
      ) : null}
    </Text>
  );
}

/** Cookie Clicker–style lerp: display eases toward the live total, shown as integers. */
const LERP_HALF_LIFE_MS = 1000 / 60;

function lerpFactor(deltaMs: number): number {
  return 1 - Math.pow(0.5, deltaMs / LERP_HALF_LIFE_MS);
}

function snapThreshold(energyPerSecond: number): number {
  return Math.max(50, energyPerSecond * 2);
}

export default function RollingEnergyCounter({
  syncedEnergy,
  energyPerSecond,
  anchorMs,
  displayText: controlledDisplayText,
  fontSize = { base: "2xl", md: "4xl" },
}: {
  syncedEnergy: number;
  energyPerSecond: number;
  anchorMs: number;
  /** When set, the parent game loop drives the display (no internal rAF). */
  displayText?: string;
  fontSize?: Record<string, string> | string;
}) {
  if (controlledDisplayText != null) {
    return <EnergyCounterText text={controlledDisplayText} fontSize={fontSize} />;
  }
  const syncedRef = useRef(syncedEnergy);
  const rateRef = useRef(energyPerSecond);
  const anchorRef = useRef(anchorMs);
  syncedRef.current = syncedEnergy;
  rateRef.current = energyPerSecond;
  anchorRef.current = anchorMs;

  const displayValueRef = useRef(
    computeEffectiveEnergy(syncedEnergy, energyPerSecond, anchorMs),
  );
  const lastFrameMsRef = useRef(performance.now());

  const [displayText, setDisplayText] = useState(() =>
    formatEnergyAmountHud(Math.round(Math.max(0, displayValueRef.current))),
  );
  const lastShownIntRef = useRef(Math.round(Math.max(0, displayValueRef.current)));

  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      const deltaMs = Math.min(100, Math.max(0, now - lastFrameMsRef.current));
      lastFrameMsRef.current = now;

      const target = computeEffectiveEnergy(
        syncedRef.current,
        rateRef.current,
        anchorRef.current,
        now,
      );

      const factor = lerpFactor(deltaMs);
      displayValueRef.current +=
        (target - displayValueRef.current) * factor;

      const shown = Math.round(Math.max(0, displayValueRef.current));
      if (shown !== lastShownIntRef.current) {
        lastShownIntRef.current = shown;
        setDisplayText(formatEnergyAmountHud(shown));
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const target = computeEffectiveEnergy(
      syncedEnergy,
      energyPerSecond,
      anchorMs,
    );
    const drift = Math.abs(target - displayValueRef.current);
    if (drift > snapThreshold(energyPerSecond)) {
      displayValueRef.current = target;
      lastFrameMsRef.current = performance.now();
      const shown = Math.round(Math.max(0, target));
      if (shown !== lastShownIntRef.current) {
        lastShownIntRef.current = shown;
        setDisplayText(formatEnergyAmountHud(shown));
      }
    }
  }, [syncedEnergy, energyPerSecond, anchorMs]);

  return <EnergyCounterText text={displayText} fontSize={fontSize} />;
}
