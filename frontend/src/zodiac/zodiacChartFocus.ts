/**
 * Serializable in-app focus for future deep links (URL adapter can map to/from this shape).
 * Placement pane currently uses `ZodiacSignCardTile` directly; this union is for house/aspect later.
 */
export type ZodiacChartFocus =
  | { kind: "body"; chartKey: string }
  | { kind: "house"; house: number }
  | { kind: "aspect"; bodyLo: string; bodyHi: string; type: string };

export function normalizedAspectFocus(
  bodyA: string,
  bodyB: string,
  type: string,
): Extract<ZodiacChartFocus, { kind: "aspect" }> {
  const [bodyLo, bodyHi] = [bodyA, bodyB].sort((a, b) => a.localeCompare(b));
  return { kind: "aspect", bodyLo, bodyHi, type };
}
