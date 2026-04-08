import { Code, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import PondButton from "../PondButton";
import WhatIfShell from "./WhatIfShell";
import {
  fetchWhatIfTvState,
  loadHostToken,
  postWhatIfAction,
} from "./api";
import type { WhatIfSessionState } from "./types";

const POLL_MS = 2000;

export default function WhatIfLobbyPage() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const roomCode = code.toUpperCase();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hostToken = useMemo(() => loadHostToken(roomCode), [roomCode]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        // No `since=` — avoids HTTP 304, which Vite's dev proxy often surfaces as 502.
        const next = await fetchWhatIfTvState(roomCode);
        if (!cancelled && next) {
          setState(next);
          if (next.status !== "open" && next.status !== "pre_lobby") {
            navigate(`/whatif/play/${roomCode}`);
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load lobby");
      }
    }
    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [roomCode, navigate]);

  async function handleStart() {
    if (!hostToken) {
      setError("Host session missing. Create the game from this account again, then return to the lobby.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postWhatIfAction(roomCode, { type: "start_game" }, { hostToken });
      navigate(`/whatif/play/${roomCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start game");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WhatIfShell maxW="min(100%, 90rem)">
      <Stack gap={{ base: "4", md: "5" }}>
        <HStack justify="space-between" align="center" w="100%" flexWrap="wrap" gap="3">
          <Heading as="h1" fontSize="clamp(1.35rem, 3.5vh, 2.5rem)" fontWeight="bold" lineHeight="1.15">
            Whatif Lobby
          </Heading>
          <Code fontSize="clamp(1.75rem, 5vh, 3.25rem)">{roomCode}</Code>
        </HStack>
        <Text color="gray.700" fontSize="clamp(1rem, 2.4vh, 1.35rem)">
          {state?.players?.length ?? 0} players in game
        </Text>
        <Stack gap="2">
          {(state?.players ?? []).map((p) => (
            <HStack
              key={p.id}
              justify="space-between"
              borderWidth="1px"
              borderColor="border"
              borderRadius="md"
              px={{ base: "4", md: "5" }}
              py={{ base: "3", md: "4" }}
            >
              <Text fontSize="clamp(1rem, 2.5vh, 1.4rem)">
                {p.avatar_emoji} {p.display_name}
              </Text>
              <Text
                fontSize="clamp(0.9rem, 2vh, 1.1rem)"
                color={p.ready_to_start ? "lilypad.fg" : "gray.600"}
              >
                {p.ready_to_start ? "Ready" : "Not ready"}
              </Text>
            </HStack>
          ))}
        </Stack>

        {hostToken &&
        state &&
        (state.players?.length ?? 0) >= 2 &&
        !(state.players ?? []).every((p) => p.ready_to_start) ? (
          <Text fontSize="clamp(0.95rem, 2vh, 1.15rem)" color="gray.600">
            Waiting for every player to mark &quot;Ready to start&quot; on their phone.
          </Text>
        ) : null}

        <PondButton
          type="button"
          colorPalette="lilypad"
          alignSelf="flex-start"
          onClick={() => void handleStart()}
          disabled={(() => {
            const players = state?.players ?? [];
            return (
              !state ||
              !hostToken ||
              players.length < 2 ||
              !players.every((p) => p.ready_to_start)
            );
          })()}
          loading={busy}
        >
          Start game
        </PondButton>

        {!hostToken ? (
          <Text color="gray.700">
            Host token missing (open the lobby right after creating a game while signed in).
          </Text>
        ) : null}
        <Text fontSize="clamp(0.95rem, 2vh, 1.15rem)" color="gray.700">
          Players join on their phones using the join code.
        </Text>

        {error ? (
          <Text role="alert" color="nautical.solid">
            {error}
          </Text>
        ) : null}
      </Stack>
    </WhatIfShell>
  );
}

