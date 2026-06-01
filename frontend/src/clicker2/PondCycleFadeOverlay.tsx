import { Box } from "@chakra-ui/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import "./PondCycleFadeOverlay.css";

import {
  POND_CYCLE_FADE_IN_MS,
  POND_CYCLE_FADE_OUT_MS,
  POND_CYCLE_HOLD_MS,
} from "./pondCycleFadeTiming";

type PondCycleFadePhase = "fadeIn" | "hold" | "fadeOut";

export default function PondCycleFadeOverlay({
  active,
  motionPaused,
  onFullyWhite,
  onComplete,
}: {
  active: boolean;
  motionPaused: boolean;
  /** Screen is opaque white — reset game and snap HUD off-screen. */
  onFullyWhite: () => void;
  onComplete: () => void;
}) {
  const runRef = useRef(0);
  const [phase, setPhase] = useState<PondCycleFadePhase>("fadeIn");

  useEffect(() => {
    if (!active) {
      setPhase("fadeIn");
      return;
    }

    const runId = ++runRef.current;
    setPhase("fadeIn");

    const fadeInMs = motionPaused ? 0 : POND_CYCLE_FADE_IN_MS;
    const holdMs = motionPaused ? 0 : POND_CYCLE_HOLD_MS;
    const fadeOutMs = motionPaused ? 0 : POND_CYCLE_FADE_OUT_MS;

    let fadeOutStartTimer = 0;
    let completeTimer = 0;

    const whiteTimer = window.setTimeout(() => {
      if (runRef.current !== runId) return;
      onFullyWhite();
      setPhase("hold");

      fadeOutStartTimer = window.setTimeout(() => {
        if (runRef.current !== runId) return;
        setPhase("fadeOut");

        completeTimer = window.setTimeout(() => {
          if (runRef.current !== runId) return;
          onComplete();
        }, fadeOutMs);
      }, holdMs);
    }, fadeInMs);

    return () => {
      runRef.current += 1;
      window.clearTimeout(whiteTimer);
      window.clearTimeout(fadeOutStartTimer);
      window.clearTimeout(completeTimer);
    };
  }, [active, motionPaused, onFullyWhite, onComplete]);

  if (!active) return null;

  const phaseClass = motionPaused
    ? "pondCycleFadeOverlay--instant"
    : phase === "fadeIn"
      ? "pondCycleFadeOverlay--fadeIn"
      : phase === "fadeOut"
        ? "pondCycleFadeOverlay--fadeOut"
        : "pondCycleFadeOverlay--hold";

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
