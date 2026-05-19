/** TV subject-board ring geometry (viewBox 0 0 100 100, seat 0 at top, clockwise). */

export const TV_SEAT_RING_CX = 50;
export const TV_SEAT_RING_CY = 50;
export const TV_SEAT_RING_R_OUTER = 46;
export const TV_SEAT_RING_R_INNER = 30;
/** Voting countdown annulus between die area and wedge inner edge. */
export const TV_SEAT_RING_TIMER_R_INNER = 17;
export const TV_SEAT_RING_TIMER_R_OUTER = 28.5;
export const TV_SEAT_RING_TIMER_R_MID =
  (TV_SEAT_RING_TIMER_R_INNER + TV_SEAT_RING_TIMER_R_OUTER) / 2;
export const TV_SEAT_RING_TIMER_STROKE_WIDTH =
  (TV_SEAT_RING_TIMER_R_OUTER - TV_SEAT_RING_TIMER_R_INNER) / 2;
/** Thin band outside the main ring for marker highlight. */
export const TV_SEAT_RING_MARKER_BAND_OUTER = TV_SEAT_RING_R_OUTER + 2.2;
export const TV_SEAT_RING_MARKER_BAND_INNER = TV_SEAT_RING_R_OUTER + 0.4;
export const TV_SEAT_RING_R_LABEL_MID = (TV_SEAT_RING_R_INNER + TV_SEAT_RING_R_OUTER) / 2;
/** Radial shift: top half inward (from outer edge), bottom half outward (from inner edge). */
export const TV_SEAT_RING_LABEL_INSET = 2.5;

/** Per-wedge label arc radius for even margin from the wedge's top edge (screen-up). */
export function wedgeLabelRadius(seatIndex: number, seatCount: number): number {
  const midRad = degToRad(seatMidClockwiseDeg(seatIndex, seatCount));
  return TV_SEAT_RING_R_LABEL_MID - TV_SEAT_RING_LABEL_INSET * Math.cos(midRad);
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Clockwise degrees from 12 o'clock; 0 = top, increases clockwise. */
export function seatClockwiseDeg(seatIndex: number, seatCount: number): number {
  return seatIndex * (360 / seatCount);
}

export function seatSweepDeg(seatCount: number): number {
  return 360 / seatCount;
}

export function seatMidClockwiseDeg(seatIndex: number, seatCount: number): number {
  return (seatIndex + 0.5) * (360 / seatCount);
}

/** Cartesian point from clockwise degrees (12 o'clock = 0). */
export function pointFromClockwiseDeg(
  clockwiseDeg: number,
  radius: number,
  cx = TV_SEAT_RING_CX,
  cy = TV_SEAT_RING_CY,
): { x: number; y: number } {
  const rad = degToRad(clockwiseDeg);
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}

/** Chord length of a wedge arc at `radius` (viewBox units). */
export function wedgeChordWidth(radius: number, sweepDeg: number): number {
  return 2 * radius * Math.sin(degToRad(sweepDeg / 2));
}

/** SVG path for one annulus sector; sweep follows seat order clockwise. */
export function annulusWedgePath(
  seatIndex: number,
  seatCount: number,
  rOuter = TV_SEAT_RING_R_OUTER,
  rInner = TV_SEAT_RING_R_INNER,
  cx = TV_SEAT_RING_CX,
  cy = TV_SEAT_RING_CY,
): string {
  const sweep = seatSweepDeg(seatCount);
  const start = seatClockwiseDeg(seatIndex, seatCount);
  const end = start + sweep;
  const pOutStart = pointFromClockwiseDeg(start, rOuter, cx, cy);
  const pOutEnd = pointFromClockwiseDeg(end, rOuter, cx, cy);
  const pInEnd = pointFromClockwiseDeg(end, rInner, cx, cy);
  const pInStart = pointFromClockwiseDeg(start, rInner, cx, cy);
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    `M ${pOutStart.x.toFixed(3)} ${pOutStart.y.toFixed(3)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${pOutEnd.x.toFixed(3)} ${pOutEnd.y.toFixed(3)}`,
    `L ${pInEnd.x.toFixed(3)} ${pInEnd.y.toFixed(3)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${pInStart.x.toFixed(3)} ${pInStart.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

/** Second outer border band on the marker wedge (sits just outside the main ring). */
export function wedgeMarkerOuterRingPath(seatIndex: number, seatCount: number): string {
  return annulusWedgePath(
    seatIndex,
    seatCount,
    TV_SEAT_RING_MARKER_BAND_OUTER,
    TV_SEAT_RING_MARKER_BAND_INNER,
  );
}

export function wedgeLabelArcPathId(seatIndex: number): string {
  return `whatif-wedge-label-arc-${seatIndex}`;
}

/** Arc along the donut band for SVG textPath (same clockwise seat order as wedges). */
export function wedgeLabelArcPath(
  seatIndex: number,
  seatCount: number,
  radius = wedgeLabelRadius(seatIndex, seatCount),
): string {
  const sweep = seatSweepDeg(seatCount);
  const start = seatClockwiseDeg(seatIndex, seatCount);
  const end = start + sweep;
  const mid = seatMidClockwiseDeg(seatIndex, seatCount);
  /** Reverse bottom-half arcs so curved text stays right-side up. */
  const reverse = mid > 90 && mid < 270;
  const from = reverse ? end : start;
  const to = reverse ? start : end;
  const sweepFlag = reverse ? 0 : 1;
  const pFrom = pointFromClockwiseDeg(from, radius);
  const pTo = pointFromClockwiseDeg(to, radius);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${pFrom.x.toFixed(3)} ${pFrom.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${pTo.x.toFixed(3)} ${pTo.y.toFixed(3)}`;
}

/** Label anchor on the arc (for star / markers). */
export function wedgeLabelArcMidpoint(
  seatIndex: number,
  seatCount: number,
  radius = wedgeLabelRadius(seatIndex, seatCount),
): { x: number; y: number } {
  const mid = seatMidClockwiseDeg(seatIndex, seatCount);
  return pointFromClockwiseDeg(mid, radius);
}

/** Max label width: arc length at label radius (text follows the curve). */
export function wedgeLabelMaxWidth(seatCount: number, radius = TV_SEAT_RING_R_LABEL_MID): number {
  const arcLen = radius * degToRad(seatSweepDeg(seatCount));
  return arcLen * 0.88;
}

/** Base label font size (viewBox units) from wedge count. */
export function wedgeLabelBaseFontSize(seatCount: number): number {
  const maxW = wedgeLabelMaxWidth(seatCount);
  /** Cap relative to chord width so labels stay inside the donut band. */
  const chordCap = maxW * 0.052;
  let bucket: number;
  if (seatCount <= 2) bucket = 3;
  else if (seatCount <= 4) bucket = 1.75;
  else if (seatCount <= 6) bucket = 2.35;
  else if (seatCount <= 8) bucket = 2.05;
  else bucket = 1.85;
  return Math.min(bucket, chordCap);
}
