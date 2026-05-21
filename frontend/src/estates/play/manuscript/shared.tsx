import type { SVGProps } from "react";

/** Palette tokens — mirror playCanvas.css manuscript vars. */
export const MS = {
  ink: "var(--ink)",
  inkSoft: "var(--ink-soft)",
  parchment: "var(--parchment)",
  parchmentDeep: "var(--parchment-deep)",
  parchmentDark: "var(--parchment-dark)",
  gilt: "var(--gilt)",
  giltDeep: "var(--gilt-deep)",
  giltSoft: "var(--gilt-soft)",
  lapis: "var(--lapis)",
  lapisWash: "var(--lapis-wash)",
  vermilion: "var(--vermilion)",
  vermilionWash: "var(--vermilion-wash)",
  verdigris: "var(--verdigris)",
  verdigrisWash: "var(--verdigris-wash)",
  royal: "var(--royal)",
} as const;

const INK_STROKE = { stroke: MS.ink, strokeWidth: 0.6, strokeLinejoin: "round" as const };

/** Reusable gradients and subtle parchment texture for zone miniatures. */
export function ManuscriptDefs({ prefix = "ms" }: { prefix?: string }) {
  const p = prefix;
  return (
    <defs>
      <linearGradient id={`${p}-gilt`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--gilt-soft)" />
        <stop offset="55%" stopColor="var(--gilt)" />
        <stop offset="100%" stopColor="var(--gilt-deep)" />
      </linearGradient>
      <linearGradient id={`${p}-sky`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--lapis-wash)" />
        <stop offset="55%" stopColor="var(--lapis-wash-dim)" />
        <stop offset="100%" stopColor="var(--lapis)" stopOpacity="0.45" />
      </linearGradient>
      <linearGradient id={`${p}-field`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--verdigris-wash)" />
        <stop offset="50%" stopColor="var(--verdigris-wash-dim)" />
        <stop offset="100%" stopColor="var(--verdigris)" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id={`${p}-vermilion`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--vermilion-wash)" />
        <stop offset="100%" stopColor="var(--vermilion)" stopOpacity="0.9" />
      </linearGradient>
      {/* Tower — half golden sky (top), half deep lapis (bottom), horizon ~50% */}
      <linearGradient id={`${p}-sunset`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--gilt-soft)" />
        <stop offset="48%" stopColor="var(--royal-wash)" />
        <stop offset="50%" stopColor="var(--lapis-wash-dim)" />
        <stop offset="100%" stopColor="var(--lapis)" stopOpacity="0.8" />
      </linearGradient>
      {/* Throne room — candlelit yellow hall (throne itself stays vermilion) */}
      <linearGradient id={`${p}-throne-hall`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--royal-wash)" />
        <stop offset="55%" stopColor="var(--royal-wash-dim)" />
        <stop offset="100%" stopColor="var(--gilt-soft)" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id={`${p}-stone`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--parchment-dark)" />
        <stop offset="100%" stopColor="var(--ink-soft)" stopOpacity="0.55" />
      </linearGradient>
    </defs>
  );
}

/** Rounded wash fill inside the miniature panel. */
export function WashPanel({
  fill,
  x = 4,
  y = 6,
  w = 56,
  h = 32,
  rx = 1,
}: {
  fill: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rx?: number;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} />;
}

/** Ink-outlined filled path. */
export function InkShape({
  d,
  fill,
  strokeWidth = 0.9,
  opacity,
}: {
  d: string;
  fill: string;
  strokeWidth?: number;
  opacity?: number;
}) {
  return (
    <path
      d={d}
      fill={fill}
      stroke={MS.ink}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

/** Stroke-only ink line. */
export function InkLine({ d, strokeWidth = 0.75 }: { d: string; strokeWidth?: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={MS.ink}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );
}

/** Arched gilt border with inner ink hairline — replaces rect-based ArchFrame. */
export function ManuscriptFrame({ prefix = "ms" }: { prefix?: string }) {
  const gilt = `url(#${prefix}-gilt)`;
  return (
    <g>
      {/* outer gilt band */}
      <path
        d="M 2 5 L 2 38 L 62 38 L 62 5 Q 32 0 2 5 Z"
        fill="none"
        stroke={gilt}
        strokeWidth={2.6}
        strokeLinejoin="round"
      />
      <path
        d="M 3 6 L 3 37 L 61 37 L 61 6 Q 32 2 3 6 Z"
        fill="none"
        stroke={MS.giltDeep}
        strokeWidth={0.8}
        strokeLinejoin="round"
      />
      {/* corner flourishes */}
      <circle cx="4" cy="4" r="1.2" fill={MS.giltSoft} stroke={MS.ink} strokeWidth={0.4} />
      <circle cx="60" cy="4" r="1.2" fill={MS.giltSoft} stroke={MS.ink} strokeWidth={0.4} />
      <circle cx="4" cy="36" r="1" fill={MS.giltSoft} stroke={MS.ink} strokeWidth={0.4} />
      <circle cx="60" cy="36" r="1" fill={MS.giltSoft} stroke={MS.ink} strokeWidth={0.4} />
      {/* inner ink hairline */}
      <rect
        x="3.5"
        y="6.5"
        width="57"
        height="30"
        rx="0.5"
        fill="none"
        stroke={MS.ink}
        strokeWidth={0.65}
      />
    </g>
  );
}

export function ZoneSvg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 44" preserveAspectRatio="xMidYMid meet" {...rest}>
      <ManuscriptDefs />
      {children}
    </svg>
  );
}

/** Heraldic glyph wrapper — 16×16 viewBox, anti-aliased. */
export function GlyphSvg({
  size = 24,
  children,
  ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...rest}>
      <ManuscriptDefs prefix="glyph" />
      {children}
    </svg>
  );
}

export { INK_STROKE };
