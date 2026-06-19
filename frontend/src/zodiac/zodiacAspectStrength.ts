import { ASPECT_TYPE_COPY, type AspectTypeKey } from "./zodiacAspectCopy";
import { formatOrbAsDegMin } from "./chartAngles";

const LUMINARY_OR_ANGLE_BODIES = new Set(["sun", "moon", "ascendant", "midheaven"]);

const BASE_MAX_ORB_DEG: Record<AspectTypeKey, number> = {
  conjunction: 10,
  opposition: 8,
  square: 8,
  trine: 8,
  sextile: 6,
  quincunx: 3,
};

export const LUMINARY_ORB_BONUS_DEG = 2;

export type AspectStrengthTier =
  | "dominant"
  | "strong"
  | "moderate"
  | "subtle"
  | "background";

const STRENGTH_COPY: Record<AspectStrengthTier, string> = {
  dominant: "this is a particularly powerful aspect in your chart.",
  strong: "this aspect is a prominent theme in your chart.",
  moderate: "this aspect is a meaningful part of your chart.",
  subtle: "this aspect may emerge in specific situations in your chart.",
  background: "this aspect may operate more subtly in the background of your chart.",
};

export function aspectInvolvesLuminaryOrAngle(bodyA: string, bodyB: string): boolean {
  return LUMINARY_OR_ANGLE_BODIES.has(bodyA) || LUMINARY_OR_ANGLE_BODIES.has(bodyB);
}

export function luminaryOrbBonus(bodyA: string, bodyB: string): number {
  return aspectInvolvesLuminaryOrAngle(bodyA, bodyB) ? LUMINARY_ORB_BONUS_DEG : 0;
}

export function maxOrbForInterpret(
  type: AspectTypeKey,
  bodyA: string,
  bodyB: string,
): number {
  return BASE_MAX_ORB_DEG[type] + luminaryOrbBonus(bodyA, bodyB);
}

export function effectiveOrbForStrength(
  orbDeg: number,
  bodyA: string,
  bodyB: string,
): number {
  return Math.max(0, orbDeg - luminaryOrbBonus(bodyA, bodyB));
}

export function aspectStrengthTier(effectiveOrbDeg: number): AspectStrengthTier {
  if (effectiveOrbDeg < 1) return "dominant";
  if (effectiveOrbDeg < 3) return "strong";
  if (effectiveOrbDeg < 5) return "moderate";
  if (effectiveOrbDeg < 7) return "subtle";
  return "background";
}

export function buildAspectStrengthParagraph(
  orbDeg: number,
  aspectType: AspectTypeKey,
  bodyA: string,
  bodyB: string,
): string {
  const tier = aspectStrengthTier(effectiveOrbForStrength(orbDeg, bodyA, bodyB));
  const orbDisplay = formatOrbAsDegMin(orbDeg);
  const exactAngleDeg = ASPECT_TYPE_COPY[aspectType].angleDeg;
  return `With an orb of ${orbDisplay}, ${STRENGTH_COPY[tier]} (An orb is how many degrees off the exact angle of ${exactAngleDeg}° this aspect is.)`;
}

export function aspectWithinInterpretOrb(aspect: {
  type: string;
  orb_deg: number;
  body_a: string;
  body_b: string;
}): boolean {
  const type = aspect.type as AspectTypeKey;
  if (!(type in BASE_MAX_ORB_DEG)) return false;
  return aspect.orb_deg <= maxOrbForInterpret(type, aspect.body_a, aspect.body_b);
}
