/**
 * Soft SVG rim decals for PondStage (replaces pure CSS-gradient “barcode” look).
 * Coordinates use viewBox 0 0 100 100 (stretched to pond bounds).
 */
type PondRimDecalProps = {
  /** Catalog upgrade id — stable id for SVG defs (filter/gradient). */
  upgradeId: string;
  layerClass: string;
};

function safeDefId(upgradeId: string, suffix: string): string {
  return `pond-rim-${upgradeId.replace(/[^a-zA-Z0-9_-]/g, "")}-${suffix}`;
}

export default function PondRimDecal({ upgradeId, layerClass }: PondRimDecalProps) {
  const uid = upgradeId;

  switch (layerClass) {
    case "pondRimNutrientSilt":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id={safeDefId(uid, "si")} cx="50%" cy="100%" r="65%">
              <stop offset="0%" stopColor="#6a5238" stopOpacity="0.28" />
              <stop offset="50%" stopColor="#4a3828" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#3a2a1c" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="50" cy="102" rx="56" ry="34" fill={`url(#${safeDefId(uid, "si")})`} />
        </svg>
      );

    case "pondRimSpawningShallows":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={safeDefId(uid, "sh")} x1="50%" y1="45%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#a8e8ec" stopOpacity="0" />
              <stop offset="45%" stopColor="#8dd8e0" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#c8f4f8" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <rect x="0" y="48" width="100" height="55" fill={`url(#${safeDefId(uid, "sh")})`} />
        </svg>
      );

    case "pondRimSunkenLog":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id={safeDefId(uid, "lg")} cx="28%" cy="88%" r="40%">
              <stop offset="0%" stopColor="#0c1820" stopOpacity="0.42" />
              <stop offset="70%" stopColor="#142430" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0a1018" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="28" cy="88" rx="22" ry="11" fill={`url(#${safeDefId(uid, "lg")})`} />
          <path
            d="M 14 90 Q 26 84 40 88 Q 48 91 42 93"
            fill="none"
            stroke="#1a2830"
            strokeWidth="0.5"
            strokeLinecap="round"
            opacity={0.35}
          />
        </svg>
      );

    case "pondRimTangledRoots":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g opacity={0.55} stroke="#241810" strokeWidth="0.35" fill="none" strokeLinecap="round">
            <path d="M 4 100 C 8 88 6 78 12 70 S 18 58 10 52" />
            <path d="M 10 100 C 14 90 12 80 18 74 S 22 64 16 56" />
            <path d="M 18 100 C 20 92 22 82 14 76 S 8 68 20 62" />
            <path d="M 6 100 Q 14 85 8 72 T 16 58" />
            <path d="M 22 100 Q 16 88 24 76 T 12 64" />
          </g>
        </svg>
      );

    case "pondRimOpenWater":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id={safeDefId(uid, "ow")} cx="48%" cy="42%" r="55%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="55%" stopColor="#e8f8ff" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="48" cy="42" rx="38" ry="32" fill={`url(#${safeDefId(uid, "ow")})`} />
        </svg>
      );

    case "pondRimLilyPads":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g opacity={0.5}>
            <ellipse
              cx="34"
              cy="68"
              rx="7"
              ry="4.2"
              fill="#2a6a3a"
              transform="rotate(-18 34 68)"
              opacity={0.85}
            />
            <ellipse
              cx="58"
              cy="74"
              rx="6"
              ry="3.8"
              fill="#327848"
              transform="rotate(12 58 74)"
              opacity={0.8}
            />
            <ellipse
              cx="71"
              cy="62"
              rx="5.5"
              ry="3.5"
              fill="#2a6240"
              transform="rotate(-8 71 62)"
              opacity={0.75}
            />
            <ellipse
              cx="46"
              cy="78"
              rx="4.5"
              ry="2.8"
              fill="#3a8050"
              transform="rotate(22 46 78)"
              opacity={0.55}
            />
          </g>
        </svg>
      );

    case "pondRimDeepPool":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id={safeDefId(uid, "dp")} cx="50%" cy="48%" r="72%">
              <stop offset="35%" stopColor="#0a2038" stopOpacity="0" />
              <stop offset="85%" stopColor="#061428" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#040c18" stopOpacity="0.32" />
            </radialGradient>
          </defs>
          <rect width="100" height="100" fill={`url(#${safeDefId(uid, "dp")})`} />
        </svg>
      );

    case "pondRimDeepwaterChannels":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={safeDefId(uid, "dw")} x1="40%" y1="55%" x2="55%" y2="100%">
              <stop offset="0%" stopColor="#143c5c" stopOpacity="0" />
              <stop offset="50%" stopColor="#1a5078" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#0e2840" stopOpacity="0.22" />
            </linearGradient>
          </defs>
          <path
            d="M 18 100 Q 42 78 50 72 Q 62 68 82 100 L 100 100 L 0 100 Z"
            fill={`url(#${safeDefId(uid, "dw")})`}
            opacity={0.9}
          />
        </svg>
      );

    case "pondRimDuckweedMat":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <g fill="#2d7040" opacity={0.35}>
            <circle cx="12" cy="12" r="1.1" />
            <circle cx="22" cy="8" r="0.9" />
            <circle cx="35" cy="14" r="1" />
            <circle cx="48" cy="10" r="0.85" />
            <circle cx="58" cy="16" r="1.05" />
            <circle cx="72" cy="11" r="0.95" />
            <circle cx="85" cy="15" r="1" />
            <circle cx="18" cy="20" r="0.75" />
            <circle cx="40" cy="22" r="0.9" />
            <circle cx="62" cy="20" r="0.8" />
            <circle cx="78" cy="22" r="0.85" />
            <circle cx="28" cy="6" r="0.7" />
            <circle cx="92" cy="8" r="0.65" />
          </g>
        </svg>
      );

    case "pondRimCanopyPerch":
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <radialGradient id={safeDefId(uid, "cp")} cx="50%" cy="-5%" r="58%">
              <stop offset="0%" stopColor="#142018" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#1a3020" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#102010" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="-5" width="100" height="45" fill={`url(#${safeDefId(uid, "cp")})`} />
          <g opacity={0.45} fill="none" stroke="#121c10" strokeLinecap="round" strokeWidth="0.4">
            <path d="M 0 6 Q 30 20 55 14 Q 80 8 100 4" />
            <path d="M 0 12 Q 25 26 52 20 Q 75 14 100 10" strokeWidth="0.32" />
          </g>
        </svg>
      );

    default:
      return null;
  }
}
