import { Box, Code, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { WhatIfPlayerFace } from "./whatifPlayerFace";
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
              <HStack align="flex-start" justify="space-between" gap="4" w="100%" flexWrap="wrap">
                <Stack flex="1" minW={0} gap="2">
                  <Heading as="h1" size={{ base: "lg", md: "xl" }} fontWeight="bold">
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
                  <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                    Host the TV; players join on their phones with the room code. When at least two
                    players have joined, start the game.
                  </Text>
                </Stack>
                <Code
                  flexShrink={0}
                  alignSelf="flex-start"
                  fontSize="clamp(1.75rem, 5vw, 3.25rem)"
                  lineHeight="1"
                  fontWeight="bold"
                  letterSpacing="0.08em"
                  px={{ base: "2", md: "3" }}
                  py={{ base: "1.5", md: "2" }}
                  borderRadius="md"
                  aria-label={`Room code ${roomCode}`}
                >
                  {roomCode}
                </Code>
              </HStack>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
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
                    borderWidth="1px"
                    borderColor="border"
                    borderRadius="md"
                    px={{ base: "3", md: "4" }}
                    py={{ base: "2", md: "3" }}
                    bg="bg"
                    gap="3"
                    align="center"
                  >
                    <WhatIfPlayerFace player={p} avatarSize="md" emojiFontSize="1.35em" />
                    <Text fontSize={APP_TEXT_SIZES.body}>
                      {p.display_name}
                    </Text>
                  </HStack>
                ))}
              </Stack>

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
                    players.length < 2
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
