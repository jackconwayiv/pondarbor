import { useEffect, useState } from "react";

import { SCORING_STEP_DELAY_MS } from "./estatesPlayTheme";

export type ScoringStepHourglassTimerProps = {
  waitingUntilMs: number;
  durationMs?: number;
  label?: string;
  size?: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Spinning hourglass with a "sand" fraction that drains as the scoring step delay elapses.
 * Replaces the previous ring timer; same prop shape so call sites switch trivially. */
export function ScoringStepHourglassTimer({
  waitingUntilMs,
  durationMs = SCORING_STEP_DELAY_MS,
  label = "Processing board…",
  size = 22,
}: ScoringStepHourglassTimerProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const tick = () => {
      const remaining = waitingUntilMs - Date.now();
      const elapsed = durationMs - remaining;
      setProgress(clamp01(elapsed / durationMs));
    };

    tick();
    const id = window.setInterval(tick, 60);
    return () => window.clearInterval(id);
  }, [durationMs, waitingUntilMs]);

  /* Top chamber drains (fills less as time passes); bottom chamber fills. */
  const remaining = 1 - progress;
  /* Chamber dims (viewBox is 22x22). Top inner triangle: from y=5 down to y=10, base x=6..16. */
  const topMaxH = 5; // pixels of sand height when full
  const botMaxH = 5;
  const topSandH = remaining * topMaxH;
  const botSandH = progress * botMaxH;

  return (
    <span className="estates-hourglass" role="status" aria-live="polite">
      <svg
        className="estates-hourglass__svg"
        width={size}
        height={size}
        viewBox="0 0 22 22"
        aria-hidden
      >
        {/* outer frame */}
        <g stroke="var(--ink, #2a1d10)" strokeWidth="1.5" fill="none" strokeLinejoin="round">
          {/* caps */}
          <line x1="4" y1="3" x2="18" y2="3" />
          <line x1="4" y1="19" x2="18" y2="19" />
          {/* glass funnels */}
          <path d="M5 3 L17 3 L11 11 L5 3 Z" fill="rgba(241,231,207,0.6)" stroke="var(--ink, #2a1d10)" />
          <path d="M5 19 L17 19 L11 11 L5 19 Z" fill="rgba(241,231,207,0.6)" stroke="var(--ink, #2a1d10)" />
          {/* gilt cap accents */}
          <line x1="4" y1="3" x2="18" y2="3" stroke="var(--gilt-deep, #a87a17)" strokeWidth="1" />
          <line x1="4" y1="19" x2="18" y2="19" stroke="var(--gilt-deep, #a87a17)" strokeWidth="1" />
        </g>
        {/* sand: top chamber (sand piled near the top) */}
        <path
          d={`M${11 - (5 + topSandH) / 2 + 0.5} ${4} L${11 + (5 + topSandH) / 2 - 0.5} ${4} L${
            11 + (5 - topSandH) / 2 - 0.5
          } ${4 + topSandH} L${11 - (5 - topSandH) / 2 + 0.5} ${4 + topSandH} Z`}
          fill="var(--gilt, #d4a83a)"
          opacity={remaining > 0.02 ? 1 : 0}
        />
        {/* sand: bottom chamber (settles at the bottom) */}
        <path
          d={`M${11 - (5 - botSandH) / 2 + 0.5} ${18 - botSandH} L${
            11 + (5 - botSandH) / 2 - 0.5
          } ${18 - botSandH} L${11 + (5 + botSandH) / 2 - 0.5} ${18} L${
            11 - (5 + botSandH) / 2 + 0.5
          } ${18} Z`}
          fill="var(--gilt, #d4a83a)"
          opacity={progress > 0.02 ? 1 : 0}
        />
        {/* falling grain stream */}
        {progress > 0.04 && progress < 0.96 ? (
          <rect x="10.5" y="10.5" width="1" height="2" fill="var(--gilt, #d4a83a)" />
        ) : null}
      </svg>
      <span className="estates-hourglass__label">{label}</span>
    </span>
  );
}
