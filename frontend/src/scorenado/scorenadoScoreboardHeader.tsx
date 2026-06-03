import { createContext, useContext } from "react";

import { formatPlayedAtMdYy } from "./scorenadoHistoryFormat";

export type ScoreboardHeaderState = {
  title: string;
  meta: string;
};

type ScoreboardHeaderContextValue = {
  setScoreboardHeader: (header: ScoreboardHeaderState | null) => void;
};

export const ScoreboardHeaderContext =
  createContext<ScoreboardHeaderContextValue | null>(null);

export function useScoreboardHeader(): ScoreboardHeaderContextValue {
  const ctx = useContext(ScoreboardHeaderContext);
  if (!ctx) {
    throw new Error("useScoreboardHeader must be used within ScorenadoLayout");
  }
  return ctx;
}

/** Primary label for a game (custom title, else template name). */
export function gameDisplayName(game: {
  title: string;
  template: { name: string };
}): string {
  const template = game.template.name.trim();
  const rawTitle = game.title?.trim() ?? "";
  if (rawTitle && rawTitle !== template) return rawTitle;
  return template;
}

export function scoreboardHeaderMeta(game: {
  played_at: string | null;
  is_finalized: boolean;
}): string {
  const parts = [
    game.played_at ? formatPlayedAtMdYy(game.played_at) : null,
    game.is_finalized ? "Finalized" : "In progress",
  ].filter(Boolean);
  return parts.join(" · ");
}
