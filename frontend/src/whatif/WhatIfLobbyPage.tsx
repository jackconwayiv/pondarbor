import { Box, Code, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
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
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                fontWeight="bold"
                mb="2"
              >
                <HStack
                  as="span"
                  display="inline-flex"
                  gap="2"
                  alignItems="center"
                >
                  <Text as="span" aria-hidden="true">
                    🎭
                  </Text>
                  <Text as="span">Whatif Lobby</Text>
                </HStack>
              </Heading>
              <Text
                fontSize={APP_TEXT_SIZES.body}
                lineHeight="tall"
                color="fg"
              >
                Host the TV; players join on their phones with the room code. When
                everyone is ready, start the game.
              </Text>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <HStack
                justify="space-between"
                align="center"
                w="100%"
                flexWrap="wrap"
                gap="3"
                mb="3"
              >
                <Text
                  fontSize={APP_TEXT_SIZES.label}
                  fontWeight="semibold"
                  color="fg.muted"
                >
                  Room code
                </Text>
                <Code
                  fontSize={{ base: "md", md: "lg" }}
                  px="2"
                  py="1"
                  borderRadius="md"
                >
                  {roomCode}
                </Code>
              </HStack>
              <Text
                fontSize={APP_TEXT_SIZES.body}
                color="fg"
                mb="3"
              >
                {state?.players?.length ?? 0} player
                {(state?.players?.length ?? 0) === 1 ? "" : "s"} in the lobby
              </Text>
              <Stack gap="2">
                {(state?.players ?? []).map((p) => (
                  <HStack
                    key={p.id}
                    justify="space-between"
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                    px={{ base: "3", md: "4" }}
                    py={{ base: "2", md: "3" }}
                    bg="bg"
                  >
                    <Text fontSize={APP_TEXT_SIZES.body}>
                      {p.avatar_emoji} {p.display_name}
                    </Text>
                    <Text
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      color={p.ready_to_start ? "lilypad.fg" : "fg.muted"}
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
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg.muted"
                  mt="3"
                >
                  Waiting for every player to mark &quot;Ready to start&quot; on
                  their phone.
                </Text>
              ) : null}

              <PondButton
                type="button"
                colorPalette="teal"
                alignSelf="flex-start"
                mt="4"
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
                <Text
                  color="fg.muted"
                  fontSize={APP_TEXT_SIZES.helper}
                  mt="3"
                >
                  Host token missing (open the lobby right after creating a game
                  while signed in).
                </Text>
              ) : null}
              <Text
                fontSize={APP_TEXT_SIZES.helper}
                color="fg.muted"
                mt="2"
              >
                Players join on their phones using the join code.
              </Text>

              {error ? (
                <Text
                  role="alert"
                  color="nautical.solid"
                  fontWeight="medium"
                  fontSize={APP_TEXT_SIZES.helper}
                  mt="2"
                >
                  {error}
                </Text>
              ) : null}
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
