import { useMemo } from "react";

/** Repeating pixel-art stone tile used as the castle wall band. Warm grays
 * (not red bricks) — the wall is dressed castle stone, not Roman brick. */
function brickTileDataUrl(): string {
  const stoneA = "#a8a299";
  const stoneB = "#867f73";
  const stoneHi = "#c5bfb4";
  const stoneLo = "#5e574c";
  const mortar = "#3a352c";
  const w = 64;
  const h = 56;
  /* Two rows of dressed stones offset by half a stone (running bond). */
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">
      <rect width="${w}" height="${h}" fill="${mortar}"/>
      <!-- top row: 4 stones across -->
      <rect x="0" y="2" width="16" height="24" fill="${stoneA}"/>
      <rect x="16" y="2" width="16" height="24" fill="${stoneB}"/>
      <rect x="32" y="2" width="16" height="24" fill="${stoneA}"/>
      <rect x="48" y="2" width="16" height="24" fill="${stoneB}"/>
      <!-- bottom row: offset half a stone -->
      <rect x="-8" y="30" width="16" height="24" fill="${stoneB}"/>
      <rect x="8" y="30" width="16" height="24" fill="${stoneA}"/>
      <rect x="24" y="30" width="16" height="24" fill="${stoneB}"/>
      <rect x="40" y="30" width="16" height="24" fill="${stoneA}"/>
      <rect x="56" y="30" width="16" height="24" fill="${stoneB}"/>
      <!-- top highlight + bottom shadow on each stone (sunlight from above) -->
      <rect x="0" y="2" width="16" height="1" fill="${stoneHi}"/>
      <rect x="16" y="2" width="16" height="1" fill="${stoneHi}"/>
      <rect x="32" y="2" width="16" height="1" fill="${stoneHi}"/>
      <rect x="48" y="2" width="16" height="1" fill="${stoneHi}"/>
      <rect x="0" y="25" width="64" height="1" fill="${stoneLo}"/>
      <rect x="-8" y="30" width="16" height="1" fill="${stoneHi}"/>
      <rect x="8" y="30" width="16" height="1" fill="${stoneHi}"/>
      <rect x="24" y="30" width="16" height="1" fill="${stoneHi}"/>
      <rect x="40" y="30" width="16" height="1" fill="${stoneHi}"/>
      <rect x="56" y="30" width="16" height="1" fill="${stoneHi}"/>
      <rect x="0" y="53" width="64" height="1" fill="${stoneLo}"/>
      <!-- vertical mortar seams between stones -->
      <rect x="15" y="2" width="2" height="24" fill="${mortar}"/>
      <rect x="31" y="2" width="2" height="24" fill="${mortar}"/>
      <rect x="47" y="2" width="2" height="24" fill="${mortar}"/>
      <rect x="7" y="30" width="2" height="24" fill="${mortar}"/>
      <rect x="23" y="30" width="2" height="24" fill="${mortar}"/>
      <rect x="39" y="30" width="2" height="24" fill="${mortar}"/>
      <rect x="55" y="30" width="2" height="24" fill="${mortar}"/>
    </svg>
  `.trim();
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

export function CastleBrickBand() {
  const tile = useMemo(() => brickTileDataUrl(), []);
  return (
    <div
      className="estates-brick-band"
      style={{ ["--brick-tile" as string]: tile }}
      aria-hidden
    />
  );
}
