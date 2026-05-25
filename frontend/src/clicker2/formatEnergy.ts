export const ENERGY_EMOJI = "⚡";

/**
 * U.S. short-scale names from 10^6 (million) through 10^66 (unvigintillion).
 * Thresholds are derived as 10^(3n) for each entry.
 */
export const SHORT_SCALE_LABELS = [
  "million",
  "billion",
  "trillion",
  "quadrillion",
  "quintillion",
  "sextillion",
  "septillion",
  "octillion",
  "nonillion",
  "decillion",
  "undecillion",
  "duodecillion",
  "tredecillion",
  "quattuordecillion",
  "quindecillion",
  "sexdecillion",
  "septendecillion",
  "octodecillion",
  "novemdecillion",
  "vigintillion",
  "unvigintillion",
] as const;

/** U.S. short-scale thresholds: million = 10^6 through unvigintillion = 10^66. */
export const SHORT_SCALE_THRESHOLDS: ReadonlyArray<{
  label: (typeof SHORT_SCALE_LABELS)[number];
  threshold: number;
}> = SHORT_SCALE_LABELS.map((label, i) => ({
  label,
  threshold: 10 ** (3 * (i + 2)),
}));

const SCALE_SUFFIX_PATTERN = new RegExp(
  ` (${SHORT_SCALE_LABELS.join("|")})$`,
);

const SUFFIXES: ReadonlyArray<{ threshold: number; label: string }> = [
  ...SHORT_SCALE_LABELS,
]
  .map((label, i) => ({
    threshold: 10 ** (3 * (i + 2)),
    label,
  }))
  .reverse();

const LARGEST_SUFFIX = SUFFIXES[0];

/** Letter suffixes for click pops (K at 10k+, then M/B/T aligned with short scale). */
const COMPACT_LETTER_SUFFIX: Record<string, string> = {
  million: "M",
  billion: "B",
  trillion: "T",
  quadrillion: "Q",
  quintillion: "Qi",
  sextillion: "Sx",
  septillion: "Sp",
  octillion: "Oc",
  nonillion: "No",
  decillion: "De",
  undecillion: "Ud",
  duodecillion: "Dd",
  tredecillion: "Td",
  quattuordecillion: "Qd",
  quindecillion: "Qn",
  sexdecillion: "Se",
  septendecillion: "Sd",
  octodecillion: "Od",
  novemdecillion: "Nd",
  vigintillion: "V",
  unvigintillion: "Uv",
};

const HUD_NUMBER_LOCALE = "en-US" as const;

/** Drop insignificant trailing zeros (1.200 → 1.2); keep commas from locale. */
function trimDecimalZeros(s: string): string {
  return s.replace(/\.0+$/, "").replace(/(\.[0-9]*?)0+$/, "$1");
}

/** HUD mantissa: always three fractional digits for stable counter width. */
function formatMantissaHud(value: number): string {
  const r = Math.round(value * 1000) / 1000;
  return r.toLocaleString(HUD_NUMBER_LOCALE, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/** At most six significant digits in the mantissa portion. */
function formatMantissa(value: number): string {
  if (value >= 100) {
    const r = Math.round(value * 10) / 10;
    return trimDecimalZeros(
      r.toLocaleString(HUD_NUMBER_LOCALE, { maximumFractionDigits: 1 }),
    );
  }
  if (value >= 10) {
    const r = Math.round(value * 100) / 100;
    return trimDecimalZeros(
      r.toLocaleString(HUD_NUMBER_LOCALE, { maximumFractionDigits: 2 }),
    );
  }
  const r = Math.round(value * 1000) / 1000;
  return trimDecimalZeros(
    r.toLocaleString(HUD_NUMBER_LOCALE, { maximumFractionDigits: 3 }),
  );
}

/** Spelled-out suffixes; never more than six digits in the numeric portion. */
export function formatEnergyAmount(n: number): string {
  const x = Math.max(0, n);
  if (!Number.isFinite(x)) return "0";
  if (x < 1e6) {
    return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
  }
  for (const { threshold, label } of SUFFIXES) {
    if (x >= threshold) {
      return `${formatMantissa(x / threshold)} ${label}`;
    }
  }
  if (LARGEST_SUFFIX && x >= LARGEST_SUFFIX.threshold) {
    return `${formatMantissa(x / LARGEST_SUFFIX.threshold)} ${LARGEST_SUFFIX.label}`;
  }
  return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
}

/** Main pond energy counter — fixed three decimals when a scale word is shown. */
export function formatEnergyAmountHud(n: number): string {
  const x = Math.max(0, n);
  if (!Number.isFinite(x)) return "0";
  if (x < 1e6) {
    return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
  }
  for (const { threshold, label } of SUFFIXES) {
    if (x >= threshold) {
      return `${formatMantissaHud(x / threshold)} ${label}`;
    }
  }
  if (LARGEST_SUFFIX && x >= LARGEST_SUFFIX.threshold) {
    return `${formatMantissaHud(x / LARGEST_SUFFIX.threshold)} ${LARGEST_SUFFIX.label}`;
  }
  return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
}

/** Shorter mantissa for high-rate click pop labels. */
function formatMantissaCompact(value: number): string {
  if (value >= 100) return String(Math.round(value));
  if (value >= 10) {
    const r = Math.round(value * 10) / 10;
    return trimDecimalZeros(r.toFixed(1));
  }
  const r = Math.round(value * 100) / 100;
  return trimDecimalZeros(r.toFixed(2));
}

/** Abbreviated energy for click pops (e.g. `50K`, `12M`, `4.5B`). */
export function formatEnergyAmountCompact(n: number): string {
  const x = Math.max(0, n);
  if (!Number.isFinite(x)) return "0";
  if (x < 10_000) {
    return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
  }
  if (x < 1e6) {
    return `${formatMantissaCompact(x / 1e3)}K`;
  }
  for (const { threshold, label } of SUFFIXES) {
    if (x >= threshold) {
      const suffix = COMPACT_LETTER_SUFFIX[label] ?? label.slice(0, 1).toUpperCase();
      return `${formatMantissaCompact(x / threshold)}${suffix}`;
    }
  }
  if (LARGEST_SUFFIX && x >= LARGEST_SUFFIX.threshold) {
    const suffix =
      COMPACT_LETTER_SUFFIX[LARGEST_SUFFIX.label] ??
      LARGEST_SUFFIX.label.slice(0, 1).toUpperCase();
    return `${formatMantissaCompact(x / LARGEST_SUFFIX.threshold)}${suffix}`;
  }
  return Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE);
}

/** Split formatted energy into mantissa and lower-case scale word (for HUD typography). */
export function splitEnergyAmountDisplay(formatted: string): {
  valuePart: string;
  scaleSuffix: string | null;
} {
  const m = formatted.match(SCALE_SUFFIX_PATTERN);
  if (!m || m.index == null) {
    return { valuePart: formatted, scaleSuffix: null };
  }
  return {
    valuePart: formatted.slice(0, m.index),
    scaleSuffix: m[1]!.toLowerCase(),
  };
}

/** EpS display — keeps fractional rates (e.g. Ripples at 0.1+ per copy). */
export function formatEnergyRate(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const sign = n < 0 ? "-" : "";
  const x = Math.abs(n);
  if (x === 0) return "0";
  if (x >= 1e6) {
    return `${sign}${formatEnergyAmount(x)}`;
  }
  if (x < 1) {
    const r = Math.round(x * 1000) / 1000;
    return `${sign}${r.toLocaleString(HUD_NUMBER_LOCALE, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 3,
    })}`;
  }
  if (x >= 100 || Number.isInteger(x)) {
    return `${sign}${Math.floor(x).toLocaleString(HUD_NUMBER_LOCALE)}`;
  }
  const r = Math.round(x * 100) / 100;
  return `${sign}${r.toLocaleString(HUD_NUMBER_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatShopCost(v: number): string {
  return `${formatEnergyAmount(Math.max(0, Math.round(v)))} ${ENERGY_EMOJI}`;
}
