import type {
  DungeonType,
  GameLocationTypes,
  GameStateTypes,
  IslandType,
  PortTownType,
  SaveSummaryLine,
} from "./shantiesTypes";
import type { ShantiesSaveData } from "./shantiesLocalSave";

const GAME_STATE_LABELS: Record<GameStateTypes, string> = {
  lobby: "Lobby",
  shop: "Shopping",
  home: "Adventuring",
  battle: "In combat",
  rest: "Resting",
  explore: "Exploring",
  event: "Event",
  sail: "Sailing",
  dead: "Defeated",
  tavern: "Tavern",
  shipwright: "Shipwright",
  cookstove: "Cookstove",
  exploreTest: "Test picker",
};

export function formatGameStateLabel(state: GameStateTypes): string {
  return GAME_STATE_LABELS[state] ?? state;
}

export function formatIslandDisplayName(island: IslandType): string {
  let fullIslandName = "";
  if (island.size) fullIslandName += `${island.size}, `;
  if (island.vibe) fullIslandName += `${island.vibe} `;
  fullIslandName += island.name;
  return fullIslandName;
}

export function hasResumableAdventure(data: ShantiesSaveData): boolean {
  if (data.resumeGameState !== null) return true;
  if (data.gameState !== "lobby") return true;

  return (
    data.day > 1 ||
    data.hero.xp > 0 ||
    data.hero.gold !== 50 ||
    data.hero.current_hp < data.hero.max_hp ||
    data.currentIsland !== null
  );
}

export function buildSaveSummaryLines(
  data: ShantiesSaveData,
  renderIslandName: (island: IslandType) => string,
  renderPortTownName: (port: PortTownType) => string = (port) =>
    `${port.size} of ${port.vibe}`,
): SaveSummaryLine[] {
  const {
    hero,
    day,
    location,
    currentIsland,
    currentPortTown,
    gameState,
    resumeGameState,
  } = data;
  const placeLabel = formatPlaceLabel(
    location,
    currentIsland,
    renderIslandName,
    null,
    (d) => d.name,
    currentPortTown,
    renderPortTownName,
  );
  const statusState = resumeGameState ?? gameState;

  return [
    { label: "Captain", value: `${hero.name} (${hero.class})` },
    { label: "Day", value: String(day) },
    { label: "HP", value: `${hero.current_hp} / ${hero.max_hp}` },
    { label: "Gold", value: String(hero.gold) },
    { label: "XP", value: String(hero.xp) },
    { label: "Location", value: placeLabel },
    {
      label: "Status",
      value:
        resumeGameState !== null
          ? `Paused (${formatGameStateLabel(resumeGameState)})`
          : formatGameStateLabel(statusState),
    },
    { label: "Deck", value: `${hero.deck.length} cards` },
  ];
}

export function formatPlaceLabel(
  location: GameLocationTypes,
  currentIsland: IslandType | null,
  renderIslandName: (island: IslandType) => string,
  currentDungeon: DungeonType | null = null,
  renderDungeonName: (dungeon: DungeonType) => string = (d) => d.name,
  currentPortTown: PortTownType | null = null,
  renderPortTownName: (port: PortTownType) => string = (port) =>
    `${port.size} of ${port.vibe}`,
): string {
  if (location === "dungeon" && currentDungeon) {
    return renderDungeonName(currentDungeon);
  }
  if (location === "island" && currentIsland) {
    return renderIslandName(currentIsland);
  }
  if (location === "port" && currentPortTown) {
    return renderPortTownName(currentPortTown);
  }
  if (location === "island") return "Island";
  if (location === "port") return "Port";
  if (location === "dungeon") return "Dungeon";
  return "Ship";
}

export function formatSavedAt(savedAtMs: number | null): string | null {
  if (savedAtMs === null || !Number.isFinite(savedAtMs)) return null;
  return new Date(savedAtMs).toLocaleString();
}
