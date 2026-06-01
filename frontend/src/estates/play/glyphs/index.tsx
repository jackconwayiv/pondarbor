import { useId, type SVGProps } from "react";

import type { CanonicalSuit } from "../../estatesDropRules";
import { GlyphSvg, MS } from "../manuscript/shared";

export type GlyphProps = SVGProps<SVGSVGElement> & {
  size?: number;
  /** Wash color of the glyph fill. Defaults to `currentColor`. */
  color?: string;
};

/** Pitchfork — three tines, wooden handle, verdigris heads. */
export function PitchforkGlyph({ size = 24, color, ...rest }: GlyphProps) {
  const fill = color ?? "var(--verdigris)";
  return (
    <GlyphSvg size={size} aria-hidden {...rest}>
      <path
        d="M 5 3 L 5 6 M 8 3 L 8 6 M 11 3 L 11 6"
        fill="none"
        stroke={fill}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <path
        d="M 4.5 6 Q 5 5 5.5 6 M 7.5 6 Q 8 5 8.5 6 M 10.5 6 Q 11 5 11.5 6"
        fill={fill}
        stroke={MS.ink}
        strokeWidth={0.4}
      />
      <path
        d="M 4 7 L 12 7 L 11 8.5 L 5 8.5 Z"
        fill={fill}
        stroke={MS.ink}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <rect x="7" y="8.5" width="2" height="6" rx="0.3" fill={MS.parchmentDark} stroke={MS.ink} strokeWidth={0.4} />
      <path d="M 6 14.5 L 10 14.5 L 9 15.5 L 7 15.5 Z" fill={MS.parchmentDark} stroke={MS.ink} strokeWidth={0.4} />
    </GlyphSvg>
  );
}

/** Heater shield with gilt charge cross. */
export function HeraldicShieldGlyph({ size = 24, color, ...rest }: GlyphProps) {
  const fill = color ?? "var(--lapis)";
  return (
    <GlyphSvg size={size} aria-hidden {...rest}>
      <path
        d="M 3 4 L 13 4 Q 14 8 8 14 Q 2 8 3 4 Z"
        fill={fill}
        stroke={MS.ink}
        strokeWidth={0.7}
        strokeLinejoin="round"
      />
      <path
        d="M 8 5.5 L 8 12 M 5 8.5 L 11 8.5"
        fill="none"
        stroke={`url(#glyph-gilt)`}
        strokeWidth={0.9}
        strokeLinecap="round"
      />
      <circle cx="8" cy="8.5" r="1" fill={MS.giltSoft} stroke={MS.ink} strokeWidth={0.3} />
    </GlyphSvg>
  );
}

/** Three-point crown with gilt gradient and gem dots. */
export function CrownGlyph({ size = 24, color, ...rest }: GlyphProps) {
  const fill = color ?? "var(--royal)";
  return (
    <GlyphSvg size={size} aria-hidden {...rest}>
      <path
        d="M 2.5 10 L 4 6 L 6 9 L 8 4 L 10 9 L 12 6 L 13.5 10 L 13.5 12 L 2.5 12 Z"
        fill={`url(#glyph-gilt)`}
        stroke={MS.ink}
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      <path
        d="M 3 12 L 13 12"
        fill="none"
        stroke={MS.ink}
        strokeWidth={0.5}
      />
      <circle cx="4" cy="7" r="0.5" fill={fill} stroke={MS.ink} strokeWidth={0.2} />
      <circle cx="8" cy="5.5" r="0.5" fill={MS.vermilion} stroke={MS.ink} strokeWidth={0.2} />
      <circle cx="12" cy="7" r="0.5" fill={MS.lapis} stroke={MS.ink} strokeWidth={0.2} />
      <path
        d="M 4 9.5 L 5 10.5 L 4 11.5 M 7.5 9 L 8.5 10 L 7.5 11 M 11 9.5 L 12 10.5 L 11 11.5"
        fill="none"
        stroke={MS.giltDeep}
        strokeWidth={0.35}
        strokeLinecap="round"
      />
    </GlyphSvg>
  );
}

export function SuitGlyph({
  suit,
  ...rest
}: GlyphProps & { suit: CanonicalSuit | "" | string }) {
  if (suit === "royal") return <CrownGlyph {...rest} />;
  if (suit === "noble") return <HeraldicShieldGlyph {...rest} />;
  return <PitchforkGlyph {...rest} />;
}

/** Six-point gilt star for permanent bonus indicator. */
export function PermanentBonusStar({ size = 16, color }: { size?: number; color?: string }) {
  const gradientId = `star-gilt-${useId().replace(/:/g, "")}`;
  const starFill = color ? color : `url(#${gradientId})`;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--gilt-soft)" />
          <stop offset="100%" stopColor="var(--gilt-deep)" />
        </linearGradient>
      </defs>
      <path
        d="M 8 2 L 9.2 6 L 13.5 6 L 10 8.5 L 11.2 13 L 8 10.5 L 4.8 13 L 6 8.5 L 2.5 6 L 6.8 6 Z"
        fill={starFill}
        stroke={MS.ink}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}
