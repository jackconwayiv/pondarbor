import { Box } from "@chakra-ui/react";
import { useEffect, useRef, type CSSProperties } from "react";

import "./PondCycleFadeOverlay.css";

import { POND_CYCLE_FADE_IN_MS, POND_CYCLE_FADE_OUT_MS } from "./pondCycleFadeTiming";

export default function PondCycleFadeOverlay({
  active,
  fadeToWhite,
  motionPaused,
  onTransitionComplete,
}: {
  active: boolean;
  /** When true, animate to opaque white; when false, animate to transparent. */
  fadeToWhite: boolean;
  motionPaused: boolean;
  onTransitionComplete: () => void;
}) {
  const runRef = useRef(0);
  const completeRef = useRef(onTransitionComplete);
  completeRef.current = onTransitionComplete;

  useEffect(() => {
    if (!active) return;

    const runId = ++runRef.current;
    const durationMs = motionPaused
      ? 0
      : fadeToWhite
        ? POND_CYCLE_FADE_IN_MS
        : POND_CYCLE_FADE_OUT_MS;

    const timer = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      completeRef.current();
    }, durationMs);

    return () => {
      runRef.current += 1;
      window.clearTimeout(timer);
    };
  }, [active, fadeToWhite, motionPaused]);

  if (!active) return null;

  const phaseClass = motionPaused
    ? fadeToWhite
      ? "pondCycleFadeOverlay--instantWhite"
      : "pondCycleFadeOverlay--instantClear"
    : fadeToWhite
      ? "pondCycleFadeOverlay--fadeIn"
      : "pondCycleFadeOverlay--fadeOut";

  return (
    <Box
      className={`pondCycleFadeOverlay ${phaseClass}`}
      style={
        motionPaused
          ? undefined
          : ({
              "--pond-cycle-fade-in-ms": `${POND_CYCLE_FADE_IN_MS}ms`,
              "--pond-cycle-fade-out-ms": `${POND_CYCLE_FADE_OUT_MS}ms`,
            } as CSSProperties)
      }
      aria-hidden="true"
    />
  );
}
