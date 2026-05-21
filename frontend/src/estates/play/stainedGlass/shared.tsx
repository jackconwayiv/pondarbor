import type { SVGProps } from "react";

/** Stained-glass palette — uses playCanvas.css vars. */
export const SG = {
  ink: "var(--ink)",
  inkSoft: "var(--ink-soft)",
  parchmentDark: "var(--parchment-dark)",
  stone: "var(--stone)",
  stoneMedium: "var(--stone-medium)",
  gilt: "var(--gilt)",
  giltDeep: "var(--gilt-deep)",
  giltSoft: "var(--gilt-soft)",
  lapis: "var(--lapis)",
  lapisWash: "var(--lapis-wash)",
  lapisWashDim: "var(--lapis-wash-dim)",
  vermilion: "var(--vermilion)",
  verdigris: "var(--verdigris)",
  verdigrisWash: "var(--verdigris-wash)",
  verdigrisWashDim: "var(--verdigris-wash-dim)",
  royalWash: "var(--royal-wash)",
  royalWashDim: "var(--royal-wash-dim)",
} as const;

const LEAD = {
  stroke: SG.ink,
  strokeWidth: 1.15,
  strokeLinejoin: "miter" as const,
  strokeLinecap: "square" as const,
};

export function GlassDefs({ prefix = "sg" }: { prefix?: string }) {
  const p = prefix;
  const grad = (id: string, top: string, bottom: string) => (
    <linearGradient id={`${p}-${id}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={top} />
      <stop offset="100%" stopColor={bottom} />
    </linearGradient>
  );
  return (
    <defs>
      {grad("green", SG.verdigrisWash, SG.verdigris)}
      {grad("green-dim", SG.verdigrisWashDim, SG.verdigrisWash)}
      {grad("blue", SG.lapisWash, SG.lapisWashDim)}
      {grad("blue-deep", SG.lapisWashDim, SG.lapis)}
      {grad("yellow", SG.giltSoft, SG.royalWash)}
      {grad("yellow-deep", SG.royalWash, SG.gilt)}
      {grad("gold", SG.giltSoft, SG.giltDeep)}
      {grad("stone", SG.parchmentDark, SG.stoneMedium)}
      {grad("red", "var(--vermilion-wash)", SG.vermilion)}
    </defs>
  );
}

/** Colored glass pane with lead came outline. */
export function GlassPane({
  d,
  fill,
  opacity = 0.92,
  strokeWidth = LEAD.strokeWidth,
}: {
  d: string;
  fill: string;
  opacity?: number;
  strokeWidth?: number;
}) {
  return (
    <path
      d={d}
      fill={fill}
      fillOpacity={opacity}
      stroke={SG.ink}
      strokeWidth={strokeWidth}
      strokeLinejoin="miter"
      strokeLinecap="square"
    />
  );
}

/** Lead divider between panes (no fill). */
export function LeadLine({
  d,
  strokeWidth = LEAD.strokeWidth,
}: {
  d: string;
  strokeWidth?: number;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={SG.ink}
      strokeWidth={strokeWidth}
      strokeLinejoin="miter"
      strokeLinecap="square"
    />
  );
}

/** Zone illumination coordinate space (width × height). */
export const ZONE_VIEW_W = 64;
export const ZONE_VIEW_H = 44;

export function ZoneSvg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={`0 0 ${ZONE_VIEW_W} ${ZONE_VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      {...rest}
    >
      <GlassDefs />
      {children}
    </svg>
  );
}

/** Shorthand fills referencing GlassDefs gradients. */
export const glass = {
  green: "url(#sg-green)",
  greenDim: "url(#sg-green-dim)",
  blue: "url(#sg-blue)",
  blueDeep: "url(#sg-blue-deep)",
  yellow: "url(#sg-yellow)",
  yellowDeep: "url(#sg-yellow-deep)",
  gold: "url(#sg-gold)",
  stone: "url(#sg-stone)",
  red: "url(#sg-red)",
} as const;
