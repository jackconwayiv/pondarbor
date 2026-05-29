import { formatIndoorAreaId } from "./shantiesItems";
import type { DungeonKind, DungeonType, EventType, IslandType } from "./shantiesTypes";

export const DUNGEON_DISCOVERY_EVENT_TYPE = "dungeon_discovery";

const KIND_PREFIX: Record<DungeonKind, string> = {
  cave: "Cave",
  ruins: "Ruins",
  temple: "Temple",
  wreck: "Wreck",
};

const KIND_EMOJI: Record<DungeonKind, string> = {
  cave: "🕳️",
  ruins: "🏛️",
  temple: "⛩️",
  wreck: "🚢",
};

export function getDungeonKindLabel(kind: DungeonKind): string {
  return KIND_PREFIX[kind];
}

export function getDungeonKindEmoji(kind: DungeonKind): string {
  return KIND_EMOJI[kind];
}

export function renderDungeonName(dungeon: DungeonType): string {
  return dungeon.name;
}

export function isDungeonDiscoveryEvent(event: EventType): boolean {
  return event.type === DUNGEON_DISCOVERY_EVENT_TYPE && event.dungeonKind != null;
}

export function getDungeonDiscoveryEventName(kind: DungeonKind): string {
  const labels: Record<DungeonKind, string> = {
    cave: "A Cave Mouth",
    ruins: "Ancient Ruins",
    temple: "A Hidden Temple",
    wreck: "A Sunken Wreck",
  };
  return labels[kind];
}

export function createDungeonDiscoveryEvent(kind: DungeonKind): EventType {
  return {
    name: getDungeonDiscoveryEventName(kind),
    type: DUNGEON_DISCOVERY_EVENT_TYPE,
    dungeonKind: kind,
  };
}

export function generateDungeonAreaKey(
  kind: DungeonKind,
  island: IslandType | null,
): string {
  const base = island?.name.replace(/\s+/g, "-").toLowerCase() ?? "unknown";
  const slug = Math.random().toString(36).slice(2, 8);
  return `${base}-${kind}-${slug}`;
}

export function generateDungeon(
  kind: DungeonKind,
  island: IslandType | null,
): DungeonType {
  const prefixes: Record<DungeonKind, string[]> = {
    cave: ["Damp", "Echoing", "Collapsed", "Crystal"],
    ruins: ["Crumbling", "Forgotten", "Overgrown", "Sunken"],
    temple: ["Sealed", "Sacred", "Desecrated", "Moonlit"],
    wreck: ["Flooded", "Barnacled", "Rotting", "Sunken"],
  };
  const nouns: Record<DungeonKind, string[]> = {
    cave: ["Grotto", "Caverns", "Depths", "Warren"],
    ruins: ["Ruins", "Vestiges", "Foundations", "Halls"],
    temple: ["Temple", "Sanctum", "Shrine", "Vault"],
    wreck: ["Hold", "Hull", "Berth", "Cabin"],
  };
  const pre = prefixes[kind][Math.floor(Math.random() * prefixes[kind].length)]!;
  const noun = nouns[kind][Math.floor(Math.random() * nouns[kind].length)]!;
  const areaKey = generateDungeonAreaKey(kind, island);

  let delvePoints = 5;
  if (island?.size === "Small") delvePoints -= 2;
  if (island?.size === "Large") delvePoints += 2;

  let levelFactor = 0;
  if (island?.vibe === "Foreboding") levelFactor += 1;
  if (island?.vibe === "Inviting") levelFactor -= 1;

  return {
    kind,
    name: `${pre} ${noun}`,
    delvePoints,
    levelFactor,
    areaId: formatIndoorAreaId(kind, areaKey),
    ...(isIslandDungeonKind(kind) ? { candleUnlocked: false } : {}),
  };
}

export function isIslandDungeonKind(kind: DungeonKind): boolean {
  return kind !== "wreck";
}

export function isDepletedDungeon(dungeon: DungeonType): boolean {
  return dungeon.delvePoints <= 0;
}

/** Island home menu: only dungeons the player entered with a candle. */
export function isActiveIslandDungeon(dungeon: DungeonType): boolean {
  return (
    isIslandDungeonKind(dungeon.kind) &&
    !isDepletedDungeon(dungeon) &&
    dungeon.candleUnlocked === true
  );
}

export function getEnterDungeonLabel(dungeon: DungeonType): string {
  return `Enter ${KIND_PREFIX[dungeon.kind]} (${dungeon.delvePoints})`;
}

export function getDungeonCombatPlaceLabel(kind: DungeonKind): string {
  return `${KIND_PREFIX[kind]} Delve`;
}
