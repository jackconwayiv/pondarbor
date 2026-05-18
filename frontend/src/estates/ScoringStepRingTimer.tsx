import { Box, HStack, Text, useToken } from "@chakra-ui/react";
import { useEffect, useState } from "react";

import { APP_TEXT_SIZES } from "../theme/typography";
import { SCORING_STEP_DELAY_MS } from "./estatesPlayTheme";

type ScoringStepRingTimerProps = {
  waitingUntilMs: number;
  durationMs?: number;
  label?: string;
  size?: number;
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Ring fills clockwise from empty to full over the scoring step delay. */
export function ScoringStepRingTimer({
  waitingUntilMs,
  durationMs = SCORING_STEP_DELAY_MS,
  label = "Processing board…",
  size = 18,
}: ScoringStepRingTimerProps) {
  const [trackColor, fillColor] = useToken("colors", ["gray.300", "nautical.solid"]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const tick = () => {
      const remaining = waitingUntilMs - Date.now();
      const elapsed = durationMs - remaining;
      setProgress(clamp01(elapsed / durationMs));
    };

    tick();
    const id = window.setInterval(tick, 50);
    return () => window.clearInterval(id);
  }, [durationMs, waitingUntilMs]);

  const stroke = 2;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <HStack gap="2" align="center" justify="center">
      <Box
        as="span"
        display="inline-flex"
        flexShrink={0}
        w={`${size}px`}
        h={`${size}px`}
        aria-hidden
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={fillColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${center} ${center})`}
            style={{ transition: "stroke-dashoffset 0.05s linear" }}
          />
        </svg>
      </Box>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineClamp={2}>
        {label}
      </Text>
    </HStack>
  );
}
