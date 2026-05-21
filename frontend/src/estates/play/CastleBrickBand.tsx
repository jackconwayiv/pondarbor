import { useMemo } from "react";

/** Repeating dressed-stone tile for the castle wall band (64×56, running bond). */
function brickTileDataUrl(): string {
  const stoneA = "#a8a299";
  const stoneB = "#867f73";
  const stoneHi = "#c5bfb4";
  const stoneLo = "#5e574c";
  const mortar = "#3a352c";
  const w = 64;
  const h = 56;

  const stone = (x: number, y: number, wdt: number, hgt: number, fill: string, id: string) => `
    <path id="${id}" d="M ${x} ${y + 1} Q ${x + wdt * 0.3} ${y} ${x + wdt * 0.5} ${y + 0.5} Q ${x + wdt * 0.7} ${y + 1} ${x + wdt} ${y + 1.5}
       L ${x + wdt - 0.5} ${y + hgt - 1} Q ${x + wdt * 0.6} ${y + hgt} ${x + wdt * 0.4} ${y + hgt - 0.5}
       Q ${x + wdt * 0.2} ${y + hgt - 1} ${x + 0.5} ${y + hgt - 1.5} Z" fill="${fill}" stroke="${mortar}" stroke-width="0.6"/>
    <path d="M ${x + 1} ${y + 2} L ${x + wdt - 2} ${y + 2}" stroke="${stoneHi}" stroke-width="0.8" fill="none" opacity="0.7"/>
    <path d="M ${x + 1} ${y + hgt - 2} L ${x + wdt - 2} ${y + hgt - 2}" stroke="${stoneLo}" stroke-width="0.6" fill="none" opacity="0.5"/>
  `;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="sa" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${stoneHi}"/><stop offset="100%" stop-color="${stoneA}"/></linearGradient>
        <linearGradient id="sb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${stoneHi}"/><stop offset="100%" stop-color="${stoneB}"/></linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="${mortar}"/>
      ${stone(0, 2, 16, 24, "url(#sa)", "s1")}
      ${stone(16, 2, 16, 24, "url(#sb)", "s2")}
      ${stone(32, 2, 16, 24, "url(#sa)", "s3")}
      ${stone(48, 2, 16, 24, "url(#sb)", "s4")}
      ${stone(-6, 30, 16, 24, "url(#sb)", "s5")}
      ${stone(10, 30, 16, 24, "url(#sa)", "s6")}
      ${stone(26, 30, 16, 24, "url(#sb)", "s7")}
      ${stone(42, 30, 16, 24, "url(#sa)", "s8")}
      ${stone(58, 30, 8, 24, "url(#sb)", "s9")}
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
