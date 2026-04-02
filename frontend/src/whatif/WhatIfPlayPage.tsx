import { Code, Grid, GridItem, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import PondButton from "../PondButton";
import { fetchWhatIfTvState } from "./api";
import WhatIfShell from "./WhatIfShell";
import type { WhatIfSessionState } from "./types";

const POLL_MS = 2000;

export default function WhatIfPlayPage() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const roomCode = code.toUpperCase();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sinceVersionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const next = await fetchWhatIfTvState(roomCode, sinceVersionRef.current);
        if (!cancelled && next) {
          sinceVersionRef.current = next.state_version;
          setState(next);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load game state");
      }
    }
    sinceVersionRef.current = undefined;
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomCode]);

  const activeId = state?.state?.active_player_id;
  const activePlayer = (state?.players ?? []).find((p) => p.id === activeId);
  const votedPlayerIds = state?.state?.voted_player_ids ?? [];
  const votedPlayers = votedPlayerIds
    .map((id) => (state?.players ?? []).find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p != null);
  const allVotesIn =
    state?.status === "voting" &&
    (state?.players?.length ?? 0) > 0 &&
    votedPlayerIds.length >= (state?.players?.length ?? 0);
  const voteRows = Object.entries(state?.state?.vote_counts ?? {}).sort(
    (a, b) => Number(b[1]) - Number(a[1]) || Number(a[0]) - Number(b[0]),
  );
  const topVoteCount = voteRows.length > 0 ? Number(voteRows[0][1]) : 0;
  const winningOptions =
    topVoteCount > 0
      ? voteRows
          .filter(([, count]) => Number(count) === topVoteCount)
          .map(([option]) => `${option}. ${state?.state?.question?.answers?.[option] ?? ""}`)
      : [];
  const roundScoreRows = Object.entries(state?.state?.round_scores ?? {})
    .filter(([, points]) => Number(points) > 0)
    .map(([id, points]) => {
      const playerId = Number(id);
      const p = (state?.players ?? []).find((row) => row.id === playerId);
      const bonusLabel = playerId === activeId && Number(points) > 1 ? " (active player)" : "";
      return p
        ? `${p.avatar_emoji} ${p.display_name}: +${points}${bonusLabel}`
        : `Player ${id}: +${points}${bonusLabel}`;
    });
  const finalScores = state?.state?.final_scores ?? [];
  const winnerId = state?.state?.winner_player_id;
  const winnerPlayer = winnerId != null ? (state?.players ?? []).find((p) => p.id === winnerId) : undefined;
  const winnerScore =
    winnerPlayer?.score ?? finalScores.find((row) => row.player_id === winnerId)?.score;

  const voterEmojisByOption = useMemo(() => {
    const st = state?.status;
    if (st !== "post_results" && st !== "ended") return {} as Record<number, string[]>;
    const raw = state?.state?.votes ?? {};
    const byOpt: Record<number, string[]> = {};
    const players = state?.players ?? [];
    for (const [pidStr, choice] of Object.entries(raw)) {
      const opt = Number(choice);
      if (!Number.isFinite(opt)) continue;
      const player = players.find((p) => p.id === Number(pidStr));
      if (!player) continue;
      if (!byOpt[opt]) byOpt[opt] = [];
      byOpt[opt].push(player.avatar_emoji);
    }
    for (const opt of Object.keys(byOpt)) {
      byOpt[Number(opt)].sort();
    }
    return byOpt;
  }, [state?.status, state?.state?.votes, state?.players]);

  const scoreboardRows = [...((state?.players ?? []).slice())].sort(
    (a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name),
  );

  return (
    <WhatIfShell maxW="5xl" withPanel={false}>
      <Stack gap="5">
        <Grid
          templateColumns={{ base: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr)" }}
          gap="5"
          w="100%"
          alignItems="start"
        >
          <GridItem minW={0}>
            <Stack gap="5">
              <Stack
                gap="3"
                p="6"
                borderWidth="1px"
                borderColor="border"
                borderRadius="xl"
                bg={state?.status === "ended" ? "orange.100" : "bg"}
              >
                <HStack justify="space-between" align="center" w="100%" flexWrap="wrap" gap="3">
                  <Heading as="h1" size="lg">
                    Whatif TV <Code fontSize="2em">{roomCode}</Code>
                  </Heading>
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    onClick={() => navigate("/whatif?tab=new")}
                  >
                    Return to lobby
                  </PondButton>
                </HStack>
                <Text fontSize="2xl" fontWeight="bold">
                  {state?.status === "ended"
                    ? winnerPlayer && winnerScore != null
                      ? `${winnerPlayer.display_name} wins with ${winnerScore} points!`
                      : "Game over!"
                    : state?.status === "voting"
                      ? allVotesIn
                        ? "All votes are in!"
                        : "Everybody vote!"
                      : state?.status === "post_results"
                        ? roundScoreRows.length === 0
                          ? "No top votes."
                          : winningOptions.length > 1
                            ? `Top votes: ${winningOptions.join("  |  ")}`
                            : winningOptions.length === 1
                              ? `Top vote: ${winningOptions[0]}`
                              : "Votes revealed"
                        : activePlayer
                          ? `${activePlayer.display_name} is choosing this round's subject!`
                          : "Waiting for game start"}
                </Text>
                {state?.status === "post_results" ? (
                  <Stack gap="1">
                    {roundScoreRows.length > 0 ? (
                      roundScoreRows.map((row) => <Text key={row}>{row}</Text>)
                    ) : (
                      <Text>No points awarded this round.</Text>
                    )}
                  </Stack>
                ) : null}
              </Stack>

              {state?.state?.question ? (
                <Stack gap="3" p="4" borderWidth="1px" borderColor="border" borderRadius="xl" bg="bg">
                  <Text fontSize="xl" fontWeight="semibold">
                    {state.state.question.prompt}
                  </Text>
                  <Stack gap="2">
                    {Object.entries(state.state.question.answers).map(([k, answer]) => {
                      const idx = Number(k);
                      const voterEmojis = voterEmojisByOption[idx] ?? [];
                      return (
                        <HStack key={k} align="baseline" gap="2" flexWrap="wrap" justify="flex-start">
                          <Text>
                            {k}. {answer}
                          </Text>
                          {voterEmojis.length > 0 ? (
                            <HStack gap="1" flexShrink={0}>
                              {voterEmojis.map((emoji, i) => (
                                <Text key={`${k}-${i}`} fontSize="2xl" lineHeight="1">
                                  {emoji}
                                </Text>
                              ))}
                            </HStack>
                          ) : null}
                        </HStack>
                      );
                    })}
                  </Stack>
                </Stack>
              ) : null}

              {state?.status === "voting" ? (
                <Stack gap="2" p="4" borderWidth="1px" borderColor="border" borderRadius="xl" bg="bg">
                  <Text fontWeight="medium">Votes cast:</Text>
                  <HStack gap="2" flexWrap="wrap" justify="center">
                    {votedPlayers.map((p) => (
                      <Text key={p.id} fontSize="60px" lineHeight="1">
                        {p.avatar_emoji}
                      </Text>
                    ))}
                    {votedPlayers.length === 0 ? <Text color="gray.700">No votes yet.</Text> : null}
                  </HStack>
                </Stack>
              ) : null}
            </Stack>
          </GridItem>

          <GridItem minW={0} w="100%">
            <Stack gap="2" w="100%">
              {scoreboardRows.length > 0 ? (
                scoreboardRows.map((p) => (
                  <Text
                    key={p.id}
                    borderWidth="1px"
                    borderColor="black"
                    borderRadius="md"
                    px="4"
                    py="4"
                    bg="bg"
                  >
                    {p.avatar_emoji} {p.display_name} - {p.score} pts
                  </Text>
                ))
              ) : (
                <Text
                  borderWidth="1px"
                  borderColor="black"
                  borderRadius="md"
                  px="4"
                  py="4"
                  bg="bg"
                  color="gray.500"
                  fontSize="sm"
                >
                  —
                </Text>
              )}
            </Stack>
          </GridItem>
        </Grid>

        {error ? (
          <Text role="alert" color="red.600">
            {error}
          </Text>
        ) : null}
      </Stack>
    </WhatIfShell>
  );
}

