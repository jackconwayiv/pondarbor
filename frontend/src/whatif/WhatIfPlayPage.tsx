import {
  Avatar,
  Box,
  Code,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fetchWhatIfTvState } from "./api";
import WhatIfShell from "./WhatIfShell";
import type { WhatIfPlayer, WhatIfSessionState } from "./types";
import { WhatIfPlayerFace } from "./whatifPlayerFace";
import { subjectBoardSeatCount, subjectBoardSeatLabel } from "./whatifSubjectBoardUi";

const POLL_MS = 2000;

function WhatIfTvSeatStrip({
  players,
  markerIndex,
  candidateSeatA,
  candidateSeatB,
  activeTurnSubjectPhase,
  activeChallengeRound,
}: {
  players: WhatIfPlayer[];
  markerIndex?: number | null;
  candidateSeatA?: number | null;
  candidateSeatB?: number | null;
  activeTurnSubjectPhase: boolean;
  activeChallengeRound: boolean;
}) {
  const P = players.length;
  if (P < 2) return null;
  const L = subjectBoardSeatCount(P);
  const cand =
    activeTurnSubjectPhase &&
    typeof candidateSeatA === "number" &&
    typeof candidateSeatB === "number"
      ? new Set<number>([candidateSeatA, candidateSeatB])
      : null;
  return (
    <Box w="100%" overflowX="auto" overflowY="visible" pt="1" pb="1">
      <HStack gap="2" minW="min-content" justify="center" flexWrap="wrap">
        {Array.from({ length: L }, (_, i) => i).map((i) => {
          const isMarker = markerIndex != null && Number(markerIndex) === i;
          const isCand = cand?.has(i) ?? false;
          const label = subjectBoardSeatLabel(players, i);
          return (
            <Box
              key={i}
              px="3"
              py="2"
              borderRadius="lg"
              borderWidth="2px"
              borderColor={isCand ? "teal.solid" : "border"}
              bg={isCand ? "teal.50" : "bg.panel"}
              boxShadow={
                isMarker
                  ? `0 0 0 3px var(--chakra-colors-${activeChallengeRound ? "bg-canvas" : "orange-solid"})`
                  : undefined
              }
              minW="5rem"
              textAlign="center"
            >
              <Text color="black" fontSize="clamp(0.85rem, 2vh, 1.1rem)" fontWeight="semibold" lineHeight="1.2">
                {label}
              </Text>
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}

export default function WhatIfPlayPage() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const roomCode = code.toUpperCase();
  const { isAuthenticated, resyncSessionSilently } = useAppSession();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const endedProfileRefreshRef = useRef(false);

  useEffect(() => {
    endedProfileRefreshRef.current = false;
  }, [roomCode]);

  useEffect(() => {
    if (!isAuthenticated || state?.status !== "ended") return;
    if (endedProfileRefreshRef.current) return;
    endedProfileRefreshRef.current = true;
    void resyncSessionSilently();
  }, [isAuthenticated, resyncSessionSilently, state?.status]);

  useEffect(() => {
    if (state?.status !== "voting") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [state?.status]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        // No `since=` — avoids HTTP 304, which Vite's dev proxy often surfaces as 502.
        const next = await fetchWhatIfTvState(roomCode);
        if (!cancelled && next) {
          setState(next);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load game state");
      }
    }
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomCode]);

  /** If TV payload includes `you` (e.g. host mirroring), viewer tiles get profile + Google fallback when URL missing. */
  const viewerPlayerId = state?.state?.you?.id ?? null;

  const activeId = state?.state?.active_player_id;
  const activePlayer = (state?.players ?? []).find((p) => p.id === activeId);
  const duel = state?.state?.duel;
  const challengedId = duel?.challenged_player_id ?? null;
  const duelVoting =
    state?.status === "voting" && duel?.step === "voting" && challengedId != null;
  const challengedPlayer =
    challengedId != null ? (state?.players ?? []).find((p) => p.id === challengedId) : undefined;
  const needPickChallengeTarget =
    state?.status === "turn" && duel?.step === "pick_opponent";
  const needChallengeSubjectPick =
    state?.status === "turn" && duel?.step === "pick_subject" && challengedId != null;
  const duelPostResults =
    state?.status === "post_results" && duel?.step === "voting" && challengedId != null;
  const challengeRevealHeadline = (() => {
    if (!duelPostResults || activeId == null || challengedId == null) return null;
    const raw = state?.state?.votes ?? {};
    const na = Number(raw[String(activeId)]);
    const nb = Number(raw[String(challengedId)]);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) {
      return "Challenge round complete.";
    }
    return na === nb ? "Challenge successful!" : "Challenge failed!";
  })();
  const votedPlayerIds = state?.state?.voted_player_ids ?? [];
  const votedPlayers = votedPlayerIds
    .map((id) => (state?.players ?? []).find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p != null);
  const eligibleVoters = (state?.players ?? []).filter((p) => !p.paused);
  const eligibleVoterIds = new Set(eligibleVoters.map((p) => p.id));
  const allVotesIn =
    state?.status === "voting" &&
    (state?.players?.length ?? 0) > 0 &&
    (eligibleVoterIds.size === 0
      ? true
      : [...eligibleVoterIds].every((id) => votedPlayerIds.includes(id)));
  const voteRows = Object.entries(state?.state?.vote_counts ?? {}).sort(
    (a, b) => Number(b[1]) - Number(a[1]) || Number(a[0]) - Number(b[0]),
  );
  const topVoteCount = voteRows.length > 0 ? Number(voteRows[0][1]) : 0;
  const winningOptions =
    topVoteCount > 0
      ? voteRows
          .filter(([, count]) => Number(count) === topVoteCount)
          .map(([option]) => {
            const label = state?.state?.question?.answers?.[option]?.trim();
            return label && label !== "" ? label : "(unknown)";
          })
      : [];
  const roundScoreEntries = Object.entries(state?.state?.round_scores ?? {})
    .filter(([, points]) => Number(points) !== 0)
    .map(([id, points]) => {
      const playerId = Number(id);
      const p = (state?.players ?? []).find((row) => row.id === playerId);
      const n = Number(points);
      const sign = n > 0 ? "+" : "";
      const bonusLabel = playerId === activeId && n > 1 ? " (active player)" : "";
      return { key: `${id}-${n}`, player: p, playerId, n, sign, bonusLabel };
    });
  const revealFlairsList =
    (state?.status === "post_results" || state?.status === "ended") && !duelPostResults
      ? (state?.state?.reveal_flairs ?? [])
      : [];
  const winnerId = state?.state?.winner_player_id;
  const winnerPlayer = winnerId != null ? (state?.players ?? []).find((p) => p.id === winnerId) : undefined;

  const voterPlayersByOption = useMemo(() => {
    const st = state?.status;
    if (st !== "post_results" && st !== "ended") return {} as Record<number, WhatIfPlayer[]>;
    const raw = state?.state?.votes ?? {};
    const byOpt: Record<number, WhatIfPlayer[]> = {};
    const players = state?.players ?? [];
    for (const [pidStr, choice] of Object.entries(raw)) {
      const opt = Number(choice);
      if (!Number.isFinite(opt)) continue;
      const player = players.find((p) => p.id === Number(pidStr));
      if (!player) continue;
      if (!byOpt[opt]) byOpt[opt] = [];
      byOpt[opt].push(player);
    }
    for (const opt of Object.keys(byOpt)) {
      byOpt[Number(opt)].sort((a, b) => a.display_name.localeCompare(b.display_name));
    }
    return byOpt;
  }, [state?.status, state?.state?.votes, state?.players]);

  const scoreboardRows = [...((state?.players ?? []).slice())].sort(
    (a, b) => b.score - a.score || a.display_name.localeCompare(b.display_name),
  );

  const joinOrderPlayers = useMemo(() => [...(state?.players ?? [])], [state?.players]);
  const showSeatStrip =
    !!state?.challenge_mode &&
    joinOrderPlayers.length >= 2 &&
    state?.status !== "ended" &&
    state?.status !== "pre_lobby" &&
    state?.status !== "open";
  const seatStripSubjectPhase =
    state?.status === "turn" &&
    !state?.state?.challenge_target_player_id &&
    duel?.step !== "pick_opponent" &&
    typeof state?.state?.subject_die_value === "number";
  const activeChallengeRound =
    state?.status !== "ended" &&
    (duel?.step === "pick_opponent" || duel?.step === "pick_subject" || duel?.step === "voting");
  const tvCardBg =
    state?.status === "ended"
      ? "orange.100"
      : activeChallengeRound
        ? "nautical.solid"
        : "bg.panel";
  const tvCardColor = activeChallengeRound ? "white" : undefined;
  const tvMutedColor = activeChallengeRound ? "whiteAlpha.800" : "fg.muted";

  return (
    <WhatIfShell maxW="min(100%, 90rem)" withPanel={false}>
      <Stack gap={{ base: "4", md: "6" }}>
        <Grid
          templateColumns={{ base: "1fr", md: "minmax(0, 2fr) minmax(0, 1fr)" }}
          gap={{ base: "4", md: "6" }}
          w="100%"
          alignItems="start"
        >
          <GridItem minW={0}>
            <Stack gap={{ base: "4", md: "6" }}>
              <Stack
                gap="3"
                p={{ base: "4", md: "8" }}
                borderWidth="1px"
                borderColor="border"
                borderRadius="xl"
                bg={tvCardBg}
                color={tvCardColor}
              >
                <Grid
                  templateColumns="1fr auto 1fr"
                  alignItems="center"
                  columnGap="3"
                  rowGap="3"
                  w="100%"
                  minW={0}
                >
                  <Heading
                    as="h1"
                    fontSize="clamp(1.35rem, 3.5vh, 2.75rem)"
                    lineHeight="1.15"
                    fontWeight="bold"
                    justifySelf="start"
                    minW={0}
                  >
                    Whatif TV
                  </Heading>
                  <Code
                    display="inline-block"
                    fontSize="clamp(1.75rem, 5vh, 3.25rem)"
                    lineHeight="1.1"
                    textAlign="center"
                    justifySelf="center"
                  >
                    {roomCode}
                  </Code>
                  <PondButton
                    type="button"
                    colorPalette="teal"
                    justifySelf="end"
                    onClick={() => navigate("/whatif?tab=new")}
                  >
                    Return to lobby
                  </PondButton>
                </Grid>
                {state?.status === "voting" ? (
                  <Flex
                    flexWrap="wrap"
                    alignItems="center"
                    columnGap="3"
                    rowGap="2"
                    fontSize="clamp(1.2rem, 3vh, 2.25rem)"
                    fontWeight="bold"
                    lineHeight="1.2"
                    w="100%"
                  >
                    <Text as="span">
                      {allVotesIn
                        ? "All votes are in!"
                        : duelVoting && activePlayer && challengedPlayer
                          ? `${activePlayer.display_name} and ${challengedPlayer.display_name} are in a challenge round!`
                          : "Votes cast:"}
                    </Text>
                    {votedPlayers.length > 0 ? (
                      votedPlayers.map((p) => (
                        <Box
                          key={p.id}
                          display="inline-flex"
                          alignItems="center"
                          flexShrink={0}
                          lineHeight="1"
                        >
                          <WhatIfPlayerFace
                            player={p}
                            viewerPlayerId={viewerPlayerId}
                            avatarSize="lg"
                            emojiFontSize="clamp(1.15rem, 3vh, 2.1rem)"
                          />
                        </Box>
                      ))
                    ) : !allVotesIn ? (
                      <Text as="span" color={tvMutedColor} fontWeight="medium">
                        No votes yet.
                      </Text>
                    ) : null}
                  </Flex>
                ) : needChallengeSubjectPick && activePlayer && challengedPlayer ? (
                  <Stack gap="1">
                    <Text fontSize="clamp(1.2rem, 3vh, 2.25rem)" fontWeight="bold" lineHeight="1.2">
                      {activePlayer.display_name} challenged {challengedPlayer.display_name}!
                    </Text>
                    <Text fontSize="clamp(1.2rem, 3vh, 2.25rem)" fontWeight="bold" lineHeight="1.2">
                      {typeof state?.state?.subject_die_value === "number"
                        ? `${activePlayer.display_name} rolled a ${state.state.subject_die_value} and is choosing who this challenge is about!`
                        : `${activePlayer.display_name} is choosing who this challenge is about!`}
                    </Text>
                  </Stack>
                ) : state?.status === "ended" ? (
                  <Stack gap="2">
                    {revealFlairsList.length > 0 ? (
                      <HStack gap="2" flexWrap="wrap" align="center">
                        {revealFlairsList.map((f) => (
                          <Box
                            key={f}
                            px="3"
                            py="1"
                            borderRadius="full"
                            bg="black"
                            color="white"
                            fontSize="clamp(0.95rem, 2.2vh, 1.25rem)"
                            fontWeight="bold"
                            lineHeight="1.2"
                          >
                            {f}
                          </Box>
                        ))}
                      </HStack>
                    ) : null}
                    <Text fontSize="clamp(1.2rem, 3vh, 2.25rem)" fontWeight="bold" lineHeight="1.2">
                      {winnerPlayer
                        ? `Game over! ${winnerPlayer.display_name} wins!`
                        : "Game over!"}
                    </Text>
                  </Stack>
                ) : state?.status === "post_results" ? (
                  <Stack gap="2">
                    {revealFlairsList.length > 0 ? (
                      <HStack gap="2" flexWrap="wrap" align="center">
                        {revealFlairsList.map((f) => (
                          <Box
                            key={f}
                            px="3"
                            py="1"
                            borderRadius="full"
                            bg="black"
                            color="white"
                            fontSize="clamp(0.95rem, 2.2vh, 1.25rem)"
                            fontWeight="bold"
                            lineHeight="1.2"
                          >
                            {f}
                          </Box>
                        ))}
                      </HStack>
                    ) : null}
                    <Text fontSize="clamp(1.2rem, 3vh, 2.25rem)" fontWeight="bold" lineHeight="1.2">
                      {challengeRevealHeadline != null
                        ? challengeRevealHeadline
                        : roundScoreEntries.length === 0
                          ? "No top votes."
                          : winningOptions.length > 1
                            ? `Top votes: ${winningOptions.join(" & ")}`
                            : winningOptions.length === 1
                              ? `Top vote: ${winningOptions[0]}`
                              : "Votes revealed"}
                    </Text>
                  </Stack>
                ) : (
                  <Text fontSize="clamp(1.2rem, 3vh, 2.25rem)" fontWeight="bold" lineHeight="1.2">
                    {activePlayer
                      ? needPickChallengeTarget
                        ? `${activePlayer.display_name} is choosing who to challenge!`
                        : typeof state?.state?.subject_die_value === "number"
                          ? `${activePlayer.display_name} rolled a ${state.state.subject_die_value} and is choosing this round's subject!`
                          : `${activePlayer.display_name} is choosing this round's subject!`
                      : "Waiting for game start"}
                  </Text>
                )}
                {state?.status === "post_results" ? (
                  <Stack gap="1">
                    {roundScoreEntries.length > 0 ? (
                      roundScoreEntries.map(({ key, player, playerId, n, sign, bonusLabel }) => (
                        <HStack key={key} gap="2" align="center" fontSize="clamp(1rem, 2.2vh, 1.35rem)">
                          {player ? (
                            <>
                              <WhatIfPlayerFace
                                player={player}
                                viewerPlayerId={viewerPlayerId}
                                avatarSize="sm"
                                emojiFontSize="clamp(1rem, 2.2vh, 1.35rem)"
                              />
                              <Text>
                                {player.display_name}: {sign}
                                {n}
                                {bonusLabel}
                              </Text>
                            </>
                          ) : (
                            <Text>
                              Player {playerId}: {sign}
                              {n}
                              {bonusLabel}
                            </Text>
                          )}
                        </HStack>
                      ))
                    ) : (
                      <Text fontSize="clamp(1rem, 2.2vh, 1.35rem)">No points awarded this round.</Text>
                    )}
                  </Stack>
                ) : null}
              </Stack>

              {state?.state?.question ? (
                <Stack
                  gap="3"
                  p={{ base: "4", md: "6" }}
                  borderWidth="1px"
                  borderColor="border"
                  borderRadius="xl"
                  bg={tvCardBg}
                  color={tvCardColor}
                >
                  <Text fontSize="clamp(1.1rem, 2.6vh, 1.75rem)" fontWeight="semibold" lineHeight="1.25">
                    {state.state.question.prompt}
                  </Text>
                  {state.state.question.proposed_by?.display_name ? (
                    <HStack gap="2" align="center">
                      {state.state.question.proposed_by.avatar_url ? (
                        <Avatar.Root size="sm">
                          <Avatar.Image src={state.state.question.proposed_by.avatar_url} />
                          <Avatar.Fallback name={state.state.question.proposed_by.display_name} />
                        </Avatar.Root>
                      ) : null}
                      <Text fontSize="sm" color={tvMutedColor}>
                        Question submitted by {state.state.question.proposed_by.display_name}
                      </Text>
                    </HStack>
                  ) : null}
                  <Stack gap="0" w="100%">
                    {Object.entries(state.state.question.answers).map(([k, answer], optIndex) => {
                      const idx = Number(k);
                      const voterPlayers = voterPlayersByOption[idx] ?? [];
                      return (
                        <Box
                          key={k}
                          w="100%"
                          py="3"
                          borderTopWidth={optIndex > 0 ? "1px" : "0"}
                          borderColor="border"
                        >
                          <Flex
                            w="100%"
                            minW={0}
                            flexWrap="wrap"
                            alignItems="center"
                            columnGap="2"
                            rowGap="2"
                          >
                            <Text
                              as="span"
                              fontSize="clamp(1rem, 2.3vh, 1.4rem)"
                              lineHeight="1.5"
                            >
                              {k}. {answer}
                            </Text>
                            {voterPlayers.map((pl) => (
                              <Box
                                key={`${k}-${pl.id}`}
                                display="inline-flex"
                                alignItems="center"
                                flexShrink={0}
                                lineHeight="1"
                              >
                                <WhatIfPlayerFace
                                  player={pl}
                                  viewerPlayerId={viewerPlayerId}
                                  avatarSize="sm"
                                  emojiFontSize="clamp(1.05rem, 2.8vh, 1.35rem)"
                                />
                              </Box>
                            ))}
                          </Flex>
                        </Box>
                      );
                    })}
                  </Stack>
                </Stack>
              ) : null}

              {state?.status === "voting" ? (
                (() => {
                  const paused = !!state.state.voting_paused;
                  const deadlineIso = state.state.voting_deadline_at ?? null;
                  const secsLeft = deadlineIso
                    ? Math.floor((new Date(deadlineIso).getTime() - nowMs) / 1000)
                    : null;

                  let label: string;
                  let tone: "muted" | "active" | "urgent" | "expired" = "muted";

                  if (paused) {
                    label = "Game paused";
                    tone = "muted";
                  } else if (deadlineIso == null) {
                    label = "Voting open";
                    tone = "muted";
                  } else if (secsLeft != null && secsLeft <= 0) {
                    label =
                      allVotesIn && !paused ? "All votes are in!" : "Time's up!";
                    tone = "expired";
                  } else if (secsLeft != null && secsLeft <= 14) {
                    const bucket = Math.max(2, Math.ceil(secsLeft / 2) * 2);
                    label = `${bucket}s`;
                    tone = bucket <= 4 ? "urgent" : "active";
                  } else {
                    label = "Voting open";
                    tone = "muted";
                  }

                  const color = activeChallengeRound
                    ? tone === "muted"
                      ? "whiteAlpha.800"
                      : "white"
                    : tone === "expired" || tone === "urgent"
                      ? "orange.solid"
                      : tone === "active"
                        ? "fg"
                        : "fg.muted";
                  const fontSize =
                    tone === "muted"
                      ? "clamp(1rem, 2.2vh, 1.4rem)"
                      : "clamp(2rem, 6vh, 4rem)";
                  const fontWeight = tone === "muted" ? "medium" : "bold";

                  return (
                    <Stack
                      gap="0"
                      p={{ base: "3", md: "4" }}
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="xl"
                      bg={tvCardBg}
                      color={tvCardColor}
                      align="center"
                      w="100%"
                    >
                      <Text
                        fontSize={fontSize}
                        fontWeight={fontWeight}
                        color={color}
                        lineHeight="1"
                      >
                        {label}
                      </Text>
                    </Stack>
                  );
                })()
              ) : null}
            </Stack>
          </GridItem>

          <GridItem minW={0} w="100%">
            <Stack
              gap="3"
              p={{ base: "4", md: "6" }}
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              bg={tvCardBg}
              color={tvCardColor}
              w="100%"
            >
              <Stack gap="2" w="100%">
                {showSeatStrip ? (
                  <WhatIfTvSeatStrip
                    players={joinOrderPlayers}
                    markerIndex={state?.state?.marker_index}
                    candidateSeatA={state?.state?.subject_candidate_seat_a}
                    candidateSeatB={state?.state?.subject_candidate_seat_b}
                    activeTurnSubjectPhase={seatStripSubjectPhase}
                    activeChallengeRound={activeChallengeRound}
                  />
                ) : null}
                <Text
                  fontSize="clamp(1.25rem, 3.2vh, 2rem)"
                  fontWeight="bold"
                  letterSpacing="0.2em"
                  textAlign="center"
                  color={activeChallengeRound ? "white" : "fg"}
                  lineHeight="1.1"
                >
                  SCOREBOARD
                </Text>
                <Text textAlign="center" color={tvMutedColor} fontSize="clamp(0.9rem, 2vh, 1.1rem)">
                  The first player to {state?.win_score ?? 25} points wins!
                </Text>
              </Stack>
              {scoreboardRows.length > 0 ? (
                <Stack gap="2" w="100%" pt="1">
                  {scoreboardRows.map((p) => {
                    const seatNo =
                      joinOrderPlayers.findIndex((pl) => pl.id === p.id) + 1;
                    const isActiveTurn = activeId != null && p.id === activeId;
                    return (
                      <Box key={p.id} position="relative" w="100%" minW={0}>
                        <Text
                          position="absolute"
                          top="0"
                          left="0"
                          fontSize="clamp(0.65rem, 1.5vh, 0.85rem)"
                          fontWeight="bold"
                          lineHeight="1"
                          color={tvMutedColor}
                        >
                          {seatNo}
                        </Text>
                        {isActiveTurn ? (
                          <Text
                            position="absolute"
                            top="0"
                            right="0"
                            fontSize="clamp(0.85rem, 2vh, 1.1rem)"
                            lineHeight="1"
                            color={activeChallengeRound ? "white" : "orange.solid"}
                            aria-label="Active player's turn"
                          >
                            ★
                          </Text>
                        ) : null}
                        <HStack align="center" gap="3" w="100%" minW={0} pl="5" pr={isActiveTurn ? "7" : "0"}>
                          <HStack flex="1" minW={0} gap="2" align="center">
                            <WhatIfPlayerFace
                              player={p}
                              viewerPlayerId={viewerPlayerId}
                              avatarSize="lg"
                              emojiFontSize="clamp(1.35rem, 3.5vh, 2rem)"
                            />
                            <Text
                              fontSize="clamp(1.35rem, 3.5vh, 2rem)"
                              fontWeight="semibold"
                              lineHeight="1.25"
                            >
                              {p.display_name} · {p.score} pts
                            </Text>
                            {p.paused ? (
                              <Text
                                color={tvMutedColor}
                                fontSize="clamp(0.95rem, 2.2vh, 1.15rem)"
                                fontWeight="medium"
                              >
                                (paused)
                              </Text>
                            ) : null}
                          </HStack>
                        </HStack>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Text color={tvMutedColor} fontSize="clamp(1rem, 2.2vh, 1.2rem)" textAlign="center" py="2">
                  —
                </Text>
              )}
            </Stack>
          </GridItem>
        </Grid>

        {error ? (
          <Text role="alert" color="nautical.solid">
            {error}
          </Text>
        ) : null}
      </Stack>
    </WhatIfShell>
  );
}

