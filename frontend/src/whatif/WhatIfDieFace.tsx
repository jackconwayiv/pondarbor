/** SVG die face with standard pip layouts for values 1–6. */

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.28, 0.28],
    [0.72, 0.72],
  ],
  3: [
    [0.28, 0.28],
    [0.5, 0.5],
    [0.72, 0.72],
  ],
  4: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  5: [
    [0.28, 0.28],
    [0.72, 0.28],
    [0.5, 0.5],
    [0.28, 0.72],
    [0.72, 0.72],
  ],
  6: [
    [0.28, 0.28],
    [0.28, 0.5],
    [0.28, 0.72],
    [0.72, 0.28],
    [0.72, 0.5],
    [0.72, 0.72],
  ],
};

type WhatIfDieFaceProps = {
  value: number;
  /** Square size in same coordinate units as parent (viewBox or px). */
  size: number;
  cx: number;
  cy: number;
  /** Nautical / dark scoreboard panel — white die, dark pips. */
  onDarkBackground?: boolean;
};

export function WhatIfDieFace({ value, size, cx, cy, onDarkBackground = false }: WhatIfDieFaceProps) {
  const n = Math.max(1, Math.min(6, Math.round(value)));
  const pips = PIP_POSITIONS[n] ?? PIP_POSITIONS[1];
  const half = size / 2;
  const x0 = cx - half;
  const y0 = cy - half;
  const corner = size * 0.14;
  const pipR = size * 0.085;
  const bodyFill = onDarkBackground ? "#ffffff" : "#ffffff";
  const bodyStroke = onDarkBackground ? "rgba(255,255,255,0.35)" : "var(--chakra-colors-border, #d4d4d8)";
  const pipFill = onDarkBackground ? "#1a2744" : "#18181b";

  return (
    <g aria-hidden>
      <rect
        x={x0}
        y={y0}
        width={size}
        height={size}
        rx={corner}
        ry={corner}
        fill={bodyFill}
        stroke={bodyStroke}
        strokeWidth={size * 0.04}
      />
      {pips.map(([px, py], i) => (
        <circle
          key={i}
          cx={x0 + px * size}
          cy={y0 + py * size}
          r={pipR}
          fill={pipFill}
        />
      ))}
    </g>
  );
}
