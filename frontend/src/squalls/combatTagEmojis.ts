import type { CombatTag } from "./shantiesTypes";

export const COMBAT_TAG_EMOJIS: Record<CombatTag, string> = {
  melee: "🗡️",
  sword: "⚔️",
  ranged: "🎯",
  firearm: "🔫",
  attack: "⚡",
  defense: "🛡️",
};

export function formatCombatTagLabel(tag: CombatTag): string {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export type CombatTagLegendEntry = {
  tag: CombatTag;
  emoji: string;
  label: string;
};

/** Emoji + word label for each tag on a card (detail view key). */
export function getCombatTagLegend(
  tags: readonly CombatTag[],
): CombatTagLegendEntry[] {
  return tags.map((tag) => ({
    tag,
    emoji: COMBAT_TAG_EMOJIS[tag],
    label: formatCombatTagLabel(tag),
  }));
}

/** One emoji per tag, deduped, in tag order. */
export function formatCombatTagEmojis(tags: readonly CombatTag[]): string {
  const seen = new Set<string>();
  const emojis: string[] = [];
  for (const tag of tags) {
    const emoji = COMBAT_TAG_EMOJIS[tag];
    if (seen.has(emoji)) continue;
    seen.add(emoji);
    emojis.push(emoji);
  }
  return emojis.join("");
}
