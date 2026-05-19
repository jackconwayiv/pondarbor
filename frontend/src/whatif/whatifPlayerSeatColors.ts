import type { WhatIfPlayer } from "./types";

/** Join-order seat colors: blue, red, yellow, green, orange, purple, brown, pink. */
export const WHATIF_SEAT_COLOR_BASE = [
  "#2563eb",
  "#dc2626",
  "#ca8a04",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#92400e",
  "#db2777",
] as const;

export type WhatIfPlayerFaceRingSize = "sm" | "md" | "lg" | "xl" | "2xl";

function mixHex(hex: string, other: string, amount: number): string {
  const parse = (h: string) => {
    const n = h.replace("#", "");
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  };
  const [r0, g0, b0] = parse(hex);
  const [r1, g1, b1] = parse(other);
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** Ring color for join-order seat index (0-based). Cycles hue; 8–15 lighter, 16–23 darker. */
export function whatifSeatRingColor(seatIndex: number): string {
  if (seatIndex < 0) return WHATIF_SEAT_COLOR_BASE[0];
  const tier = Math.floor(seatIndex / 8);
  const idx = seatIndex % 8;
  const base = WHATIF_SEAT_COLOR_BASE[idx];
  if (tier === 0) return base;
  if (tier === 1) return mixHex(base, "#ffffff", 0.3);
  if (tier === 2) return mixHex(base, "#000000", 0.2);
  return base;
}

export function whatifPlayerSeatIndex(playerId: number, players: WhatIfPlayer[]): number {
  return players.findIndex((p) => p.id === playerId);
}

/** Neutral ring for NPC emoji avatars (not join-order seat hue). */
export function whatifNpcRingColor(): string {
  return "#a1a1aa";
}

export function whatifSeatRingWidth(avatarSize: WhatIfPlayerFaceRingSize): number {
  if (avatarSize === "sm") return 2;
  return 3;
}

/**
 * Match Chakra `Avatar` `--avatar-size` per `size` prop (sizes.9–sizes.16).
 * `lg` is tuned slightly under token size so emoji matches photo avatars on the TV scoreboard.
 */
export function whatifAvatarEmojiBoxSize(avatarSize: WhatIfPlayerFaceRingSize): string {
  switch (avatarSize) {
    case "sm":
      return "2.25rem"; // sizes.9
    case "md":
      return "2.5rem"; // sizes.10
    case "lg":
      return "2.6875rem"; // ~sizes.11 (scoreboard-tuned)
    case "xl":
      return "3.5625rem";
    case "2xl":
      return "4.4375rem";
    default:
      return "2.5rem";
  }
}

/** Emoji glyph scale within {@link whatifAvatarEmojiBoxSize} (same ratio as tuned `lg`). */
export function whatifAvatarEmojiFontSize(avatarSize: WhatIfPlayerFaceRingSize): string {
  switch (avatarSize) {
    case "sm":
      return "1.675rem";
    case "md":
      return "1.86rem";
    case "lg":
      return "2rem";
    case "xl":
      return "2.7rem";
    case "2xl":
      return "3.35rem";
    default:
      return "1.86rem";
  }
}
