/* Stained-glass window miniatures for each zone backdrop.
 * 64×44 viewBox, edge-to-edge panes; zone UI supplies the outer border. */
import type { SVGProps } from "react";

import type { ZoneName } from "../../estatesDropRules";
import {
  GlassPane,
  LeadLine,
  SG,
  ZONE_VIEW_H,
  ZoneSvg,
  glass,
} from "../stainedGlass/shared";

const B = ZONE_VIEW_H;

function WheatSheafGlass({ cx, baseY }: { cx: number; baseY: number }) {
  return (
    <g>
      <GlassPane
        d={`M ${cx - 2.5} ${baseY} L ${cx - 2} ${baseY - 8} L ${cx - 1.5} ${baseY - 9.5} Z`}
        fill={glass.gold}
      />
      <GlassPane
        d={`M ${cx} ${baseY} L ${cx} ${baseY - 9} L ${cx + 0.5} ${baseY - 10.5} Z`}
        fill={glass.gold}
      />
      <GlassPane
        d={`M ${cx + 2.5} ${baseY} L ${cx + 2} ${baseY - 8} L ${cx + 1.5} ${baseY - 9.5} Z`}
        fill={glass.gold}
      />
      <GlassPane
        d={`M ${cx - 3} ${baseY - 4} L ${cx + 3} ${baseY - 4} L ${cx + 2.5} ${baseY - 2.5} L ${cx - 2.5} ${baseY - 2.5} Z`}
        fill={glass.greenDim}
      />
      <GlassPane
        d={`M ${cx - 3.5} ${baseY - 10} Q ${cx} ${baseY - 12} ${cx + 3.5} ${baseY - 10} L ${cx + 2} ${baseY - 8.5} L ${cx - 2} ${baseY - 8.5} Z`}
        fill={glass.yellow}
      />
    </g>
  );
}

/** Large triangular pennant on a pole; tip overlaps the gate arch toward center. */
function PennantGlass({ poleX, tipX, poleTop = 6, poleBottom = 28 }: {
  poleX: number;
  tipX: number;
  poleTop?: number;
  poleBottom?: number;
}) {
  const flyY = (poleTop + poleBottom) / 2 + 1;
  return (
    <g>
      <LeadLine d={`M ${poleX} ${poleTop} L ${poleX} ${poleBottom}`} strokeWidth={1.15} />
      <GlassPane
        d={`M ${poleX} ${poleTop + 1} L ${poleX} ${poleBottom - 2} L ${tipX} ${flyY} Z`}
        fill={glass.yellow}
      />
      <GlassPane
        d={`M ${poleX} ${poleTop + 2} L ${poleX} ${poleBottom - 5} L ${tipX - (tipX - poleX) * 0.35} ${flyY - 0.5} Z`}
        fill={glass.gold}
        opacity={0.9}
      />
    </g>
  );
}

/** Gate — green ground, blue sky, yellow portcullis & pennants. */
export function GateIllumination(props: SVGProps<SVGSVGElement>) {
  return (
    <ZoneSvg {...props}>
      {/* sky — blue panes */}
      <GlassPane d="M 0 0 L 64 0 L 64 14 L 0 10 Z" fill={glass.blue} />
      <GlassPane d="M 0 10 L 10 12 L 10 28 L 0 32 Z" fill={glass.blueDeep} />
      <GlassPane d="M 54 12 L 64 14 L 64 32 L 54 28 Z" fill={glass.blueDeep} />
      <LeadLine d="M 0 10 L 64 14" />
      <LeadLine d="M 10 12 L 54 12" />
      {/* ground — green */}
      <GlassPane d={`M 0 32 L 64 32 L 64 ${B} L 0 ${B} Z`} fill={glass.green} />
      <GlassPane d="M 10 28 L 54 28 L 54 32 L 10 32 Z" fill={glass.greenDim} />
      <LeadLine d="M 0 32 L 64 32" />
      {/* arch stonework */}
      <GlassPane
        d="M 10 28 L 10 14 Q 32 6 54 14 L 54 28 Z"
        fill={glass.stone}
      />
      <LeadLine d="M 10 14 Q 32 6 54 14" strokeWidth={1.2} />
      {/* arch opening */}
      <GlassPane
        d="M 16 28 L 16 17 Q 32 13 48 17 L 48 28 Z"
        fill={SG.ink}
        opacity={0.88}
      />
      {/* portcullis — yellow panes */}
      <GlassPane d="M 16 17 L 48 17 L 48 19 L 16 19 Z" fill={glass.yellow} />
      <GlassPane d="M 16 23 L 48 23 L 48 25 L 16 25 Z" fill={glass.yellow} />
      {[18, 22, 26, 30, 34, 38, 42, 46].map((x) => (
        <GlassPane key={x} d={`M ${x} 17 L ${x + 1.5} 17 L ${x + 1.5} 28 L ${x} 28 Z`} fill={glass.gold} />
      ))}
      {/* pennants on top — large triangles overlapping the arch */}
      <PennantGlass poleX={5} tipX={22} />
      <PennantGlass poleX={59} tipX={42} />
    </ZoneSvg>
  );
}

/** Farm — mostly green panes, gold wheat, fence lattice. */
export function FarmIllumination(props: SVGProps<SVGSVGElement>) {
  return (
    <ZoneSvg {...props}>
      {/* field lattice — edge to edge */}
      <GlassPane d="M 0 0 L 32 0 L 20 20 L 0 18 Z" fill={glass.green} />
      <GlassPane d="M 32 0 L 64 0 L 64 18 L 44 20 Z" fill={glass.greenDim} />
      <GlassPane d={`M 0 18 L 20 20 L 28 ${B} L 0 ${B} Z`} fill={glass.greenDim} />
      <GlassPane d={`M 44 20 L 64 18 L 64 ${B} L 36 ${B} Z`} fill={glass.green} />
      <GlassPane d={`M 20 20 L 44 20 L 36 ${B} L 28 ${B} Z`} fill={glass.green} />
      <LeadLine d="M 0 18 L 20 20 L 44 20 L 64 18" />
      <LeadLine d="M 32 0 L 20 20 L 44 20" />
      <LeadLine d={`M 20 20 L 28 ${B}`} />
      <LeadLine d={`M 44 20 L 36 ${B}`} />
      {/* furrows */}
      <LeadLine d="M 0 12 Q 32 11 64 12" strokeWidth={0.9} />
      <LeadLine d="M 0 24 Q 32 23 64 24" strokeWidth={0.9} />
      {/* fence */}
      <LeadLine d="M 0 16 L 64 16" strokeWidth={1.1} />
      {[10, 20, 30, 40, 50].map((x) => (
        <LeadLine key={x} d={`M ${x} 12 L ${x} 20`} />
      ))}
      <WheatSheafGlass cx={14} baseY={B - 2} />
      <WheatSheafGlass cx={32} baseY={B - 2} />
      <WheatSheafGlass cx={50} baseY={B - 2} />
    </ZoneSvg>
  );
}

/** Road — blue sky above, green meadows, stone road pane. */
export function RoadIllumination(props: SVGProps<SVGSVGElement>) {
  return (
    <ZoneSvg {...props}>
      {/* sky — blue */}
      <GlassPane d="M 0 0 L 64 0 L 64 16 L 0 16 Z" fill={glass.blue} />
      <GlassPane d="M 0 0 L 22 16 L 0 16 Z" fill={glass.blueDeep} />
      <GlassPane d="M 42 16 L 64 0 L 64 16 Z" fill={glass.blueDeep} />
      <LeadLine d="M 0 16 L 64 16" strokeWidth={1.2} />
      <LeadLine d="M 22 16 L 32 18" />
      <LeadLine d="M 42 16 L 32 18" />
      {/* meadows — green */}
      <GlassPane d={`M 0 16 L 22 16 L 24 ${B} L 0 ${B} Z`} fill={glass.green} />
      <GlassPane d={`M 42 16 L 64 16 L 64 ${B} L 40 ${B} Z`} fill={glass.greenDim} />
      {/* road — stone pane */}
      <GlassPane d={`M 22 16 L 42 16 L 40 ${B} L 24 ${B} Z`} fill={glass.stone} />
      <GlassPane d={`M 26 ${B - 4} L 38 ${B - 4} L 32 20 Z`} fill={glass.stone} opacity={0.85} />
      <LeadLine d="M 22 16 L 32 18 L 42 16" />
      <LeadLine d={`M 24 ${B} L 32 18 L 40 ${B}`} />
      {/* signpost */}
      <LeadLine d="M 10 16 L 10 34" />
      <GlassPane d="M 5 14 L 15 14 L 15 19 L 5 19 Z" fill={glass.yellow} />
      <LeadLine d="M 5 14 L 15 14 L 15 19 L 5 19 Z" strokeWidth={1} />
      {/* milestone */}
      <GlassPane d="M 50 30 L 58 30 L 58 38 L 50 38 Z" fill={glass.stone} />
    </ZoneSvg>
  );
}

/** Tower — yellow top half, blue bottom half, turret silhouette. */
export function TowerIllumination(props: SVGProps<SVGSVGElement>) {
  return (
    <ZoneSvg {...props}>
      {/* sky halves */}
      <GlassPane d="M 0 0 L 21 0 L 21 20 L 0 20 Z" fill={glass.yellow} />
      <GlassPane d="M 21 0 L 43 0 L 43 20 L 21 20 Z" fill={glass.yellowDeep} />
      <GlassPane d="M 43 0 L 64 0 L 64 20 L 43 20 Z" fill={glass.yellow} />
      <GlassPane d={`M 0 20 L 21 20 L 21 ${B} L 0 ${B} Z`} fill={glass.blue} />
      <GlassPane d={`M 21 20 L 43 20 L 43 ${B} L 21 ${B} Z`} fill={glass.blueDeep} />
      <GlassPane d={`M 43 20 L 64 20 L 64 ${B} L 43 ${B} Z`} fill={glass.blue} />
      <LeadLine d="M 0 20 L 64 20" strokeWidth={1.3} />
      <LeadLine d={`M 21 0 L 21 ${B}`} />
      <LeadLine d={`M 43 0 L 43 ${B}`} />
      {/* tower — stone over sky panes */}
      <GlassPane d={`M 24 ${B} L 24 12 L 40 12 L 40 ${B} Z`} fill={glass.stone} />
      <GlassPane d="M 24 12 L 26 8 L 28 12 Z" fill={glass.stone} />
      <GlassPane d="M 28 12 L 30 8 L 32 12 Z" fill={glass.stone} />
      <GlassPane d="M 32 12 L 34 8 L 36 12 Z" fill={glass.stone} />
      <GlassPane d="M 36 12 L 38 8 L 40 12 Z" fill={glass.stone} />
      <LeadLine d="M 24 12 L 40 12" strokeWidth={1.1} />
      {/* arrow slits */}
      <GlassPane d="M 27 19 L 29 19 L 29 23 L 27 23 Z" fill={SG.ink} opacity={0.75} />
      <GlassPane d="M 35 19 L 37 19 L 37 23 L 35 23 Z" fill={SG.ink} opacity={0.75} />
      <GlassPane d="M 30 26 L 34 26 L 32 30 Z" fill={SG.ink} opacity={0.75} />
      {/* pennant */}
      <LeadLine d="M 32 4 L 32 10" />
      <GlassPane d="M 32 4 L 38 5 L 34 9 Z" fill={glass.yellow} />
    </ZoneSvg>
  );
}

/** Throne — predominantly yellow panes; vermilion throne accent. */
export function ThroneIllumination(props: SVGProps<SVGSVGElement>) {
  return (
    <ZoneSvg {...props}>
      {/* hall — yellow lattice */}
      <GlassPane d="M 0 0 L 32 0 L 16 20 L 0 20 Z" fill={glass.yellow} />
      <GlassPane d="M 32 0 L 64 0 L 64 20 L 48 20 Z" fill={glass.yellowDeep} />
      <GlassPane d={`M 0 20 L 16 20 L 32 ${B} L 0 ${B} Z`} fill={glass.yellowDeep} />
      <GlassPane d={`M 48 20 L 64 20 L 64 ${B} L 32 ${B} Z`} fill={glass.yellow} />
      <GlassPane d={`M 16 20 L 48 20 L 32 ${B} Z`} fill={glass.gold} opacity={0.88} />
      <LeadLine d={`M 0 20 L 16 20 L 32 ${B}`} />
      <LeadLine d={`M 64 20 L 48 20 L 32 ${B}`} />
      <LeadLine d="M 32 0 L 16 20 L 48 20" />
      {/* dais */}
      <GlassPane d={`M 8 ${B - 6} L 56 ${B - 6} L 56 ${B} L 8 ${B} Z`} fill={glass.gold} />
      <GlassPane d={`M 12 ${B - 10} L 52 ${B - 10} L 52 ${B - 6} L 12 ${B - 6} Z`} fill={glass.stone} />
      <LeadLine d={`M 8 ${B - 6} L 56 ${B - 6}`} />
      <LeadLine d={`M 12 ${B - 10} L 52 ${B - 10}`} />
      {/* throne — red glass */}
      <GlassPane
        d={`M 24 ${B - 6} L 24 12 Q 32 8 40 12 L 40 ${B - 6} Z`}
        fill={glass.red}
      />
      {/* seat & arms — gold */}
      <GlassPane d="M 26 24 L 38 24 L 38 28 L 26 28 Z" fill={glass.gold} />
      <LeadLine d="M 22 26 Q 32 24 42 26" strokeWidth={1.4} />
      {/* crown */}
      <GlassPane d="M 26 10 L 28 6 L 30 10 L 32 6 L 34 10 L 34 13 L 26 13 Z" fill={glass.gold} />
      <GlassPane d="M 28 7 L 28 8 L 29 8 L 29 7 Z" fill={glass.blue} opacity={0.95} />
      <GlassPane d="M 33 7 L 33 8 L 34 8 L 34 7 Z" fill={glass.blue} opacity={0.95} />
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
