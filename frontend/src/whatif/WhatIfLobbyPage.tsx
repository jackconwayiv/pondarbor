import { Box, Code, Heading, HStack, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import { loadHostToken, postWhatIfAction } from "./api";
import type { WhatIfSessionState } from "./types";
import { useWhatIfSessionSync } from "./useWhatIfSessionSync";
import { whatifInputProps } from "./whatifFieldProps";
import { WhatIfNpcFace, WhatIfPlayerFace } from "./whatifPlayerFace";
import {
  whatifAvatarEmojiBoxSize,
  whatifPlayerSeatIndex,
  type WhatIfPlayerFaceRingSize,
} from "./whatifPlayerSeatColors";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

const DISPLAY_NAME_RE = /^[A-Za-z0-9 ]*$/;
const WHATIF_MAX_ENTITIES = 8;
const LOBBY_SEAT_AVATAR_SIZE: WhatIfPlayerFaceRingSize = "md";

/** Shared seat row shell — matches player/NPC cards so the grid does not jump when seats fill. */
const lobbySeatRowProps = {
  borderRadius: "md",
  px: { base: "3", md: "4" },
  py: { base: "2", md: "3" },
  gap: "3",
  align: "center",
  minW: 0,
  minH: {
    base: `calc(${whatifAvatarEmojiBoxSize(LOBBY_SEAT_AVATAR_SIZE)} + 1rem)`,
    md: `calc(${whatifAvatarEmojiBoxSize(LOBBY_SEAT_AVATAR_SIZE)} + 1.5rem)`,
  },
} as const;

function LobbySeatAvatarPlaceholder() {
  const box = whatifAvatarEmojiBoxSize(LOBBY_SEAT_AVATAR_SIZE);
  return (
    <Box
      flexShrink={0}
      w={box}
      h={box}
      minW={box}
      minH={box}
      borderRadius="full"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="gray.300"
      bg="gray.50"
      aria-hidden
    />
  );
}

function sanitizeDisplayNameInput(raw: string): string {
  return raw.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 12);
}

function LobbyEmptySeatSlot() {
  return (
    <HStack
      {...lobbySeatRowProps}
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="gray.400"
      bg="gray.100"
      aria-label="Open seat"
    >
      <LobbySeatAvatarPlaceholder />
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted" fontWeight="medium" truncate>
        Open seat
      </Text>
    </HStack>
  );
}

export default function WhatIfLobbyPage() {
  const navigate = useNavigate();
  const { code = "" } = useParams();
  const roomCode = code.toUpperCase();
  const [state, setState] = useState<WhatIfSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [npcName, setNpcName] = useState("");
  const [npcBusy, setNpcBusy] = useState(false);
  const hostToken = useMemo(() => loadHostToken(roomCode), [roomCode]);

  const players = state?.players ?? [];
  const npcs = state?.npcs ?? [];
  const entityCount = players.length + npcs.length;
  const atCapacity = entityCount >= WHATIF_MAX_ENTITIES;

  useWhatIfSessionSync({
    roomCode,
    mode: "tv",
    sessionStatus: state?.status ?? null,
    onState: (next) => {
      setState(next);
      if (next.status !== "open" && next.status !== "pre_lobby") {
        navigate(`/whatif/play/${roomCode}`);
      }
    },
    onError: setError,
  });

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

  async function handleAddNpc() {
    if (!hostToken) return;
    const displayName = sanitizeDisplayNameInput(npcName.trim());
    if (!displayName) return;
    setNpcBusy(true);
    setError(null);
    try {
      const next = await postWhatIfAction(
        roomCode,
        { type: "add_npc", display_name: displayName },
        { hostToken },
      );
      setState(next);
      setNpcName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add NPC");
    } finally {
      setNpcBusy(false);
    }
  }

  async function handleRemoveNpc(npcId: number) {
    if (!hostToken) return;
    setNpcBusy(true);
    setError(null);
    try {
      const next = await postWhatIfAction(roomCode, { type: "remove_npc", npc_id: npcId }, { hostToken });
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove NPC");
    } finally {
      setNpcBusy(false);
    }
  }

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack gap={{ base: "4", md: "4" }} px={{ base: "2", md: "2" }} pt={{ base: "2", md: "2" }} pb="2">
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <HStack align="flex-start" justify="space-between" gap="4" w="100%" flexWrap="wrap">
                <Stack flex="1" minW={0} gap="2">
                  <Heading as="h1" size={{ base: "lg", md: "xl" }}>
                    <HStack as="span" display="inline-flex" gap="2" alignItems="center">
                      <Text as="span" aria-hidden="true">
                        🎭
                      </Text>
                      <Text as="span">Whatif Lobby</Text>
                    </HStack>
                  </Heading>
                  <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                    Welcome to the WhatIf lobby! The game will be hosted on the TV. Players, join on your phones with the room code. If you're playing with a small group, consider adding NPCs.
                    Start when at least two players have joined.
                  </Text>
                </Stack>
                <Stack flexShrink={0} alignItems="flex-end" gap="2" alignSelf="flex-start">
                  <Code
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
                  <PondButton
                    type="button"
                    colorPalette="teal"
                    onClick={() => void handleStart()}
                    disabled={!state || !hostToken || players.length < 2}
                    loading={busy}
                  >
                    Start game
                  </PondButton>
                </Stack>
              </HStack>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontSize={APP_TEXT_SIZES.body} color="fg" mb="3">
                {entityCount} / {WHATIF_MAX_ENTITIES} seats · {players.length} player
                {players.length === 1 ? "" : "s"}
                {npcs.length > 0 ? ` · ${npcs.length} NPC${npcs.length === 1 ? "" : "s"}` : ""}
              </Text>
              <SimpleGrid columns={2} gap="2">
                {players.map((p) => {
                  const seatIndex = whatifPlayerSeatIndex(p.id, players);
                  return (
                    <HStack
                      key={`player-${p.id}`}
                      {...lobbySeatRowProps}
                      borderWidth="1px"
                      borderColor="border"
                      bg="bg"
                    >
                      <WhatIfPlayerFace
                        player={p}
                        seatIndex={seatIndex >= 0 ? seatIndex : undefined}
                        avatarSize={LOBBY_SEAT_AVATAR_SIZE}
                      />
                      <Text fontSize={APP_TEXT_SIZES.body} truncate>
                        {p.display_name}
                      </Text>
                    </HStack>
                  );
                })}
                {npcs.map((n) => (
                  <HStack
                    key={`npc-${n.id}`}
                    {...lobbySeatRowProps}
                    borderWidth="1px"
                    borderColor="border"
                    bg="gray.50"
                  >
                    <WhatIfNpcFace npc={n} avatarSize={LOBBY_SEAT_AVATAR_SIZE} />
                    <Text fontSize={APP_TEXT_SIZES.body} truncate fontStyle="italic" flex="1">
                      {n.display_name} (NPC)
                    </Text>
                    <PondButton
                      type="button"
                      size="xs"
                      variant="ghost"
                      colorPalette="gray"
                      disabled={npcBusy || !hostToken}
                      onClick={() => void handleRemoveNpc(n.id)}
                    >
                      Remove
                    </PondButton>
                  </HStack>
                ))}
                {Array.from({ length: WHATIF_MAX_ENTITIES - entityCount }, (_, i) => (
                  <LobbyEmptySeatSlot key={`open-seat-${i}`} />
                ))}
              </SimpleGrid>

              {hostToken && !atCapacity ? (
                <HStack gap="2" mt="4" flexWrap="wrap" align="flex-end">
                  <Box flex="1" minW="12rem">
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="1">
                      Add an NPC (optional non-players who provide additional topics for voting)
                    </Text>
                    <Input
                      {...whatifInputProps}
                      value={npcName}
                      maxLength={12}
                      placeholder="Name"
                      disabled={atCapacity || npcBusy}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (DISPLAY_NAME_RE.test(v) || v === "") {
                          setNpcName(sanitizeDisplayNameInput(v));
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleAddNpc();
                      }}
                    />
                  </Box>
                  <PondButton
                    type="button"
                    variant="outline"
                    colorPalette="teal"
                    size="md"
                    disabled={npcBusy || !sanitizeDisplayNameInput(npcName.trim())}
                    loading={npcBusy}
                    onClick={() => void handleAddNpc()}
                  >
                    Add NPC
                  </PondButton>
                </HStack>
              ) : null}

              {!hostToken ? (
                <Text color="fg.muted" fontSize={APP_TEXT_SIZES.helper} mt="3">
                  Host token missing (open the lobby right after creating a game while signed in).
                </Text>
              ) : null}
              

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
