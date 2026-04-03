import { Avatar, Code, Grid, GridItem, Heading, HStack, IconButton, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { fetchWhatIfTvState, loadHostToken, postWhatIfAction } from "./api";
import WhatIfShell from "./WhatIfShell";
import type { WhatIfPlayer, WhatIfSessionState } from "./types";

const POLL_MS = 2000;

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1.35em" height="1.35em" fill="currentColor" aria-hidden>
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1.35em" height="1.35em" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

export default function WhatIfPlayPage() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const roomCode = code.toUpperCase();
  const { isAuthenticated, refreshSession } = useAppSession();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hostBusy, setHostBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hostToken = useMemo(() => loadHostToken(roomCode), [roomCode]);
  const endedProfileRefreshRef = useRef(false);

  useEffect(() => {
    endedProfileRefreshRef.current = false;
  }, [roomCode]);

  useEffect(() => {
    if (!isAuthenticated || state?.status !== "ended") return;
    if (endedProfileRefreshRef.current) return;
    endedProfileRefreshRef.current = true;
    void refreshSession();
  }, [isAuthenticated, refreshSession, state?.status]);

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
  const roundScoreRows = Object.entries(state?.state?.round_scores ?? {})
    .filter(([, points]) => Number(points) !== 0)
    .map(([id, points]) => {
      const playerId = Number(id);
      const p = (state?.players ?? []).find((row) => row.id === playerId);
      const n = Number(points);
      const sign = n > 0 ? "+" : "";
      const bonusLabel = playerId === activeId && n > 1 ? " (active player)" : "";
      return p
        ? `${p.avatar_emoji} ${p.display_name}: ${sign}${n}${bonusLabel}`
        : `Player ${id}: ${sign}${n}${bonusLabel}`;
    });
  const flairPrefix =
    state?.status === "post_results" || state?.status === "ended"
      ? (state?.state?.reveal_flairs ?? []).join(" ")
      : "";
  const winnerId = state?.state?.winner_player_id;
  const winnerPlayer = winnerId != null ? (state?.players ?? []).find((p) => p.id === winnerId) : undefined;

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

  const canHostManagePause =
    !!hostToken &&
    state != null &&
    (state.status === "turn" || state.status === "voting" || state.status === "post_results");

  function hostCannotPausePlayer(p: WhatIfPlayer): boolean {
    if (p.paused) return false;
    const ap = state?.state?.active_player_id;
    const duel = state?.state?.duel;
    const st = state?.status;
    const ch = duel?.challenged_player_id;
    if (ch != null && (duel?.step === "voting" || duel?.step === "pick_subject")) {
      if (p.id === ap || p.id === ch) {
        return st === "turn" || st === "voting" || st === "post_results";
      }
    }
    if (ch != null && duel?.step === "voting" && st === "post_results") {
      if (p.id === ap || p.id === ch) return true;
    }
    if (p.id !== ap) return false;
    return st === "turn" || st === "voting" || st === "post_results";
  }

  async function handleSetPlayerPaused(p: WhatIfPlayer, paused: boolean) {
    if (!hostToken) return;
    setHostBusy(true);
    setError(null);
    try {
      const next = await postWhatIfAction(
        roomCode,
        { type: "set_player_paused", target_player_id: p.id, paused },
        { hostToken },
      );
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Host action failed");
    } finally {
      setHostBusy(false);
    }
  }

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
                bg={state?.status === "ended" ? "orange.100" : "bg"}
              >
                <HStack justify="space-between" align="center" w="100%" flexWrap="wrap" gap="3">
                  <Heading
                    as="h1"
                    fontSize="clamp(1.35rem, 3.5vh, 2.75rem)"
                    lineHeight="1.15"
                    fontWeight="bold"
                  >
                    Whatif TV{" "}
                    <Code fontSize="clamp(1.75rem, 5vh, 3.25rem)" verticalAlign="middle">
                      {roomCode}
                    </Code>
                  </Heading>
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
                    onClick={() => navigate("/whatif?tab=new")}
                  >
                    Return to lobby
                  </PondButton>
                </HStack>
                <Text fontSize="clamp(1.2rem, 3vh, 2.25rem)" fontWeight="bold" lineHeight="1.2">
                  {state?.status === "ended"
                    ? winnerPlayer
                      ? `${flairPrefix ? `${flairPrefix} ` : ""}Game over! ${winnerPlayer.display_name} wins!`
                      : "Game over!"
                    : state?.status === "voting"
                      ? allVotesIn
                        ? "All votes are in!"
                        : duelVoting && activePlayer && challengedPlayer
                          ? `${activePlayer.display_name} and ${challengedPlayer.display_name} are in a challenge round!`
                          : "Everybody vote!"
                      : state?.status === "post_results"
                        ? `${flairPrefix ? `${flairPrefix} ` : ""}${
                            challengeRevealHeadline != null
                              ? challengeRevealHeadline
                              : roundScoreRows.length === 0
                                ? "No top votes."
                                : winningOptions.length > 1
                                  ? `Top votes: ${winningOptions.join(" & ")}`
                                  : winningOptions.length === 1
                                    ? `Top vote: ${winningOptions[0]}`
                                    : "Votes revealed"
                          }`
                        : activePlayer
                          ? needPickChallengeTarget
                            ? `${activePlayer.display_name} is choosing who to challenge!`
                            : needChallengeSubjectPick
                              ? `${activePlayer.display_name} is choosing who this challenge is about!`
                              : `${activePlayer.display_name} is choosing this round's subject!`
                          : "Waiting for game start"}
                </Text>
                {state?.status === "post_results" ? (
                  <Stack gap="1">
                    {roundScoreRows.length > 0 ? (
                      roundScoreRows.map((row) => (
                        <Text key={row} fontSize="clamp(1rem, 2.2vh, 1.35rem)">
                          {row}
                        </Text>
                      ))
                    ) : (
                      <Text fontSize="clamp(1rem, 2.2vh, 1.35rem)">No points awarded this round.</Text>
                    )}
                  </Stack>
                ) : null}
              </Stack>

              {state?.state?.question ? (
                <Stack gap="3" p={{ base: "4", md: "6" }} borderWidth="1px" borderColor="border" borderRadius="xl" bg="bg">
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
                      <Text fontSize="sm" color="gray.700">
                        Question submitted by {state.state.question.proposed_by.display_name}
                      </Text>
                    </HStack>
                  ) : null}
                  <Stack gap="2">
                    {Object.entries(state.state.question.answers).map(([k, answer]) => {
                      const idx = Number(k);
                      const voterEmojis = voterEmojisByOption[idx] ?? [];
                      return (
                        <HStack key={k} align="baseline" gap="2" flexWrap="wrap" justify="flex-start">
                          <Text fontSize="clamp(1rem, 2.3vh, 1.4rem)" lineHeight="1.3">
                            {k}. {answer}
                          </Text>
                          {voterEmojis.length > 0 ? (
                            <HStack gap="1" flexShrink={0}>
                              {voterEmojis.map((emoji, i) => (
                                <Text
                                  key={`${k}-${i}`}
                                  fontSize="clamp(1.35rem, 4vh, 2.5rem)"
                                  lineHeight="1"
                                >
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

              {state?.status === "voting" && state.state.voting_deadline_at ? (
                <Text fontSize="clamp(0.9rem, 1.8vh, 1.1rem)" color="gray.700">
                  {(() => {
                    const left = Math.max(
                      0,
                      Math.floor(
                        (new Date(state.state.voting_deadline_at!).getTime() - nowMs) / 1000,
                      ),
                    );
                    return left <= 10 && left > 0
                      ? `Auto-reveal in ~${Math.min(10, Math.ceil(left / 2) * 2)}s`
                      : null;
                  })()}
                </Text>
              ) : null}
              {state?.status === "voting" ? (
                <Stack gap="2" p={{ base: "4", md: "6" }} borderWidth="1px" borderColor="border" borderRadius="xl" bg="bg">
                  <Text fontWeight="medium" fontSize="clamp(1rem, 2vh, 1.25rem)">
                    Votes cast:
                  </Text>
                  <HStack gap="2" flexWrap="wrap" justify="center">
                    {votedPlayers.map((p) => (
                      <Text
                        key={p.id}
                        fontSize="clamp(2.25rem, 9vh, 4.5rem)"
                        lineHeight="1"
                      >
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
              <Stack
                gap="2"
                p={{ base: "4", md: "6" }}
                borderWidth="1px"
                borderColor="border"
                borderRadius="xl"
                bg="bg"
                w="100%"
              >
                <Text
                  fontSize="clamp(1.25rem, 3.2vh, 2rem)"
                  fontWeight="bold"
                  letterSpacing="0.2em"
                  textAlign="center"
                  color="fg"
                  lineHeight="1.1"
                >
                  SCOREBOARD
                </Text>
                <Text textAlign="center" color="gray.700" fontSize="clamp(0.9rem, 2vh, 1.1rem)">
                  The first player to {state?.win_score ?? 25} points wins!
                </Text>
              </Stack>
              {scoreboardRows.length > 0 ? (
                scoreboardRows.map((p) => (
                  <HStack
                    key={p.id}
                    borderWidth="1px"
                    borderColor="black"
                    borderRadius="md"
                    px={{ base: "3", md: "5" }}
                    py={{ base: "3", md: "5" }}
                    bg="bg"
                    justify="space-between"
                    align="center"
                    gap="3"
                    w="100%"
                  >
                    <HStack flex="1" minW={0} gap="2" align="baseline">
                      <Text fontSize="clamp(1rem, 2.4vh, 1.35rem)" lineHeight="1.25">
                        {p.avatar_emoji} {p.display_name} - {p.score} pts
                      </Text>
                      {p.paused ? (
                        <Text color="gray.600" fontSize="sm" fontWeight="medium">
                          (paused)
                        </Text>
                      ) : null}
                    </HStack>
                    {canHostManagePause ? (
                      <IconButton
                        type="button"
                        aria-label={p.paused ? `Resume ${p.display_name}` : `Pause ${p.display_name}`}
                        title={
                          p.paused
                            ? "Resume — they can vote and take other actions in this round if the game has not moved on yet."
                            : hostCannotPausePlayer(p)
                              ? "Cannot pause the active player during their turn, voting reveal, or score transition."
                              : `Pause ${p.display_name} (their vote is not required until you resume them)`
                        }
                        size="md"
                        variant="outline"
                        colorPalette={p.paused ? "lilypad" : "orange"}
                        flexShrink={0}
                        minW="12"
                        minH="12"
                        loading={hostBusy}
                        disabled={hostBusy || (!p.paused && hostCannotPausePlayer(p))}
                        onClick={() => void handleSetPlayerPaused(p, !p.paused)}
                      >
                        {p.paused ? <PlayIcon /> : <PauseIcon />}
                      </IconButton>
                    ) : null}
                  </HStack>
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

