import { Box } from "@chakra-ui/react";

import { PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import type { ChartPoint, NatalChartPayload } from "./chartTypes";
import { CHART_POINT_ORDER } from "./chartPointOrder";

function normDeg(x: number): number {
  return ((x % 360) + 360) % 360;
}

/**
 * Plot angle (degrees): 0° = right (east), increases CCW; SVG y grows downward.
 * Ascendant longitude → 195° (just below west). Increasing longitude runs CCW along the bottom
 * semicircle (houses 2–6 toward east below), then along the top from east to west (7–12),
 * so lon + 180° sits just above east (~15°) and the sector before ASC sits upper-left (~165°).
 */
function plotAngleDeg(longitudeDeg: number, ascDeg: number): number {
  return normDeg(195 + longitudeDeg - ascDeg);
}

/** Midpoint moving CCW along the zodiac from `fromDeg` to `toDeg`. */
function angularMidCCW(fromDeg: number, toDeg: number): number {
  const f = normDeg(fromDeg);
  const t = normDeg(toDeg);
  let delta = t - f;
  if (delta <= 0) delta += 360;
  return normDeg(f + delta / 2);
}

function xyFromPlotAngle(r: number, plotDeg: number): { x: number; y: number } {
  const rad = (plotDeg * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: -r * Math.sin(rad) };
}

/** Points along a longitude arc of length `deltaLon` (degrees) starting at `lonStart`. */
function arcLongitudeSpan(
  r: number,
  lonStart: number,
  deltaLon: number,
  ascDeg: number,
  steps: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const lon = normDeg(lonStart + (deltaLon * i) / steps);
    const plot = plotAngleDeg(lon, ascDeg);
    pts.push(xyFromPlotAngle(r, plot));
  }
  return pts;
}

function polygonPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join(" ") + " Z";
}

/** Text presentation (VS15) so symbols prefer plain glyphs over emoji on mobile. */
const T = "\uFE0E";

/** ♈–♓ tropical signs (Unicode astrological symbols). */
const SIGN_GLYPH = [
  `\u2648${T}`,
  `\u2649${T}`,
  `\u264a${T}`,
  `\u264b${T}`,
  `\u264c${T}`,
  `\u264d${T}`,
  `\u264e${T}`,
  `\u264f${T}`,
  `\u2650${T}`,
  `\u2651${T}`,
  `\u2652${T}`,
  `\u2653${T}`,
] as const;

/** Planet / point glyphs (Unicode); angles use conventional markers where no single glyph exists. */
const BODY_GLYPH: Record<string, string> = {
  sun: `\u2609${T}`,
  moon: `\u263d${T}`,
  mercury: `\u263f${T}`,
  venus: `\u2640${T}`,
  mars: `\u2642${T}`,
  jupiter: `\u2643${T}`,
  saturn: `\u2644${T}`,
  uranus: `\u2645${T}`,
  neptune: `\u2646${T}`,
  pluto: `\u2647${T}`,
  chiron: `\u26b7${T}`,
  ceres: `\u26b3${T}`,
  pallas: `\u26b4${T}`,
  juno: `\u26b5${T}`,
  vesta: `\u26b6${T}`,
  north_node: `\u260a${T}`,
  south_node: `\u260b${T}`,
  lilith: `\u26b8${T}`,
  part_of_fortune: `\u2295${T}`,
  ascendant: `\u2191${T}`,
  midheaven: `\u2316${T}`,
};

function bodyLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const GLYPH_FONT =
  'ui-serif, "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", sans-serif';

function mergedBodies(chart: NatalChartPayload): Record<string, ChartPoint> {
  return { ...chart.points, ...chart.angles };
}

function orderedBodyEntries(chart: NatalChartPayload): [string, ChartPoint][] {
  const merged = mergedBodies(chart);
  const keys = Object.keys(merged);
  const rank = (k: string) => {
    const i = CHART_POINT_ORDER.indexOf(k);
    return i === -1 ? 1000 : i;
  };
  keys.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return keys.map((k) => [k, merged[k]!]);
}

/** Spread longitude slightly when several bodies share the same degree area. */
function longitudeOffsets(entries: [string, ChartPoint][]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a[1].longitude_deg - b[1].longitude_deg);
  const off = new Map<string, number>();
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (
      j < sorted.length &&
      sorted[j][1].longitude_deg - sorted[i][1].longitude_deg < 4
    ) {
      j++;
    }
    const group = sorted.slice(i, j);
    const n = group.length;
    group.forEach(([k], idx) => {
      off.set(k, (idx - (n - 1) / 2) * 3.5);
    });
    i = j;
  }
  return off;
}

/**
 * Tropical wheel: house 1 from Asc left-of-center below the horizontal; houses 2–6 CCW along
 * the bottom; house 7 from Desc above the horizontal on the right; 8–12 CCW along the top.
 */
export default function NatalChartWheel({ chart }: { chart: NatalChartPayload }) {
  const cusps = chart.houses.cusps_longitude_deg;
  const ascDeg =
    chart.angles.ascendant?.longitude_deg ?? (cusps.length ? cusps[0] : 0);

  const R_OUT = 100;
  const R_ZOD_IN = 76;
  const R_HOUSE_LABEL = 46;
  const R_BODY_BASE = 56;
  const R_SPOKE_IN = 22;

  const bodies = orderedBodyEntries(chart);
  const lonOff = longitudeOffsets(bodies);

  return (
    <Box {...PANEL_NESTED_BLOCK_PROPS} overflow="hidden">
      <Box maxW="420px" mx="auto" color="fg" w="100%" aspectRatio={1}>
        <svg
          viewBox="-108 -108 216 216"
          width="100%"
          height="100%"
          role="img"
          aria-label="Natal chart wheel. Ascendant left below the horizon; houses two through six along the bottom, seven through twelve along the top, counter-clockwise."
          style={{ fontFamily: GLYPH_FONT }}
        >
          {/* Zodiac ring — 30° sectors */}
          {SIGN_GLYPH.map((glyph, s) => {
            const lon0 = s * 30;
            const outerPts = arcLongitudeSpan(R_OUT, lon0, 30, ascDeg, 14);
            const innerPts = arcLongitudeSpan(R_ZOD_IN, normDeg(lon0 + 30), -30, ascDeg, 14);
            const ring = [...outerPts, ...innerPts.reverse()];
            const fill = s % 2 === 0 ? "var(--chakra-colors-bg-muted)" : "var(--chakra-colors-bg-subtle)";
            return (
              <path
                key={glyph}
                d={polygonPath(ring)}
                fill={fill}
                stroke="var(--chakra-colors-border)"
                strokeWidth={0.6}
              />
            );
          })}

          <circle
            r={R_OUT}
            fill="none"
            stroke="var(--chakra-colors-border-emphasized)"
            strokeWidth={1.2}
          />

          <circle
            r={R_ZOD_IN}
            fill="none"
            stroke="var(--chakra-colors-border)"
            strokeWidth={0.8}
          />

          {SIGN_GLYPH.map((glyph, s) => {
            const midLon = s * 30 + 15;
            const plot = plotAngleDeg(midLon, ascDeg);
            const { x, y } = xyFromPlotAngle((R_OUT + R_ZOD_IN) / 2, plot);
            return (
              <text
                key={`lbl-${glyph}-${s}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight="normal"
                fill="currentColor"
                style={{ userSelect: "none" }}
              >
                {glyph}
              </text>
            );
          })}

          {cusps.map((cuspLon, i) => {
            const plot = plotAngleDeg(cuspLon, ascDeg);
            const outer = xyFromPlotAngle(R_OUT, plot);
            const inner = xyFromPlotAngle(R_SPOKE_IN, plot);
            const isAsc = i === 0;
            return (
              <line
                key={`spoke-${i}`}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                strokeWidth={isAsc ? 2 : 1}
                opacity={isAsc ? 0.88 : 0.42}
              />
            );
          })}

          {cusps.map((_, i) => {
            const from = cusps[i];
            const to = cusps[(i + 1) % 12];
            const midLon = angularMidCCW(from, to);
            const plot = plotAngleDeg(midLon, ascDeg);
            const { x, y } = xyFromPlotAngle(R_HOUSE_LABEL, plot);
            return (
              <text
                key={`house-${i + 1}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight="bold"
                fill="currentColor"
                opacity={0.72}
                style={{ userSelect: "none" }}
              >
                {i + 1}
              </text>
            );
          })}

          {bodies.map(([key, pt]) => {
            const lon = normDeg(pt.longitude_deg + (lonOff.get(key) ?? 0));
            const plot = plotAngleDeg(lon, ascDeg);
            const { x, y } = xyFromPlotAngle(R_BODY_BASE, plot);
            const glyph = BODY_GLYPH[key] ?? `\u26aa${T}`;
            const title = `${bodyLabel(key)}${pt.retrograde ? ", retrograde" : ""}`;
            return (
              <g key={key}>
                <title>{title}</title>
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={15}
                  fontWeight="normal"
                  fill="currentColor"
                  style={{ userSelect: "none" }}
                >
                  {glyph}
                </text>
                {pt.retrograde ? (
                  <text
                    x={x + 11}
                    y={y - 9}
                    fontSize={9}
                    fill="var(--chakra-colors-fg-muted)"
                    style={{ userSelect: "none" }}
                    aria-hidden
                  >
                    {"\u211e"}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </Box>
    </Box>
  );
}
