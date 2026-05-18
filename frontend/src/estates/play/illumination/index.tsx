/* Pixel-art illuminated-manuscript scenes for each zone backdrop.
 * Each scene renders inside an arched gilt frame on a parchment-deep ground.
 * 64x40 pixel grid, scaled with shape-rendering: crispEdges. */
import type { SVGProps } from "react";

import type { ZoneName } from "../../estatesDropRules";

const PALETTE = {
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
  mortar: "var(--mortar)",
  brickA: "var(--brick-a)",
  brickB: "var(--brick-b)",
} as const;

type Pix = { x: number; y: number; w?: number; h?: number; fill: string };

function px(pixels: Pix[]) {
  return pixels.map((p, i) => (
    <rect key={i} x={p.x} y={p.y} width={p.w ?? 1} height={p.h ?? 1} fill={p.fill} />
  ));
}

/** Common arched gilt frame stroked just inside the viewbox. */
function ArchFrame() {
  const frame: Pix[] = [
    /* top arch corners */
    { x: 2, y: 4, w: 60, h: 1, fill: PALETTE.gilt },
    { x: 2, y: 5, w: 60, h: 1, fill: PALETTE.giltDeep },
    /* sides */
    { x: 1, y: 5, w: 1, h: 33, fill: PALETTE.gilt },
    { x: 2, y: 5, w: 1, h: 33, fill: PALETTE.giltDeep },
    { x: 61, y: 5, w: 1, h: 33, fill: PALETTE.giltDeep },
    { x: 62, y: 5, w: 1, h: 33, fill: PALETTE.gilt },
    /* bottom */
    { x: 1, y: 38, w: 62, h: 1, fill: PALETTE.gilt },
    { x: 1, y: 39, w: 62, h: 1, fill: PALETTE.giltDeep },
    /* arch curves at the top corners */
    { x: 2, y: 3, w: 6, h: 1, fill: PALETTE.gilt },
    { x: 3, y: 2, w: 4, h: 1, fill: PALETTE.gilt },
    { x: 4, y: 1, w: 2, h: 1, fill: PALETTE.gilt },
    { x: 56, y: 3, w: 6, h: 1, fill: PALETTE.gilt },
    { x: 57, y: 2, w: 4, h: 1, fill: PALETTE.gilt },
    { x: 58, y: 1, w: 2, h: 1, fill: PALETTE.gilt },
    /* inner ink hairline */
    { x: 3, y: 6, w: 58, h: 1, fill: PALETTE.ink },
    { x: 3, y: 37, w: 58, h: 1, fill: PALETTE.ink },
    { x: 3, y: 6, w: 1, h: 32, fill: PALETTE.ink },
    { x: 60, y: 6, w: 1, h: 32, fill: PALETTE.ink },
  ];
  return <g>{px(frame)}</g>;
}

function Backdrop({ fill = PALETTE.parchmentDeep }: { fill?: string }) {
  return <rect x="4" y="6" width="56" height="32" fill={fill} />;
}

function ZoneSvg({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 40" preserveAspectRatio="xMidYMid meet" shapeRendering="crispEdges" {...rest}>
      {children}
    </svg>
  );
}

/** Gate — stone arch, portcullis, banners on either side. */
export function GateIllumination(props: SVGProps<SVGSVGElement>) {
  const stones: Pix[] = [
    /* arch surround stones */
    { x: 10, y: 14, w: 4, h: 12, fill: PALETTE.parchmentDark },
    { x: 50, y: 14, w: 4, h: 12, fill: PALETTE.parchmentDark },
    { x: 14, y: 12, w: 36, h: 2, fill: PALETTE.parchmentDark },
    /* stone hatches */
    { x: 11, y: 16, w: 2, h: 1, fill: PALETTE.ink },
    { x: 11, y: 20, w: 2, h: 1, fill: PALETTE.ink },
    { x: 51, y: 16, w: 2, h: 1, fill: PALETTE.ink },
    { x: 51, y: 20, w: 2, h: 1, fill: PALETTE.ink },
    { x: 18, y: 12, w: 2, h: 1, fill: PALETTE.ink },
    { x: 26, y: 12, w: 2, h: 1, fill: PALETTE.ink },
    { x: 34, y: 12, w: 2, h: 1, fill: PALETTE.ink },
    { x: 42, y: 12, w: 2, h: 1, fill: PALETTE.ink },
  ];
  const opening: Pix[] = [
    /* dark archway opening */
    { x: 14, y: 14, w: 36, h: 12, fill: PALETTE.ink },
    /* portcullis bars (vermilion) */
    { x: 17, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 21, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 25, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 29, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 33, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 37, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 41, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    { x: 45, y: 15, w: 1, h: 10, fill: PALETTE.gilt },
    /* horizontal portcullis bands */
    { x: 14, y: 18, w: 36, h: 1, fill: PALETTE.gilt },
    { x: 14, y: 22, w: 36, h: 1, fill: PALETTE.gilt },
  ];
  const banners: Pix[] = [
    /* left pennant */
    { x: 6, y: 14, w: 1, h: 14, fill: PALETTE.ink },
    { x: 4, y: 16, w: 3, h: 6, fill: PALETTE.vermilion },
    { x: 4, y: 22, w: 1, h: 1, fill: PALETTE.vermilion },
    { x: 5, y: 23, w: 1, h: 1, fill: PALETTE.vermilion },
    { x: 5, y: 18, w: 1, h: 1, fill: PALETTE.gilt },
    /* right pennant */
    { x: 57, y: 14, w: 1, h: 14, fill: PALETTE.ink },
    { x: 57, y: 16, w: 3, h: 6, fill: PALETTE.vermilion },
    { x: 59, y: 22, w: 1, h: 1, fill: PALETTE.vermilion },
    { x: 58, y: 23, w: 1, h: 1, fill: PALETTE.vermilion },
    { x: 58, y: 18, w: 1, h: 1, fill: PALETTE.gilt },
  ];
  const ground: Pix[] = [
    { x: 4, y: 30, w: 56, h: 2, fill: PALETTE.verdigris },
    { x: 4, y: 32, w: 56, h: 1, fill: PALETTE.verdigrisWash },
  ];
  return (
    <ZoneSvg {...props}>
      <Backdrop fill={PALETTE.lapisWash} />
      {px(ground)}
      {px(stones)}
      {px(opening)}
      {px(banners)}
      <ArchFrame />
    </ZoneSvg>
  );
}

/** Farm — wheat sheaves, fence, sun. */
export function FarmIllumination(props: SVGProps<SVGSVGElement>) {
  const sky: Pix[] = [
    { x: 4, y: 6, w: 56, h: 14, fill: PALETTE.lapisWash },
  ];
  const sun: Pix[] = [
    { x: 50, y: 9, w: 6, h: 6, fill: PALETTE.gilt },
    { x: 51, y: 8, w: 4, h: 1, fill: PALETTE.giltSoft },
    { x: 51, y: 15, w: 4, h: 1, fill: PALETTE.giltSoft },
    { x: 49, y: 10, w: 1, h: 4, fill: PALETTE.giltSoft },
    { x: 56, y: 10, w: 1, h: 4, fill: PALETTE.giltSoft },
    /* sun rays */
    { x: 48, y: 7, w: 1, h: 1, fill: PALETTE.gilt },
    { x: 57, y: 7, w: 1, h: 1, fill: PALETTE.gilt },
    { x: 48, y: 16, w: 1, h: 1, fill: PALETTE.gilt },
    { x: 57, y: 16, w: 1, h: 1, fill: PALETTE.gilt },
  ];
  const ground: Pix[] = [
    { x: 4, y: 20, w: 56, h: 18, fill: PALETTE.verdigrisWash },
    /* rolling field rows */
    { x: 4, y: 22, w: 56, h: 1, fill: PALETTE.verdigris },
    { x: 4, y: 26, w: 56, h: 1, fill: PALETTE.verdigris },
    { x: 4, y: 30, w: 56, h: 1, fill: PALETTE.verdigris },
    { x: 4, y: 34, w: 56, h: 1, fill: PALETTE.verdigris },
  ];
  const sheaf = (cx: number, baseY: number): Pix[] => [
    /* stalks */
    { x: cx - 2, y: baseY - 8, w: 1, h: 8, fill: PALETTE.gilt },
    { x: cx, y: baseY - 9, w: 1, h: 9, fill: PALETTE.gilt },
    { x: cx + 2, y: baseY - 8, w: 1, h: 8, fill: PALETTE.gilt },
    /* binding */
    { x: cx - 2, y: baseY - 4, w: 5, h: 1, fill: PALETTE.giltDeep },
    /* heads */
    { x: cx - 2, y: baseY - 10, w: 1, h: 1, fill: PALETTE.giltSoft },
    { x: cx, y: baseY - 11, w: 1, h: 1, fill: PALETTE.giltSoft },
    { x: cx + 2, y: baseY - 10, w: 1, h: 1, fill: PALETTE.giltSoft },
  ];
  const fence: Pix[] = [
    { x: 4, y: 24, w: 56, h: 1, fill: PALETTE.ink },
    { x: 8, y: 21, w: 1, h: 5, fill: PALETTE.ink },
    { x: 18, y: 21, w: 1, h: 5, fill: PALETTE.ink },
    { x: 28, y: 21, w: 1, h: 5, fill: PALETTE.ink },
    { x: 38, y: 21, w: 1, h: 5, fill: PALETTE.ink },
    { x: 48, y: 21, w: 1, h: 5, fill: PALETTE.ink },
  ];
  return (
    <ZoneSvg {...props}>
      <Backdrop fill={PALETTE.lapisWash} />
      {px(sky)}
      {px(sun)}
      {px(ground)}
      {px(fence)}
      {px(sheaf(14, 36))}
      {px(sheaf(26, 36))}
      {px(sheaf(38, 36))}
      <ArchFrame />
    </ZoneSvg>
  );
}

/** Road — cobbled path receding, signpost on the side. */
export function RoadIllumination(props: SVGProps<SVGSVGElement>) {
  const sky: Pix[] = [
    { x: 4, y: 6, w: 56, h: 14, fill: PALETTE.lapisWash },
  ];
  const meadow: Pix[] = [
    { x: 4, y: 20, w: 56, h: 18, fill: PALETTE.verdigrisWash },
  ];
  const road: Pix[] = [];
  /* trapezoidal road, narrowing as it recedes */
  for (let y = 20; y < 38; y++) {
    const inset = Math.floor(((y - 20) * 22) / 18);
    const x1 = 22 + inset;
    const width = 64 - 2 * (22 + inset);
    road.push({ x: x1, y, w: width, h: 1, fill: PALETTE.parchmentDark });
  }
  /* cobbles */
  const cobbles: Pix[] = [
    { x: 24, y: 36, w: 2, h: 1, fill: PALETTE.ink },
    { x: 28, y: 34, w: 2, h: 1, fill: PALETTE.ink },
    { x: 32, y: 32, w: 2, h: 1, fill: PALETTE.ink },
    { x: 36, y: 30, w: 2, h: 1, fill: PALETTE.ink },
    { x: 38, y: 28, w: 2, h: 1, fill: PALETTE.ink },
    { x: 30, y: 36, w: 2, h: 1, fill: PALETTE.inkSoft },
    { x: 34, y: 34, w: 2, h: 1, fill: PALETTE.inkSoft },
    { x: 28, y: 32, w: 2, h: 1, fill: PALETTE.inkSoft },
  ];
  /* signpost */
  const sign: Pix[] = [
    { x: 12, y: 20, w: 1, h: 14, fill: PALETTE.ink },
    { x: 8, y: 19, w: 8, h: 4, fill: PALETTE.parchmentDark },
    { x: 8, y: 19, w: 8, h: 1, fill: PALETTE.ink },
    { x: 8, y: 22, w: 8, h: 1, fill: PALETTE.ink },
    { x: 8, y: 19, w: 1, h: 4, fill: PALETTE.ink },
    { x: 15, y: 19, w: 1, h: 4, fill: PALETTE.ink },
    { x: 10, y: 21, w: 4, h: 1, fill: PALETTE.ink },
  ];
  /* milestone */
  const milestone: Pix[] = [
    { x: 50, y: 33, w: 4, h: 4, fill: PALETTE.parchmentDark },
    { x: 50, y: 33, w: 4, h: 1, fill: PALETTE.ink },
    { x: 50, y: 33, w: 1, h: 4, fill: PALETTE.ink },
    { x: 53, y: 33, w: 1, h: 4, fill: PALETTE.ink },
    { x: 51, y: 35, w: 2, h: 1, fill: PALETTE.ink },
  ];
  return (
    <ZoneSvg {...props}>
      <Backdrop fill={PALETTE.lapisWash} />
      {px(sky)}
      {px(meadow)}
      {px(road)}
      {px(cobbles)}
      {px(sign)}
      {px(milestone)}
      <ArchFrame />
    </ZoneSvg>
  );
}

/** Tower — single crenellated turret, arrow slits, pennant. */
export function TowerIllumination(props: SVGProps<SVGSVGElement>) {
  const sky: Pix[] = [
    { x: 4, y: 6, w: 56, h: 30, fill: PALETTE.lapisWash },
  ];
  const ground: Pix[] = [
    { x: 4, y: 36, w: 56, h: 2, fill: PALETTE.verdigris },
  ];
  /* tower body */
  const body: Pix[] = [
    { x: 25, y: 14, w: 14, h: 22, fill: PALETTE.parchmentDark },
    { x: 25, y: 14, w: 14, h: 1, fill: PALETTE.ink },
    { x: 25, y: 35, w: 14, h: 1, fill: PALETTE.ink },
    { x: 25, y: 14, w: 1, h: 22, fill: PALETTE.ink },
    { x: 38, y: 14, w: 1, h: 22, fill: PALETTE.ink },
    /* stone seams */
    { x: 26, y: 18, w: 12, h: 1, fill: PALETTE.inkSoft },
    { x: 26, y: 24, w: 12, h: 1, fill: PALETTE.inkSoft },
    { x: 26, y: 30, w: 12, h: 1, fill: PALETTE.inkSoft },
  ];
  /* crenellations */
  const crenel: Pix[] = [
    { x: 25, y: 11, w: 2, h: 3, fill: PALETTE.parchmentDark },
    { x: 28, y: 11, w: 2, h: 3, fill: PALETTE.parchmentDark },
    { x: 31, y: 11, w: 2, h: 3, fill: PALETTE.parchmentDark },
    { x: 34, y: 11, w: 2, h: 3, fill: PALETTE.parchmentDark },
    { x: 37, y: 11, w: 2, h: 3, fill: PALETTE.parchmentDark },
    /* outline */
    { x: 25, y: 11, w: 2, h: 1, fill: PALETTE.ink },
    { x: 28, y: 11, w: 2, h: 1, fill: PALETTE.ink },
    { x: 31, y: 11, w: 2, h: 1, fill: PALETTE.ink },
    { x: 34, y: 11, w: 2, h: 1, fill: PALETTE.ink },
    { x: 37, y: 11, w: 2, h: 1, fill: PALETTE.ink },
  ];
  /* arrow slits */
  const slits: Pix[] = [
    { x: 28, y: 20, w: 1, h: 3, fill: PALETTE.ink },
    { x: 35, y: 20, w: 1, h: 3, fill: PALETTE.ink },
    { x: 31, y: 27, w: 2, h: 4, fill: PALETTE.ink },
  ];
  /* pennant on top */
  const pennant: Pix[] = [
    { x: 31, y: 7, w: 1, h: 4, fill: PALETTE.ink },
    { x: 31, y: 7, w: 4, h: 1, fill: PALETTE.vermilion },
    { x: 32, y: 8, w: 3, h: 1, fill: PALETTE.vermilion },
    { x: 32, y: 9, w: 2, h: 1, fill: PALETTE.vermilion },
  ];
  return (
    <ZoneSvg {...props}>
      <Backdrop fill={PALETTE.parchmentDeep} />
      {px(sky)}
      {px(ground)}
      {px(body)}
      {px(crenel)}
      {px(slits)}
      {px(pennant)}
      <ArchFrame />
    </ZoneSvg>
  );
}

/** Throne — high-backed chair on dais, crown above. */
export function ThroneIllumination(props: SVGProps<SVGSVGElement>) {
  const back: Pix[] = [
    { x: 4, y: 6, w: 56, h: 32, fill: PALETTE.vermilionWash },
  ];
  /* dais (stepped platform) */
  const dais: Pix[] = [
    { x: 10, y: 34, w: 44, h: 4, fill: PALETTE.parchmentDark },
    { x: 14, y: 30, w: 36, h: 4, fill: PALETTE.parchmentDark },
    { x: 10, y: 34, w: 44, h: 1, fill: PALETTE.ink },
    { x: 14, y: 30, w: 36, h: 1, fill: PALETTE.ink },
  ];
  /* throne body */
  const throne: Pix[] = [
    /* back panel */
    { x: 26, y: 14, w: 12, h: 16, fill: PALETTE.vermilion },
    { x: 26, y: 14, w: 12, h: 1, fill: PALETTE.ink },
    { x: 26, y: 14, w: 1, h: 16, fill: PALETTE.ink },
    { x: 37, y: 14, w: 1, h: 16, fill: PALETTE.ink },
    /* armrests */
    { x: 24, y: 24, w: 16, h: 2, fill: PALETTE.giltDeep },
    { x: 24, y: 24, w: 16, h: 1, fill: PALETTE.ink },
    /* seat highlight */
    { x: 28, y: 22, w: 8, h: 2, fill: PALETTE.gilt },
  ];
  /* crown floating above */
  const crown: Pix[] = [
    { x: 28, y: 9, w: 8, h: 3, fill: PALETTE.gilt },
    { x: 28, y: 9, w: 8, h: 1, fill: PALETTE.giltDeep },
    { x: 28, y: 8, w: 1, h: 1, fill: PALETTE.gilt },
    { x: 31, y: 8, w: 1, h: 1, fill: PALETTE.gilt },
    { x: 34, y: 8, w: 1, h: 1, fill: PALETTE.gilt },
    { x: 30, y: 10, w: 1, h: 1, fill: PALETTE.vermilion },
    { x: 33, y: 10, w: 1, h: 1, fill: PALETTE.lapis },
  ];
  return (
    <ZoneSvg {...props}>
      <Backdrop fill={PALETTE.vermilionWash} />
      {px(back)}
      {px(dais)}
      {px(throne)}
      {px(crown)}
      <ArchFrame />
    </ZoneSvg>
  );
}

export function ZoneIllumination({ zone, ...rest }: { zone: ZoneName } & SVGProps<SVGSVGElement>) {
  if (zone === "gate") return <GateIllumination {...rest} />;
  if (zone === "farm") return <FarmIllumination {...rest} />;
  if (zone === "road") return <RoadIllumination {...rest} />;
  if (zone === "tower") return <TowerIllumination {...rest} />;
  return <ThroneIllumination {...rest} />;
}
