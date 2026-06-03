import { Heading, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import { PanelEmptyState, PanelSessionReconnect } from "../components/panelStatus";
import { APP_TEXT_SIZES } from "../theme/typography";
import { deleteGame, fetchGames, fetchScorenadoStats } from "./api";
import { SCORENADO_HISTORY_CARD_GRID_PROPS } from "./ScorenadoGameCard";
import { ScorenadoGameDetailModal } from "./ScorenadoGameDetailModal";
import { ScorenadoHistoryCard } from "./ScorenadoHistoryCard";
import { sortGamesByRecentPlayed } from "./scorenadoSort";
import type { GameListItem, ScorenadoStats } from "./types";

export default function ScorenadoHistoryPage() {
  const { getApiAccessToken } = useAppSession();
  const [games, setGames] = useState<GameListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GameListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stats, setStats] = useState<ScorenadoStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      setGames(sortGamesByRecentPlayed(await fetchGames(token)));
      setStats(await fetchScorenadoStats(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load games.");
    } finally {
      setLoading(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const removeGame = async (g: GameListItem) => {
    setDeleteBusy(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await deleteGame(token, g.id);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      throw err;
    } finally {
      setDeleteBusy(false);
    }
  };

  if (loading) {
    return (
      <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        Loading games…
      </Text>
    );
  }

  if (error && games.length === 0) {
    return (
      <PanelSessionReconnect sessionError={error} onRetry={() => void load()} />
    );
  }

  return (
    <Stack gap="4" w="100%" minW="0">
      <Heading size="sm" className="scorenado-pixel-title" fontSize="0.75rem">
        Game history
      </Heading>

      {stats ? (
        <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          {stats.wins} wins · {stats.games_participated} games played
        </Text>
      ) : null}

      {error ? (
        <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
          {error}
        </Text>
      ) : null}

      {games.length === 0 ? (
        <PanelEmptyState
          title="No games yet"
          description="Start a game from the Play tab."
        />
      ) : (
        <SimpleGrid {...SCORENADO_HISTORY_CARD_GRID_PROPS}>
          {games.map((g) => (
            <ScorenadoHistoryCard
              key={g.id}
              game={g}
              onClick={() => setSelected(g)}
            />
          ))}
        </SimpleGrid>
      )}

      <ScorenadoGameDetailModal
        game={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        deleteBusy={deleteBusy}
        onDelete={removeGame}
      />
    </Stack>
  );
}
