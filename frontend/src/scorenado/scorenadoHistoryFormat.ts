import type { GameListItem } from "./types";

/** Card/modal lines when API `title` defaults to template name. */
export function historyGameLabels(game: GameListItem): {
  primary: string;
  templateLine: string | null;
} {
  const template = game.template_name.trim();
  const rawTitle = game.title?.trim() ?? "";
  if (rawTitle && rawTitle !== template) {
    return { primary: rawTitle, templateLine: template };
  }
  return { primary: template, templateLine: null };
}

/** Scoreboard header date, e.g. 06/15/24. */
export function formatPlayedAtMdYy(playedAt: string | null): string {
  if (!playedAt) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(playedAt.trim());
  if (match) {
    const [, year, month, day] = match;
    return `${month}/${day}/${year.slice(-2)}`;
  }
  const d = new Date(playedAt);
  if (Number.isNaN(d.getTime())) return playedAt;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear() % 100).padStart(2, "0");
  return `${mm}/${dd}/${yy}`;
}

export function formatPlayedAtShort(playedAt: string | null): string {
  if (!playedAt) return "No date";
  const d = new Date(playedAt);
  if (Number.isNaN(d.getTime())) return playedAt;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
