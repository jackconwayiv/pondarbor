import type { GroundKind } from "./types";

/**
 * One orthogonal step (N / S / E / W), not diagonal.
 */
export function isOrthogonallyAdjacent(
  a: { row: number; col: number },
  b: { row: number; col: number },
): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr + dc === 1;
}

/**
 * Chebyshev (king) distance: one step orthogonally or diagonally; minimum number of
 * 8-direction moves from {@link a} to {@link b}.
 */
export function chebyshevDistance(
  a: { row: number; col: number },
  b: { row: number; col: number },
): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

/**
 * Action points to spend for a single king (Chebyshev) move from {@link a} to {@link b}.
 * Diagonal steps cost 1.5 each, orthogonal 1, along a minimal-length path: cost =
 * `max(Δ) + 0.5 * min(Δ)` for absolute row/col deltas.
 */
export function chebyshevMoveActionCost(
  a: { row: number; col: number },
  b: { row: number; col: number },
): number {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return Math.max(dr, dc) + 0.5 * Math.min(dr, dc);
}

/**
 * March + action cost for one king-adjacent step (Chebyshev distance 1).
 * Orthogonal 1, diagonal 1.5, +1 when **entering** water, +0.5 when **entering** marsh.
 */
export function kingMarchStepCost(
  from: { row: number; col: number },
  to: { row: number; col: number },
  destGround: GroundKind,
): number | null {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === 0 && dc === 0) return null;
  if (Math.abs(dr) > 1 || Math.abs(dc) > 1) return null;
  if (Math.max(Math.abs(dr), Math.abs(dc)) !== 1) return null;
  return (
    chebyshevMoveActionCost(from, to) +
    (destGround === "water" ? 1 : 0) +
    (destGround === "marsh" ? 0.5 : 0)
  );
}

export function inBounds(
  row: number,
  col: number,
  width: number,
  height: number,
): boolean {
  return row >= 0 && col >= 0 && row < height && col < width;
}
