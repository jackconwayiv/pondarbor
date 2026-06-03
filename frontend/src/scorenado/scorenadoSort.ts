import type { GameListItem, ScoreboardTemplate } from "./types";

function timeOrZero(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Templates tab: most recently created or edited first. */
export function sortTemplatesByUpdated(
  templates: ScoreboardTemplate[],
): ScoreboardTemplate[] {
  return [...templates].sort(
    (a, b) => timeOrZero(b.updated_at) - timeOrZero(a.updated_at),
  );
}

/** Play tab: templates used in a game most recently first. */
export function sortTemplatesByLastPlayed(
  templates: ScoreboardTemplate[],
): ScoreboardTemplate[] {
  return [...templates].sort((a, b) => {
    const diff = timeOrZero(b.last_played_at) - timeOrZero(a.last_played_at);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

/** History: most recently played (then last updated) first. */
export function sortGamesByRecentPlayed(games: GameListItem[]): GameListItem[] {
  return [...games].sort((a, b) => {
    const playedDiff = timeOrZero(b.played_at) - timeOrZero(a.played_at);
    if (playedDiff !== 0) return playedDiff;
    return timeOrZero(b.updated_at) - timeOrZero(a.updated_at);
  });
}
