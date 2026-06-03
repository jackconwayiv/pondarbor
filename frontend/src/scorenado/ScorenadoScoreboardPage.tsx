import {
  Box,
  HStack,
  Stack,
  Table,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { PanelEmptyState, PanelSessionReconnect } from "../components/panelStatus";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  deleteGame,
  fetchGame,
  finalizeGame,
  upsertScore,
} from "./api";
import { playerColorBg } from "./playerColors";
import { ScorenadoGameSettingsModal } from "./ScorenadoGameSettingsModal";
import { ScorenadoPlayerSettingsModal } from "./ScorenadoPlayerSettingsModal";
import { seatStatusLabel } from "./ScorenadoPlayerSeatEditor";
import { playerDisplayName } from "./playerDisplayName";
import { applyGameSettings } from "./scorenadoGameSettings";
import {
  isGameReadyToFinish,
  isScoredByRounds,
  roundCategoryTableRows,
  scoresForRound,
  scoringStepCount,
  scoringStepFromIndex,
  scoringStepIndex,
  suggestedScoringStart,
} from "./scorenadoRounds";
import {
  gameDisplayName,
  scoreboardHeaderMeta,
  useScoreboardHeader,
} from "./scorenadoScoreboardHeader";
import { ScoringModal } from "./ScoringModal";
import type { GameDetail } from "./types";

export default function ScorenadoScoreboardPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { getApiAccessToken } = useAppSession();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoringOpen, setScoringOpen] = useState(false);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [activeRound, setActiveRound] = useState(1);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const { setScoreboardHeader } = useScoreboardHeader();

  const load = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const loaded = await fetchGame(token, gameId);
      setGame(loaded);
      setActiveRound(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load game.");
      setGame(null);
    } finally {
      setLoading(false);
    }
  }, [gameId, getApiAccessToken]);

  const refreshGame = useCallback(async () => {
    if (!gameId) return;
    setError(null);
    const token = await getApiAccessToken();
    setGame(await fetchGame(token, gameId));
  }, [gameId, getApiAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!game) {
      setScoreboardHeader(null);
      return;
    }
    setScoreboardHeader({
      title: gameDisplayName(game).toUpperCase(),
      meta: scoreboardHeaderMeta(game),
    });
    return () => setScoreboardHeader(null);
  }, [game, setScoreboardHeader]);

  const readOnly = !game?.can_edit;

  const handleScoreChange = async (
    playerId: string,
    value: number | null,
  ) => {
    if (!game || !gameId) return;
    const category = game.template.categories[activeCategoryIndex];
    if (!category) return;
    const roundBased = isScoredByRounds(game.template.scored_by_rounds);
    try {
      const token = await getApiAccessToken();
      const latest = await upsertScore(token, gameId, {
        category_id: category.id,
        player_id: playerId,
        value,
        ...(roundBased ? { round_number: activeRound } : {}),
      });
      setGame(latest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save scores.");
    }
  };

  if (loading) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        Loading scoreboard…
      </Text>
    );
  }

  if (error && !game) {
    return (
      <PanelSessionReconnect sessionError={error} onRetry={() => void load()} />
    );
  }

  if (!game || !gameId) {
    return <PanelEmptyState title="Game not found" />;
  }

  const roundBased = isScoredByRounds(game.template.scored_by_rounds);
  const categories = game.template.categories;
  const scoreRows = roundBased
    ? roundCategoryTableRows(categories, game.round_count)
    : categories.map((category, categoryIndex) => ({
        categoryIndex,
        roundNumber: 1,
        category,
        isFirstRoundForCategory: true,
        categoryRoundSpan: 1,
      }));

  const changeScoringStep = (delta: number) => {
    if (roundBased) {
      const nextIndex = activeCategoryIndex + delta;
      if (nextIndex < 0 || nextIndex >= categories.length) return;
      setActiveCategoryIndex(nextIndex);
      return;
    }
    const total = scoringStepCount(
      categories.length,
      game.round_count,
      roundBased,
    );
    const step = scoringStepIndex(
      activeCategoryIndex,
      activeRound,
      game.round_count,
      roundBased,
    );
    const next = Math.max(0, Math.min(total - 1, step + delta));
    const target = scoringStepFromIndex(next, game.round_count, roundBased);
    setActiveCategoryIndex(target.categoryIndex);
    setActiveRound(target.roundNumber);
  };

  const openScoringForRow = (categoryIndex: number, roundNumber: number) => {
    setActiveCategoryIndex(categoryIndex);
    setActiveRound(roundNumber);
    setScoringOpen(true);
  };

  const openScoringForGame = () => {
    const start = suggestedScoringStart(game);
    openScoringForRow(start.categoryIndex, start.roundNumber);
  };

  const readyToFinish = !readOnly && isGameReadyToFinish(game);
  const activePlayer =
    activePlayerId != null
      ? game.players.find((p) => p.id === activePlayerId) ?? null
      : null;

  return (
    <Stack
      gap={{ base: "2", md: "3" }}
      className="scorenado-scoreboard"
    >
      <HStack justify="flex-end" flexWrap="wrap" gap="2">
          {!readOnly ? (
            <>
              <PondButton
                size="sm"
                variant="outline"
                colorPalette="gray"
                onClick={() => setSettingsOpen(true)}
              >
                Settings
              </PondButton>
              <PondButton
                size="sm"
                colorPalette="lilypad"
                onClick={() => openScoringForGame()}
              >
                Enter scores
              </PondButton>
              {readyToFinish ? (
                <PondButton
                  size="sm"
                  colorPalette="teal"
                  flexShrink={0}
                  onClick={() => {
                    void (async () => {
                      try {
                        const token = await getApiAccessToken();
                        const updated = await finalizeGame(token, gameId);
                        setGame(updated);
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Could not finalize.",
                        );
                      }
                    })();
                  }}
                >
                  FINISH GAME
                </PondButton>
              ) : null}
            </>
          ) : null}
      </HStack>

      {error ? (
        <Text color="nautical.solid" fontSize={APP_TEXT_SIZES.helper}>
          {error}
        </Text>
      ) : null}

      {readOnly && !game.is_finalized ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          View only — you can watch scores but not edit them.
        </Text>
      ) : null}

      <Box
        overflowX="auto"
        className="scorenado-scoreboard-table-wrap"
        borderWidth={{ base: "0", md: "1px" }}
        borderColor="border"
        borderRadius={{ base: "0", md: "lg" }}
      >
          <Table.Root size="sm" variant="outline" className="scorenado-pixel-body">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader
                  w={{ base: "4.75rem", md: "8.75rem" }}
                  minW={{ base: "4.75rem", md: "8.75rem" }}
                />
                {roundBased ? (
                  <Table.ColumnHeader
                    w={{ base: "2.25rem", md: "3rem" }}
                    minW={{ base: "2.25rem", md: "3rem" }}
                    textAlign="center"
                    className="scorenado-round-header"
                  >
                    Rnd
                  </Table.ColumnHeader>
                ) : null}
                {game.players.map((p) => (
                  <Table.ColumnHeader
                    key={p.id}
                    textAlign="center"
                    bg={playerColorBg(p.color)}
                    cursor={game.can_edit && !game.is_finalized ? "pointer" : "default"}
                    title={
                      game.can_edit && !game.is_finalized
                        ? seatStatusLabel(p)
                        : undefined
                    }
                    onClick={() => {
                      if (!game.can_edit || game.is_finalized) return;
                      setActivePlayerId(p.id);
                    }}
                  >
                    <span>{playerDisplayName(p)}</span>
                  </Table.ColumnHeader>
                ))}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <Table.Row fontWeight="bold" bg="gray.50">
                <Table.Cell
                  className="scorenado-category-label"
                  colSpan={roundBased ? 2 : 1}
                >
                  TOTAL
                </Table.Cell>
                {game.players.map((p) => (
                  <Table.Cell
                    key={p.id}
                    textAlign="center"
                    className="scorenado-score-cell"
                  >
                    {p.total ?? "—"}
                    {p.is_winner ? " ★" : ""}
                  </Table.Cell>
                ))}
              </Table.Row>
              {scoreRows.map((row, rowIdx) => {
                const { category, categoryIndex, roundNumber } = row;
                const cellScores = scoresForRound(
                  category,
                  roundNumber,
                  roundBased,
                );
                return (
                <Table.Row
                  key={`${category.id}-${roundNumber}`}
                  className={
                    rowIdx % 2 === 0
                      ? "scorenado-category-row-even"
                      : "scorenado-category-row-odd"
                  }
                  cursor={readOnly ? "default" : "pointer"}
                  _hover={readOnly ? undefined : { bg: "bg.subtle" }}
                  onClick={() => {
                    if (readOnly) return;
                    openScoringForRow(categoryIndex, roundNumber);
                  }}
                >
                  {row.isFirstRoundForCategory ? (
                    <Table.Cell
                      rowSpan={row.categoryRoundSpan}
                      className="scorenado-category-label"
                      title={category.description || undefined}
                      fontWeight="semibold"
                      verticalAlign="top"
                    >
                      {category.name}
                    </Table.Cell>
                  ) : null}
                  {roundBased ? (
                    <Table.Cell
                      textAlign="center"
                      className="scorenado-round-label"
                      fontWeight="semibold"
                    >
                      {roundNumber}
                    </Table.Cell>
                  ) : null}
                  {game.players.map((p) => (
                    <Table.Cell
                      key={p.id}
                      textAlign="center"
                      className="scorenado-score-cell"
                    >
                      {cellScores[p.id] ?? "—"}
                    </Table.Cell>
                  ))}
                </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
      </Box>

      <ScoringModal
        open={scoringOpen}
        onOpenChange={setScoringOpen}
        game={game}
        categoryIndex={activeCategoryIndex}
        activeRound={activeRound}
        onScoringStepChange={changeScoringStep}
        onScoreChange={handleScoreChange}
        onPlayOn={() => setScoringOpen(false)}
        onScoreNextRound={() => {
          setActiveRound((round) => round + 1);
          setActiveCategoryIndex(0);
        }}
        finalizeBusy={finalizeBusy}
        onFinalizeGame={() => {
          void (async () => {
            setFinalizeBusy(true);
            setError(null);
            try {
              const token = await getApiAccessToken();
              const updated = await finalizeGame(token, gameId);
              setGame(updated);
              setScoringOpen(false);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Could not finalize.",
              );
            } finally {
              setFinalizeBusy(false);
            }
          })();
        }}
      />

      <ScorenadoPlayerSettingsModal
        game={game}
        player={activePlayer}
        gameId={gameId}
        open={activePlayer != null}
        onOpenChange={(open) => {
          if (!open) setActivePlayerId(null);
        }}
        onGameChange={setGame}
        onError={setError}
      />

      <ScorenadoGameSettingsModal
        game={game}
        gameId={gameId}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        saving={settingsBusy}
        onGameChange={setGame}
        onError={setError}
        onOpenPlayer={(playerId) => {
          setSettingsOpen(false);
          setActivePlayerId(playerId);
        }}
        onSave={async ({ playerCount, roundCount }) => {
          setSettingsBusy(true);
          setError(null);
          try {
            const token = await getApiAccessToken();
            setGame(
              await applyGameSettings(token, gameId, game, playerCount, roundCount),
            );
            setSettingsOpen(false);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Could not update settings.",
            );
          } finally {
            setSettingsBusy(false);
          }
        }}
        canDelete={!readyToFinish}
        onRefresh={refreshGame}
        onDelete={async () => {
          const token = await getApiAccessToken();
          await deleteGame(token, gameId);
          navigate("/scorenado/history");
        }}
      />
    </Stack>
  );
}
