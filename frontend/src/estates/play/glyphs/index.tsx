import type { SVGProps } from "react";

import type { CanonicalSuit } from "../../estatesDropRules";

export type GlyphProps = SVGProps<SVGSVGElement> & {
  size?: number;
  /** Wash color of the glyph fill. Defaults to `currentColor`. */
  color?: string;
};

type RowSpec = string;
type Pixel = { x: number; y: number; w?: number; h?: number; fill?: string };

/** Convert a 16-row art string ("#" = ink, "*" = gilt highlight, "X" = primary, "." = empty) to rects. */
function rowsToRects(
  rows: RowSpec[],
  primary: string,
  ink = "var(--ink)",
  gilt = "var(--gilt-deep)",
): Pixel[] {
  const out: Pixel[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") out.push({ x, y, fill: ink });
      else if (cell === "*") out.push({ x, y, fill: gilt });
      else if (cell === "X") out.push({ x, y, fill: primary });
    });
  });
  return out;
}

function PixelArt({
  rows,
  primary,
  size,
  ink,
  gilt,
  ...rest
}: GlyphProps & { rows: RowSpec[]; primary: string; ink?: string; gilt?: string }) {
  const rects = rowsToRects(rows, primary, ink, gilt);
  const dim = rows.length;
  return (
    <svg
      width={size ?? 24}
      height={size ?? 24}
      viewBox={`0 0 ${dim} ${dim}`}
      shapeRendering="crispEdges"
      {...rest}
    >
      {rects.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.w ?? 1} height={p.h ?? 1} fill={p.fill} />
      ))}
    </svg>
  );
}

const PITCHFORK_ROWS: RowSpec[] = [
  "................",
  "................",
  "..#...#...#.....",
  "..#...#...#.....",
  "..#...#...#.....",
  "..#XX#XX#X#.....",
  "..#XXXXXXX#.....",
  "..#XXXXX*X#.....",
  "...########.....",
  "......##........",
  "......##........",
  "......##........",
  "......##........",
  "......##........",
  ".....####.......",
  "................",
];

const SHIELD_ROWS: RowSpec[] = [
  "................",
  "..############..",
  "..#XXXXXXXXXX#..",
  "..#X*XXXXXX*X#..",
  "..#XXXXXXXXXX#..",
  "..#XX######XX#..",
  "..#XX#XXXX#XX#..",
  "..#XX#XX*X#XX#..",
  "..#XX#XXXX#XX#..",
  "..#XX######XX#..",
  "..#XXXXXXXXXX#..",
  "...#XXXXXXXX#...",
  "....#XXXXXX#....",
  ".....#XXXX#.....",
  "......####......",
  "................",
];

const CROWN_ROWS: RowSpec[] = [
  "................",
  "................",
  "..*...*...*.....",
  ".*.*.*.*.*.*....",
  ".###.###.###....",
  ".#X#.#X#.#X#....",
  ".#X###X###X#....",
  ".#XXXXXXXXX#....",
  ".#X*XX*XX*X#....",
  ".#XXXXXXXXX#....",
  ".###########....",
  "................",
  "................",
  "................",
  "................",
  "................",
];

export function PitchforkGlyph({ size = 24, color, ...rest }: GlyphProps) {
  return <PixelArt rows={PITCHFORK_ROWS} primary={color ?? "var(--verdigris)"} size={size} {...rest} />;
}

export function HeraldicShieldGlyph({ size = 24, color, ...rest }: GlyphProps) {
  return <PixelArt rows={SHIELD_ROWS} primary={color ?? "var(--lapis)"} size={size} {...rest} />;
}

export function CrownGlyph({ size = 24, color, ...rest }: GlyphProps) {
  return <PixelArt rows={CROWN_ROWS} primary={color ?? "var(--royal)"} size={size} {...rest} />;
}

export function SuitGlyph({
  suit,
  ...rest
}: GlyphProps & { suit: CanonicalSuit | "" | string }) {
  if (suit === "royal") return <CrownGlyph {...rest} />;
  if (suit === "noble") return <HeraldicShieldGlyph {...rest} />;
  return <PitchforkGlyph {...rest} />;
}

export function PermanentBonusStar({ size = 16, color }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden
    >
      <g fill={color ?? "var(--gilt-deep)"}>
        <rect x="7" y="2" width="2" height="3" />
        <rect x="6" y="4" width="4" height="1" />
        <rect x="2" y="6" width="12" height="2" />
        <rect x="3" y="8" width="10" height="1" />
        <rect x="4" y="9" width="2" height="3" />
        <rect x="10" y="9" width="2" height="3" />
        <rect x="3" y="11" width="2" height="2" />
        <rect x="11" y="11" width="2" height="2" />
      </g>
      <g fill="var(--ink)">
        <rect x="7" y="3" width="2" height="1" />
        <rect x="2" y="7" width="12" height="1" />
      </g>
    </svg>
  );
}
