import { DENIZENS, getDenizenDef, type DenizenDef } from "./denizens";

/** Emojis per wrapped row in the depth chart (no horizontal scroll). */
export const POND_DEPTH_CHART_WRAP = 30;

/** Fixed visible emoji rows per denizen band (extra purchases clip, no resize). */
export const POND_DEPTH_CHART_MAX_VISIBLE_ROWS = 2;

/** Max glyphs materialized per denizen row (matches visible chart rows × wrap). */
export const POND_DEPTH_CHART_MAX_VISIBLE_GLYPHS =
  POND_DEPTH_CHART_MAX_VISIBLE_ROWS * POND_DEPTH_CHART_WRAP;

/**
 * Display order top → bottom (sky/mythic rim down to pond floor).
 * Ecological placement only — not shop unlock tier.
 * Sediment is always the bottom band; leviathans sit just above abyssals.
 */
export const DENIZEN_DEPTH_ORDER: readonly string[] = [
  // sky / mythic rim
  "transcendence",
  "celestials",
  "spirits",
  // air, shore, and land–water margin
  "hunting_birds",
  "waterfowl",
  "cryptids",
  "humans",
  "great_mammals",
  "shore_mammals",
  "amphibians",
  "reptiles",
  // surface film and upper water column
  "ripples",
  "zooplankton",
  // littoral structure and shallow open water
  "aquatic_plants",
  "small_swimmers",
  "small_fish",
  // deep open water and benthos
  "large_fish",
  "invertebrates",
  "leviathans",
  "abyssals",
  // decomposers and floor
  "fungi",
  "microbes",
  "sediment",
];

/**
 * Six depth zones, top → bottom. Muted analogous blues and greens aligned with
 * PondArbor sky tokens, stepping into warm sediment at the floor (readable behind emojis).
 */
export const POND_DEPTH_ZONE_COLORS: readonly string[] = [
  "#EBF2F7", // sky / mythic rim
  "#D2E3F0", // air & shore
  "#A9CCE0", // sunlit surface
  "#6FAA8F", // littoral & open water
  "#456B82", // deep water
  "#887560", // sediment floor
];

function channelLuminance(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** True when zone background needs light row labels (WCAG-style relative luminance). */
export function depthZoneLabelOnDark(zoneIndex: number): boolean {
  const hex = depthZoneBackground(zoneIndex);
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  const lum =
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b);
  return lum < 0.45;
}

const DENIZEN_DEPTH_ZONE_BY_ID: Record<string, number> = {
  transcendence: 0,
  celestials: 0,
  spirits: 0,
  hunting_birds: 1,
  cryptids: 1,
  humans: 1,
  great_mammals: 1,
  shore_mammals: 1,
  amphibians: 1,
  reptiles: 1,
  waterfowl: 1,
  ripples: 2,
  zooplankton: 2,
  aquatic_plants: 3,
  small_swimmers: 3,
  small_fish: 3,
  large_fish: 4,
  leviathans: 4,
  abyssals: 4,
  invertebrates: 4,
  fungi: 5,
  microbes: 5,
  sediment: 5,
};

const warnedUnknownEmojis = new Set<string>();

function buildEmojiToDenizenId(): Map<string, string> {
  const map = new Map<string, string>();
  for (const def of DENIZENS) {
    if (map.has(def.emoji)) {
      throw new Error(
        `Duplicate denizen emoji ${def.emoji} (${map.get(def.emoji)} vs ${def.id})`,
      );
    }
    map.set(def.emoji, def.id);
  }
  return map;
}

const EMOJI_TO_DENIZEN_ID = buildEmojiToDenizenId();

export type DenizenDepthRow = {
  def: DenizenDef;
  count: number;
  glyphsJoined: string;
  /** Up to {@link POND_DEPTH_CHART_WRAP} emojis per line, oldest → newest within each line. */
  glyphLines: readonly string[];
  /** 0–5 index into {@link POND_DEPTH_ZONE_COLORS}. */
  zoneIndex: number;
};

export function depthZoneForDenizen(denizenId: string): number {
  return DENIZEN_DEPTH_ZONE_BY_ID[denizenId] ?? 2;
}

export function depthZoneBackground(zoneIndex: number): string {
  const i = Math.min(
    Math.max(0, Math.floor(zoneIndex)),
    POND_DEPTH_ZONE_COLORS.length - 1,
  );
  return POND_DEPTH_ZONE_COLORS[i]!;
}

/** Split timeline emoji entries into display lines of at most `wrap` emojis each. */
export function wrapEmojiGlyphEntries(
  glyphs: readonly string[],
  wrap: number = POND_DEPTH_CHART_WRAP,
): string[] {
  if (glyphs.length === 0) return [];
  const cap = Math.max(1, Math.floor(wrap));
  const lines: string[] = [];
  for (let i = 0; i < glyphs.length; i += cap) {
    lines.push(glyphs.slice(i, i + cap).join(""));
  }
  return lines;
}

/**
 * Split a joined glyph string into rows of at most `wrap` grapheme clusters.
 * Prefer {@link wrapEmojiGlyphEntries} when individual timeline emojis are available.
 */
export function wrapEmojiGlyphs(
  glyphs: string,
  wrap: number = POND_DEPTH_CHART_WRAP,
): string[] {
  if (!glyphs) return [];
  return wrapEmojiGlyphEntries(splitEmojiGraphemes(glyphs), wrap);
}

function splitEmojiGraphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, {
      granularity: "grapheme",
    });
    return [...segmenter.segment(text)].map((part) => part.segment);
  }
  return Array.from(text);
}

function warnUnknownEmojiOnce(emoji: string): void {
  if (import.meta.env.PROD) return;
  if (warnedUnknownEmojis.has(emoji)) return;
  warnedUnknownEmojis.add(emoji);
  console.warn(`[pondDepthChart] Unknown timeline emoji: ${emoji}`);
}

/**
 * Partition purchase timeline (newest-first) into per-denizen rows in depth order.
 * Within each row, glyphs are oldest → newest (left → right), wrapped every 30.
 */
export function partitionTimelineByDenizen(
  timeline: readonly string[],
): DenizenDepthRow[] {
  const buckets = new Map<string, string[]>();
  for (const def of DENIZENS) {
    buckets.set(def.id, []);
  }

  for (const emoji of timeline) {
    if (!emoji) continue;
    const denizenId = EMOJI_TO_DENIZEN_ID.get(emoji);
    if (!denizenId) {
      warnUnknownEmojiOnce(emoji);
      continue;
    }
    buckets.get(denizenId)?.push(emoji);
  }

  const out: DenizenDepthRow[] = [];
  for (const denizenId of DENIZEN_DEPTH_ORDER) {
    const def = getDenizenDef(denizenId);
    if (!def) continue;
    const glyphs = buckets.get(def.id);
    if (!glyphs || glyphs.length === 0) continue;
    glyphs.reverse();
    const count = glyphs.length;
    const visibleGlyphs =
      count > POND_DEPTH_CHART_MAX_VISIBLE_GLYPHS
        ? glyphs.slice(-POND_DEPTH_CHART_MAX_VISIBLE_GLYPHS)
        : glyphs;
    const glyphsJoined = visibleGlyphs.join("");
    out.push({
      def,
      count,
      glyphsJoined,
      glyphLines: wrapEmojiGlyphEntries(visibleGlyphs),
      zoneIndex: depthZoneForDenizen(def.id),
    });
  }

  return out;
}
