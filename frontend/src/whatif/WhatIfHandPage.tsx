import { useAuth0 } from "@auth0/auth0-react";
import {
  Avatar,
  Box,
  Code,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import { validateWhatIfDisplayName } from "../forms/validation";
import PondButton from "../PondButton";
import {
  auth0LoginAuthorizationParams,
  auth0LoginWithReturnTo,
} from "../auth/auth0LoginParams";
import { useAppSession } from "../auth/AppSessionContext";
import {
  fetchWhatIfHandState,
  fetchWhatIfTvState,
  joinWhatIfSession,
  loadPlayerToken,
  postWhatIfAction,
  savePlayerToken,
} from "./api";
import WhatIfShell from "./WhatIfShell";
import { whatifInputProps } from "./whatifFieldProps";
import type { WhatIfPlayer, WhatIfSessionState } from "./types";
import { WhatIfPlayerFace } from "./whatifPlayerFace";

const POLL_MS = 2000;
const DISPLAY_NAME_RE = /^[A-Za-z0-9 ]*$/;

function sanitizeDisplayNameInput(raw: string): string {
  return raw.split("").filter((ch) => DISPLAY_NAME_RE.test(ch)).join("").slice(0, 12);
}

function normalizeWhatIfDisplayNameForCompare(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Header total score: "0 Points", "1 Point", "2 Points", … */
function formatHandTotalScoreLabel(score: number): string {
  if (score === 1) return "1 Point";
  return `${score} Points`;
}

export default function WhatIfHandPage() {
  const { code = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const { loginWithRedirect } = useAuth0();
  const { sessionUser, isAuthenticated, getApiAccessToken, resyncSessionSilently } =
    useAppSession();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [enrolledPlayerNames, setEnrolledPlayerNames] = useState<string[]>([]);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const confirmSkipRef = useRef<HTMLButtonElement | null>(null);
  const playerToken = useMemo(() => loadPlayerToken(roomCode), [roomCode]);
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
    if (!isAuthenticated) {
      setName("");
      return;
    }
    const raw = sessionUser?.profile?.display_name ?? "";
    if (raw) setName(sanitizeDisplayNameInput(raw));
    else setName("");
  }, [isAuthenticated, sessionUser?.profile?.display_name]);

  useEffect(() => {
    if (playerToken || roomCode.length !== 4) {
      setEnrolledPlayerNames([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const sess = await fetchWhatIfTvState(roomCode);
          if (cancelled || !sess) return;
          setEnrolledPlayerNames((sess.players ?? []).map((p) => p.display_name));
        } catch {
          if (!cancelled) setEnrolledPlayerNames([]);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [roomCode, playerToken]);

  useEffect(() => {
    if (!playerToken) return;
    const token = playerToken;
    let cancelled = false;
    async function poll() {
      try {
        const next = await fetchWhatIfHandState(roomCode, token);
        if (!cancelled && next) {
          setState(next);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load hand");
      }
    }
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomCode, playerToken]);

  useEffect(() => {
    if (state?.status !== "post_results") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state?.status]);

  useEffect(() => {
    if (!confirmSkip) return;
    function onPointerDown(ev: PointerEvent) {
      if (confirmSkipRef.current?.contains(ev.target as Node)) return;
      setConfirmSkip(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setConfirmSkip(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [confirmSkip]);

  const nameTakenInRoom = useMemo(() => {
    if (playerToken) return false;
    const candidate = sanitizeDisplayNameInput(name.trim());
    if (!candidate) return false;
    const c = normalizeWhatIfDisplayNameForCompare(candidate);
    return enrolledPlayerNames.some((n) => normalizeWhatIfDisplayNameForCompare(n) === c);
  }, [name, enrolledPlayerNames, playerToken]);

  const joinHandDisabled =
    busy || !sanitizeDisplayNameInput(name.trim()) || nameTakenInRoom;

  const joinNamePlaceholder = isAuthenticated
    ? "Letters, numbers, spaces (max 12)"
    : "Enter a player name";

  async function handleJoin() {
    const displayName = sanitizeDisplayNameInput(name.trim());
    const nameErr = validateWhatIfDisplayName(displayName);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    if (nameTakenInRoom) {
      setError("That name is already taken in this room.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = isAuthenticated ? await getApiAccessToken() : null;
      const joined = await joinWhatIfSession(roomCode, displayName, token);
      savePlayerToken(roomCode, joined.player_secret);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to join");
    } finally {
      setBusy(false);
    }
  }

  async function action(payload: Parameters<typeof postWhatIfAction>[1]) {
    if (!playerToken) return;
    setBusy(true);
    setError(null);
    try {
      const next = await postWhatIfAction(roomCode, payload, { playerToken });
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (!playerToken) {
    return (
      <WhatIfShell withPanel>
        <Stack gap="5">
          <Heading as="h1" size="lg">
            Join Whatif
          </Heading>
          <Stack gap="1">
            <Text fontSize="sm" fontWeight="medium" color="gray.700">
              Room Code:
            </Text>
            <Code fontSize="2em" w="fit-content">
              {roomCode}
            </Code>
          </Stack>
          <Text color="gray.700">
            Enter the name others will see on this phone. The TV shows the main board; this screen is your private
            hand.
          </Text>

          {!isAuthenticated ? (
            <HStack gap="3" flexWrap="wrap" align="center">
              <Text fontSize="sm" color="gray.600">
                Playing as guest.
              </Text>
              <PondButton
                type="button"
                size="sm"
                variant="outline"
                colorPalette="lilypad"
                onClick={() =>
                  void loginWithRedirect(
                    auth0LoginWithReturnTo(`${location.pathname}${location.search}`, {
                      authorizationParams: auth0LoginAuthorizationParams(),
                    }),
                  )
                }
              >
                Log in
              </PondButton>
            </HStack>
          ) : null}

          <Stack gap="1" w="100%">
            <Text fontSize="sm" fontWeight="medium" color="gray.700">
              Player Name:
            </Text>
            <HStack align="center" gap="3" w="100%">
              <Avatar.Root size="md" flexShrink={0}>
                {isAuthenticated && sessionUser?.profile?.avatar_url ? (
                  <Avatar.Image src={sessionUser.profile.avatar_url} />
                ) : null}
                <Avatar.Fallback
                  name={
                    isAuthenticated
                      ? sessionUser?.profile?.display_name || sessionUser?.user?.email || "User"
                      : "Guest"
                  }
                  bg={!isAuthenticated ? "gray.200" : undefined}
                  color={!isAuthenticated ? "gray.600" : undefined}
                />
              </Avatar.Root>
              <Input
                flex="1"
                minW={0}
                value={name}
                onChange={(e) => setName(sanitizeDisplayNameInput(e.target.value))}
                placeholder={joinNamePlaceholder}
                maxLength={12}
                {...whatifInputProps}
              />
            </HStack>
          </Stack>
          {nameTakenInRoom ? (
            <Text fontSize="sm" color="orange.solid">
              That name is already taken in this room.
            </Text>
          ) : null}
          <Text fontSize="xs" color="gray.600">
            Letters, numbers, and spaces only (max 12 characters).
          </Text>

          <PondButton
            type="button"
            colorPalette="teal"
            size="md"
            alignSelf="flex-start"
            onClick={() => void handleJoin()}
            loading={busy}
            disabled={joinHandDisabled}
          >
            Join this phone
          </PondButton>

          {error ? (
            <Text role="alert" color="nautical.solid">
              {error}
            </Text>
          ) : null}
        </Stack>
      </WhatIfShell>
    );
  }

  const me = state?.state?.you;
  const playerList = state?.players ?? [];
  const isActive = !!me && me.id === state?.state?.active_player_id;
  const duel = state?.state?.duel;
  const subjectCandidateIds = state?.state?.subject_candidate_ids ?? [];
  const subjectOptions = state?.state?.subject_options ?? [];
  const subjectCandidates = subjectCandidateIds
    .map((id) => playerList.find((p) => p.id === id))
    .filter((p): p is WhatIfPlayer => p != null);

  const needPickOpponent = state?.status === "turn" && duel?.step === "pick_opponent";
  const needDuelSubjectPick = state?.status === "turn" && duel?.step === "pick_subject";
  const needNormalSubjectPick =
    state?.status === "turn" &&
    !duel?.step &&
    !state?.state?.challenge_target_player_id &&
    subjectCandidates.length > 0;
  const needSubjectTiles =
    state?.status === "turn" &&
    !state?.state?.challenge_target_player_id &&
    !needPickOpponent &&
    !needDuelSubjectPick &&
    (subjectOptions.length > 0 || needNormalSubjectPick);

  const activeId = state?.state?.active_player_id;
  const activeName = playerList.find((p) => p.id === activeId)?.display_name ?? "Active player";
  const answers = state?.state?.question?.answers ?? {};
  const votedIds = state?.state?.voted_player_ids ?? [];
  const eligibleVoterIds = new Set(playerList.filter((p) => !p.paused).map((p) => p.id));

  const duelVoting = duel?.step === "voting" && duel.challenged_player_id != null;
  const allPlayersVoted = (() => {
    if (playerList.length === 0) return false;
    if (duelVoting && activeId != null) {
      const ch = duel!.challenged_player_id!;
      for (const pid of [activeId, ch]) {
        const pl = playerList.find((p) => p.id === pid);
        if (pl && !pl.paused && !votedIds.includes(pid)) return false;
      }
      return true;
    }
    if (eligibleVoterIds.size === 0) return true;
    return [...eligibleVoterIds].every((id) => votedIds.includes(id));
  })();

  const votingPaused = !!state?.state?.voting_paused;

  const canReveal = state?.status === "voting" && isActive && allPlayersVoted;

  const imPaused = !!me?.paused;
  const myVote = state?.state?.your_vote ?? null;
  const waitUntil = state?.state?.next_turn_not_before ? new Date(state.state.next_turn_not_before).getTime() : 0;
  const canAdvance = nowMs >= waitUntil;
  const finalScores = state?.state?.final_scores ?? [];
  const myPlacement = me ? finalScores.find((row) => row.player_id === me.id) : undefined;
  const didWin = !!me && state?.state?.winner_player_id === me.id;
  const nextPlayerName = (() => {
    if (playerList.length === 0) return "Next player";
    const idx = playerList.findIndex((p) => p.id === activeId);
    const nextIdx = idx >= 0 ? (idx + 1) % playerList.length : 0;
    return playerList[nextIdx]?.display_name ?? "Next player";
  })();
  const myRoundPoints =
    me != null ? Number(state?.state?.round_scores?.[String(me.id)] ?? 0) : 0;
  const myRoundPointsDisplay = (() => {
    if (myRoundPoints > 0) {
      return myRoundPoints === 1 ? "+1 point" : `+${myRoundPoints} points`;
    }
    if (myRoundPoints < 0) {
      return myRoundPoints === -1 ? "-1 point" : `${myRoundPoints} points`;
    }
    return "0 points";
  })();
  const showVotedForHint =
    !!myVote && state?.status === "voting" && !allPlayersVoted;

  const qid = state?.state?.question_id ?? null;
  const skipSuppressed = state?.state?.skip_ui_suppressed_for_question_id === qid;
  const pendingSkipId = state?.state?.pending_question_skip_by_player_id ?? null;
  const showSkipButton =
    state?.status === "voting" &&
    !duelVoting &&
    !imPaused &&
    me &&
    !skipSuppressed &&
    !pendingSkipId;

  const challengedPlayerId = duel?.challenged_player_id ?? null;
  const challengerName = playerList.find((p) => p.id === challengedPlayerId)?.display_name ?? "Player";
  const isChallengedPlayerWaitingOnSubject =
    needDuelSubjectPick && !isActive && me != null && challengedPlayerId != null && me.id === challengedPlayerId;
  const isDuelist =
    duelVoting && me && activeId != null && (me.id === activeId || me.id === duel?.challenged_player_id);

  const showVoteGrid =
    state?.status === "voting" && (!duelVoting || isDuelist) && Object.keys(answers).length > 0;

  return (
    <WhatIfShell withPanel={false}>
      <Stack
        gap="5"
        w="100%"
        align="stretch"
        pb={showVoteGrid ? "max(0.75rem, env(safe-area-inset-bottom, 0px))" : undefined}
      >
        {pendingSkipId && isActive && me && pendingSkipId !== me.id ? (
          <Box
            role="dialog"
            aria-modal="true"
            p="4"
            borderRadius="xl"
            borderWidth="2px"
            borderColor="orange.solid"
            bg="orange.50"
          >
            <Stack gap="3">
              <Text fontWeight="bold">
                {playerList.find((p) => p.id === pendingSkipId)?.display_name ?? "A player"} wants to spend their Veto
                on this question. Do you agree?
              </Text>
              <HStack gap="3" flexWrap="wrap">
                <PondButton
                  type="button"
                  colorPalette="teal"
                  size="sm"
                  loading={busy}
                  onClick={() => void action({ type: "resolve_question_skip", approve: false })}
                >
                  Keep Question
                </PondButton>
                <PondButton
                  type="button"
                  colorPalette="orange"
                  size="sm"
                  loading={busy}
                  onClick={() => void action({ type: "resolve_question_skip", approve: true })}
                >
                  Confirm Veto
                </PondButton>
              </HStack>
            </Stack>
          </Box>
        ) : null}

        <Stack
          gap="3"
          p="4"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          bg="white"
          flexShrink={0}
        >
          <HStack justify="space-between" align="center" w="100%" gap="3" flexWrap="wrap">
            <Stack gap="0" flex="1" minW="0">
              <Heading as="h1" size="xl">
                Your Hand
              </Heading>
            </Stack>
            {showSkipButton ? (
              <PondButton
                ref={confirmSkip ? confirmSkipRef : undefined}
                type="button"
                colorPalette="orange"
                flexShrink={0}
                disabled={busy || imPaused}
                onClick={() => {
                  if (!confirmSkip) {
                    setConfirmSkip(true);
                    return;
                  }
                  void action({ type: "request_question_skip" });
                  setConfirmSkip(false);
                }}
              >
                {confirmSkip ? "Confirm Veto" : "Veto Question"}
              </PondButton>
            ) : me && !(state?.status === "voting" && showSkipButton) ? (
              <Text flexShrink={0} fontSize="1.65em" fontWeight="semibold" lineHeight="1">
                {formatHandTotalScoreLabel(me.score)}
              </Text>
            ) : null}
          </HStack>
          {imPaused ? (
            <Text p="3" borderRadius="md" bg="orange.100" color="gray.800" fontWeight="medium">
              You&apos;re paused by the host. Your vote isn&apos;t needed this round; ask them to tap Resume on the TV
              when you&apos;re back.
            </Text>
          ) : null}
          {state?.state?.question ? <Text fontWeight="bold">{state.state.question.prompt}</Text> : null}
          {needPickOpponent && !isActive ? (
            <Text color="gray.700">Waiting for {activeName} to challenge someone…</Text>
          ) : null}
          {isChallengedPlayerWaitingOnSubject ? (
            <Text color="gray.700">
              {activeName} has challenged YOU! Waiting for {activeName} to choose the challenge subject.
            </Text>
          ) : needDuelSubjectPick && !isActive ? (
            <Text color="gray.700">Waiting for {activeName} to choose the challenge subject…</Text>
          ) : null}
          {duelVoting && !isDuelist ? (
            <Text color="gray.700">
              {activeName} and {challengerName} are in a challenge round!
            </Text>
          ) : null}
          {needSubjectTiles && !needPickOpponent && !needDuelSubjectPick && !isActive ? (
            <Text color="gray.700">Waiting for {activeName} to choose who this round is about…</Text>
          ) : null}
          {needSubjectTiles && isActive && !needPickOpponent && !needDuelSubjectPick ? (
            <Text fontWeight="medium">Pick who this round is about:</Text>
          ) : null}
          {needPickOpponent && isActive ? <Text fontWeight="medium">Who do you challenge?</Text> : null}
          {needDuelSubjectPick && isActive ? <Text fontWeight="medium">Pick the subject for this challenge:</Text> : null}
          {showVotedForHint ? (
            <Text color="gray.700">
              You voted for {answers[String(myVote)] ?? String(myVote)}. Tap your card again to un-vote.
            </Text>
          ) : null}
          {state?.status === "voting" && votingPaused ? (
            <Text
              p="3"
              borderRadius="md"
              bg="orange.100"
              color="gray.800"
              fontWeight="medium"
            >
              {isActive
                ? "Game paused. Voting is locked until you resume."
                : `Game paused by ${activeName}. Voting is locked until they resume.`}
            </Text>
          ) : null}
          {state?.status === "voting" && isActive && !imPaused ? (
            <HStack gap="3" flexWrap="wrap">
              {!canReveal || votingPaused ? (
                <PondButton
                  type="button"
                  colorPalette={votingPaused ? "lilypad" : "orange"}
                  variant={votingPaused ? "solid" : "outline"}
                  onClick={() => void action({ type: "toggle_voting_pause" })}
                  loading={busy}
                  disabled={busy}
                >
                  {votingPaused ? "Resume game" : "Pause game"}
                </PondButton>
              ) : null}
              {canReveal ? (
                <PondButton
                  type="button"
                  colorPalette="teal"
                  onClick={() => void action({ type: "reveal" })}
                  loading={busy}
                  disabled={busy || votingPaused}
                >
                  Reveal votes
                </PondButton>
              ) : null}
            </HStack>
          ) : null}
          {state?.status === "post_results" ? (
            <Stack gap="2">
              <Text
                fontSize="32px"
                lineHeight={1.05}
                fontWeight="semibold"
                textAlign="center"
                w="100%"
                my={3}
              >
                {myRoundPointsDisplay}
              </Text>
              {isActive ? (
                canAdvance ? (
                  <PondButton
                    type="button"
                    colorPalette="teal"
                    alignSelf="flex-start"
                    onClick={() => void action({ type: "next_turn" })}
                    loading={busy}
                    disabled={busy || imPaused}
                  >
                    {nextPlayerName}&apos;s turn
                  </PondButton>
                ) : (
                  <Text fontSize="sm" color="gray.600">
                    Waiting for score reveal timer…
                  </Text>
                )
              ) : (
                <Text fontSize="sm" color="gray.600">
                  Waiting for {activeName} to start {nextPlayerName}&apos;s turn…
                </Text>
              )}
            </Stack>
          ) : null}
        </Stack>

        {needPickOpponent && isActive ? (
          <Stack gap="3" w="100%">
            <SimpleGrid columns={2} gap="3" w="100%">
              {playerList
                .filter((p) => p.id !== activeId)
                .map((p) => (
                  <PondButton
                    key={p.id}
                    type="button"
                    bg="white"
                    color="black"
                    borderWidth="16px"
                    borderColor="transparent"
                    borderRadius="xl"
                    minH="160px"
                    w="100%"
                    whiteSpace="normal"
                    textAlign="center"
                    disabled={busy || imPaused}
                    _hover={{
                      bg: "white",
                      color: "black",
                      borderColor: "teal.solid",
                      borderWidth: "16px",
                    }}
                    onClick={() => void action({ type: "pick_duel_opponent", target_player_id: p.id })}
                  >
                    <Stack gap="2" align="center" justify="center">
                      <WhatIfPlayerFace player={p} avatarSize="2xl" emojiFontSize="4xl" />
                      <Text fontSize="xl" fontWeight="semibold">
                        {p.display_name}
                      </Text>
                    </Stack>
                  </PondButton>
                ))}
            </SimpleGrid>
          </Stack>
        ) : null}

        {(needDuelSubjectPick || needNormalSubjectPick) && isActive ? (
          <Stack gap="3" w="100%">
            <SimpleGrid columns={2} gap="3" w="100%">
              {subjectOptions.length > 0
                ? subjectOptions.map((opt, i) =>
                    opt.kind === "challenge" ? (
                      <PondButton
                        key={`ch-${i}`}
                        type="button"
                        bg="orange.50"
                        color="black"
                        borderWidth="10px"
                        borderColor="orange.solid"
                        borderRadius="xl"
                        minH="160px"
                        w="100%"
                        whiteSpace="normal"
                        textAlign="center"
                        disabled={busy || imPaused}
                        _hover={{
                          bg: "orange.100",
                          color: "black",
                          borderColor: "orange.solid",
                          borderWidth: "10px",
                        }}
                        onClick={() => void action({ type: "pick_subject", challenge: true })}
                      >
                        <Text fontSize="xl" fontWeight="bold">
                          Challenge!
                        </Text>
                      </PondButton>
                    ) : (() => {
                      const subj = playerList.find((pl) => pl.id === opt.player_id);
                      return (
                        <PondButton
                          key={opt.player_id}
                          type="button"
                          bg="white"
                          color="black"
                          borderWidth="16px"
                          borderColor="transparent"
                          borderRadius="xl"
                          minH="160px"
                          w="100%"
                          whiteSpace="normal"
                          textAlign="center"
                          disabled={busy || imPaused}
                          _hover={{
                            bg: "white",
                            color: "black",
                            borderColor: "teal.solid",
                            borderWidth: "16px",
                          }}
                          onClick={() =>
                            void action({ type: "pick_subject", target_player_id: opt.player_id })
                          }
                        >
                          <Stack gap="2" align="center" justify="center">
                            {subj ? (
                              <WhatIfPlayerFace player={subj} avatarSize="2xl" emojiFontSize="4xl" />
                            ) : null}
                            <Text fontSize="xl" fontWeight="semibold">
                              {subj?.display_name}
                            </Text>
                          </Stack>
                        </PondButton>
                      );
                    })(),
                  )
                : subjectCandidates.map((p) => (
                    <PondButton
                      key={p.id}
                      type="button"
                      bg="white"
                      color="black"
                      borderWidth="16px"
                      borderColor="transparent"
                      borderRadius="xl"
                      minH="160px"
                      w="100%"
                      whiteSpace="normal"
                      textAlign="center"
                      disabled={busy || imPaused}
                      _hover={{
                        bg: "white",
                        color: "black",
                        borderColor: "teal.solid",
                        borderWidth: "16px",
                      }}
                      onClick={() => void action({ type: "pick_subject", target_player_id: p.id })}
                    >
                      <Stack gap="2" align="center" justify="center">
                        <WhatIfPlayerFace player={p} avatarSize="2xl" emojiFontSize="4xl" />
                        <Text fontSize="xl" fontWeight="semibold">
                          {p.display_name}
                        </Text>
                      </Stack>
                    </PondButton>
                  ))}
            </SimpleGrid>
          </Stack>
        ) : null}

        {showVoteGrid ? (
          <Box w="75%" maxW="100%" mx="auto">
            <Grid
              w="100%"
              templateColumns="repeat(2, minmax(0, 1fr))"
              gap="1.5"
            >
              {Object.entries(answers)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([k, answer]) => {
                  const idx = Number(k);
                  const isSelected = myVote === idx;
                  const isHiddenAfterVote = !!myVote && !isSelected;
                  const tileDisabled =
                    imPaused ||
                    votingPaused ||
                    (!!myVote && !isSelected);
                  return (
                    <GridItem key={k} minW={0} aspectRatio={1}>
                      <PondButton
                        type="button"
                        bg="white"
                        color="black"
                        borderWidth="6px"
                        borderColor={isSelected ? "teal.solid" : "transparent"}
                        borderRadius="lg"
                        h="100%"
                        w="100%"
                        py="1.5"
                        px="1.5"
                        whiteSpace="normal"
                        textAlign="center"
                        disabled={tileDisabled}
                        visibility={isHiddenAfterVote ? "hidden" : "visible"}
                        pointerEvents={isHiddenAfterVote ? "none" : "auto"}
                        _hover={{
                          bg: "white",
                          color: "black",
                          borderColor: "teal.solid",
                          borderWidth: "6px",
                        }}
                        onClick={() =>
                          isSelected
                            ? void action({ type: "unvote" })
                            : void action({ type: "vote", option_index: idx })
                        }
                      >
                        <Stack gap="0.5" align="center" justify="center" maxW="100%">
                          <Text fontSize="sm" opacity={0.25} lineHeight="1">
                            {idx}
                          </Text>
                          <Text
                            fontWeight="semibold"
                            textAlign="center"
                            lineHeight="1.15"
                            fontSize="clamp(0.78rem, 2.75vw, 1rem)"
                            css={{
                              display: "-webkit-box",
                              WebkitLineClamp: 4,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              wordBreak: "break-word",
                            }}
                          >
                            {answer}
                          </Text>
                        </Stack>
                      </PondButton>
                    </GridItem>
                  );
                })}
            </Grid>
          </Box>
        ) : null}

        {state?.status === "ended" ? (
          <Box
            borderWidth="1px"
            borderColor="border"
            borderRadius="xl"
            p="4"
            bg="orange.100"
          >
            <Stack gap="2">
              <Text fontWeight="bold" fontSize="xl">
                {didWin
                  ? `You won with ${myPlacement?.score ?? me?.score ?? 0} points!`
                  : `You came in ${myPlacement?.rank ?? "?"}${myPlacement?.rank === 1 ? "st" : myPlacement?.rank === 2 ? "nd" : myPlacement?.rank === 3 ? "rd" : "th"} place with ${myPlacement?.score ?? me?.score ?? 0} points!`}
              </Text>
              <PondButton
                type="button"
                colorPalette="teal"
                alignSelf="flex-start"
                onClick={() => navigate("/whatif?tab=join")}
              >
                Return to lobby
              </PondButton>
            </Stack>
          </Box>
        ) : null}

        {error ? (
          <Text role="alert" color="nautical.solid">
            {error}
          </Text>
        ) : null}
      </Stack>
    </WhatIfShell>
  );
}
