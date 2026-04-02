import { useAuth0 } from "@auth0/auth0-react";
import { Avatar, Box, Checkbox, Code, Heading, HStack, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import PondButton from "../PondButton";
import { auth0DefaultLoginParams, auth0LoginWithReturnTo } from "../auth/auth0LoginParams";
import { useAppSession } from "../auth/AppSessionContext";
import {
  fetchWhatIfHandState,
  joinWhatIfSession,
  loadPlayerToken,
  postWhatIfAction,
  savePlayerToken,
} from "./api";
import WhatIfShell from "./WhatIfShell";
import { whatifInputProps } from "./whatifFieldProps";
import type { WhatIfPlayer, WhatIfSessionState } from "./types";

const POLL_MS = 2000;

export default function WhatIfHandPage() {
  const { code = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const { loginWithRedirect } = useAuth0();
  const { sessionUser, isAuthenticated, getApiAccessToken } = useAppSession();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [name, setName] = useState("");
  const defaultDisplayName = useMemo(
    () => sessionUser?.profile?.display_name ?? "",
    [sessionUser?.profile?.display_name],
  );
  const playerToken = useMemo(() => loadPlayerToken(roomCode), [roomCode]);

  useEffect(() => {
    if (defaultDisplayName) setName(defaultDisplayName);
  }, [defaultDisplayName]);

  useEffect(() => {
    if (!playerToken) return;
    const token = playerToken;
    let cancelled = false;
    async function poll() {
      try {
        // Always fetch full state (no `since=`) so we never rely on HTTP 304 — Vite's dev proxy often maps 304 → 502.
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
    // Keep post-results timer-driven UI ("next turn" button) reactive.
    if (state?.status !== "post_results") return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state?.status]);

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      const token = isAuthenticated ? await getApiAccessToken() : null;
      const displayName = (name.trim() || defaultDisplayName || "Guest").slice(0, 80);
      const joined = await joinWhatIfSession(roomCode, displayName, token);
      savePlayerToken(roomCode, joined.player_secret);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to join");
    } finally {
      setBusy(false);
    }
  }

  async function action(payload: {
    type: "toggle_ready" | "pick_subject" | "vote" | "reveal" | "next_turn" | "skip";
    option_index?: number;
    target_player_id?: number;
  }) {
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
            Join Whatif <Code fontSize="2em">{roomCode}</Code>
          </Heading>
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
                colorPalette="sky"
                onClick={() =>
                  void loginWithRedirect(
                    auth0LoginWithReturnTo(`${location.pathname}${location.search}`, {
                      authorizationParams: auth0DefaultLoginParams(),
                    }),
                  )
                }
              >
                Sign in
              </PondButton>
            </HStack>
          ) : null}

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
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultDisplayName ? `Display name (${defaultDisplayName})` : "Display name"}
              maxLength={80}
              {...whatifInputProps}
            />
          </HStack>

          <PondButton
            type="button"
            colorPalette="lilypad"
            size="md"
            alignSelf="flex-start"
            onClick={() => void handleJoin()}
            loading={busy}
          >
            Join this phone
          </PondButton>

          {error ? (
            <Text role="alert" color="red.600">
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
  const subjectCandidateIds = state?.state?.subject_candidate_ids ?? [];
  const subjectCandidates = subjectCandidateIds
    .map((id) => playerList.find((p) => p.id === id))
    .filter((p): p is WhatIfPlayer => p != null);
  const needSubjectPick = state?.status === "turn" && subjectCandidates.length > 0 && !state?.state?.challenge_target_player_id;
  const activeId = state?.state?.active_player_id;
  const activeName = playerList.find((p) => p.id === activeId)?.display_name ?? "Active player";
  const answers = state?.state?.question?.answers ?? {};
  const votedIds = state?.state?.voted_player_ids ?? [];
  const eligibleVoterIds = new Set(playerList.filter((p) => !p.paused).map((p) => p.id));
  const allPlayersVoted =
    playerList.length > 0 &&
    (eligibleVoterIds.size === 0 || [...eligibleVoterIds].every((id) => votedIds.includes(id)));
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
  const myRoundPointsPhrase = myRoundPoints === 1 ? "1 point" : `${myRoundPoints} points`;

  return (
    <WhatIfShell withPanel={false}>
      <Stack gap="5">
        <Stack gap="3" p="4" borderWidth="1px" borderColor="border" borderRadius="xl" bg="bg">
          <HStack justify="space-between" align="center" w="100%" gap="3">
            <Heading as="h1" size="xl">
              {me ? `${me.avatar_emoji} ${me.display_name}'s hand` : "Your hand"}
            </Heading>
            <Code fontSize="2em">{roomCode}</Code>
          </HStack>
          {imPaused ? (
            <Text p="3" borderRadius="md" bg="orange.100" color="gray.800" fontWeight="medium">
              You&apos;re paused by the host. Your vote isn&apos;t needed this round; ask them to tap Resume on the TV
              when you&apos;re back.
            </Text>
          ) : null}
          {(state?.status === "open" || state?.status === "pre_lobby") && me ? (
            <Stack gap="2" alignSelf="flex-start" maxW="100%">
              <Checkbox.Root
                checked={!!me.ready_to_start}
                onCheckedChange={() => {
                  if (busy) return;
                  void action({ type: "toggle_ready" });
                }}
                disabled={busy}
                colorPalette="lilypad"
                size="md"
              >
                <Checkbox.HiddenInput />
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <Checkbox.Label fontWeight="medium">Ready to start</Checkbox.Label>
              </Checkbox.Root>
              <Text fontSize="sm" color="gray.600">
                The host starts the game from the lobby when everyone is ready.
              </Text>
            </Stack>
          ) : null}
          {state?.state?.question ? <Text fontWeight="bold">{state.state.question.prompt}</Text> : null}
          {needSubjectPick && !isActive ? (
            <Text color="gray.700">Waiting for {activeName} to choose who this round is about…</Text>
          ) : null}
          {needSubjectPick && isActive ? <Text fontWeight="medium">Pick who this round is about:</Text> : null}
          {myVote ? (
            <Text color="gray.700">
              You voted for {answers[String(myVote)] ?? String(myVote)}
            </Text>
          ) : null}
          {state?.status === "voting" && isActive ? (
            allPlayersVoted ? (
              <PondButton
                type="button"
                colorPalette="lilypad"
                alignSelf="flex-start"
                onClick={() => void action({ type: "reveal" })}
                loading={busy}
                disabled={busy || imPaused}
              >
                Reveal votes
              </PondButton>
            ) : null
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
                {myRoundPointsPhrase}
              </Text>
              {isActive ? (
                canAdvance ? (
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
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

        {needSubjectPick && isActive ? (
          <Stack gap="3" w="100%">
            <SimpleGrid columns={2} gap="3" w="100%">
              {subjectCandidates.map((p) => (
                <PondButton
                  key={p.id}
                  type="button"
                  bg="white"
                  color="black"
                  borderWidth="20px"
                  borderColor="transparent"
                  borderRadius="xl"
                  minH="180px"
                  w="100%"
                  whiteSpace="normal"
                  textAlign="center"
                  disabled={busy || imPaused}
                  _hover={{
                    bg: "white",
                    color: "black",
                    borderColor: "lilypad.solid",
                    borderWidth: "20px",
                  }}
                  onClick={() => void action({ type: "pick_subject", target_player_id: p.id })}
                >
                  <Stack gap="2" align="center" justify="center">
                    <Text fontSize="4xl" lineHeight="1">
                      {p.avatar_emoji}
                    </Text>
                    <Text fontSize="xl" fontWeight="semibold">
                      {p.display_name}
                    </Text>
                  </Stack>
                </PondButton>
              ))}
            </SimpleGrid>
          </Stack>
        ) : null}

        {state?.status === "voting" ? (
          <Stack gap="3">
            <SimpleGrid columns={2} gap="3">
              {Object.entries(answers)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([k, answer]) => {
                  const idx = Number(k);
                  const isHiddenAfterVote = !!myVote && myVote !== idx;
                  return (
                    <PondButton
                      key={k}
                      type="button"
                      bg="white"
                      color="black"
                      borderWidth="20px"
                      borderColor="transparent"
                      borderRadius="xl"
                      minH="180px"
                      w="100%"
                      whiteSpace="normal"
                      textAlign="center"
                      disabled={!!myVote || imPaused}
                      visibility={isHiddenAfterVote ? "hidden" : "visible"}
                      pointerEvents={isHiddenAfterVote ? "none" : "auto"}
                      _hover={{
                        bg: "white",
                        color: "black",
                        borderColor: "lilypad.solid",
                        borderWidth: "20px",
                      }}
                      onClick={() => void action({ type: "vote", option_index: idx })}
                    >
                      <Stack gap="2" align="center" justify="center">
                        <Text fontSize="2xl" opacity={0.25} lineHeight="1">
                          {idx}
                        </Text>
                        <Text fontSize="xl" fontWeight="semibold">
                          {answer}
                        </Text>
                      </Stack>
                    </PondButton>
                  );
                })}
            </SimpleGrid>
          </Stack>
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
                colorPalette="lilypad"
                alignSelf="flex-start"
                onClick={() => navigate("/whatif?tab=join")}
              >
                Return to lobby
              </PondButton>
            </Stack>
          </Box>
        ) : null}

        {error ? (
          <Text role="alert" color="red.600">
            {error}
          </Text>
        ) : null}
      </Stack>
    </WhatIfShell>
  );
}

