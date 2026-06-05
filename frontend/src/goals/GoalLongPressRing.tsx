import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import { GOALS_THEME } from "./theme";

import "./goalsHoldTarget.css";

const HOLD_MS = 1000;
const MOVE_THRESHOLD_PX = 12;
/** Presses longer than this (or with visible ring progress) are holds, not taps. */
const TAP_MAX_DURATION_MS = 280;

type GoalLongPressRingProps = {
  children: ReactNode;
  onTap: () => void;
  onHoldComplete: () => void;
  /** Disables long-press check-in only; tap still runs (e.g. open edit on paused goals). */
  holdDisabled?: boolean;
  /** Circle patch on mobile; full-width badge row on desktop. */
  layout?: "circle" | "badge";
};

/**
 * Tap opens edit; 1s hold with ring animation fires onHoldComplete.
 */
export function GoalLongPressRing({
  children,
  onTap,
  onHoldComplete,
  holdDisabled = false,
  layout = "circle",
}: GoalLongPressRingProps) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const progressRef = useRef(0);
  const holdCompletedRef = useRef(false);
  const isBadge = layout === "badge";

  const stopHoldTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressRef.current = 0;
    setProgress(0);
  }, []);

  const startHold = useCallback(
    (clientX: number, clientY: number) => {
      if (holdDisabled) return;
      holdCompletedRef.current = false;
      pointerStartRef.current = { x: clientX, y: clientY, at: performance.now() };
      const started = performance.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - started;
        const p = Math.min(1, elapsed / HOLD_MS);
        progressRef.current = p;
        setProgress(p);
        if (p >= 1 && !holdCompletedRef.current) {
          holdCompletedRef.current = true;
          onHoldComplete();
          stopHoldTimer();
        }
      }, 32);
    },
    [holdDisabled, onHoldComplete, stopHoldTimer],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    holdCompletedRef.current = false;
    pointerStartRef.current = { x: e.clientX, y: e.clientY, at: performance.now() };
    if (!holdDisabled) {
      startHold(e.clientX, e.clientY);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      stopHoldTimer();
      pointerStartRef.current = null;
    }
  };

  const onPointerUp = () => {
    const start = pointerStartRef.current;
    if (
      start &&
      !holdCompletedRef.current &&
      performance.now() - start.at < TAP_MAX_DURATION_MS &&
      progressRef.current < 0.08
    ) {
      onTap();
    }
    pointerStartRef.current = null;
    stopHoldTimer();
  };

  const ringOpacity = progress > 0 ? 0.9 : 0;

  return (
    <Box
      className="goals-hold-target"
      position="relative"
      width="100%"
      aspectRatio={isBadge ? undefined : 1}
      touchAction="manipulation"
      userSelect="none"
      cursor="pointer"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Box
        position="absolute"
        inset="-3px"
        borderRadius={isBadge ? "xl" : "full"}
        pointerEvents="none"
        opacity={ringOpacity}
        style={
          isBadge
            ? {
                background: `conic-gradient(${GOALS_THEME.gold} ${progress * 360}deg, transparent 0)`,
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "3px",
                borderRadius: "0.75rem",
              }
            : {
                background: `conic-gradient(${GOALS_THEME.gold} ${progress * 360}deg, transparent 0)`,
                WebkitMask:
                  "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                padding: "3px",
                borderRadius: "50%",
              }
        }
        aria-hidden
      />
      {children}
    </Box>
  );
}
