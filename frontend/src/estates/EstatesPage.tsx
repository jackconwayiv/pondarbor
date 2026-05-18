import {
  Avatar,
  Badge,
  Box,
  Collapsible,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  PanelListRowSkeleton,
  PanelMessageSlot,
  PanelPageShell,
  SessionLoadingCard,
} from "../components/panelStatus";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import {
  cancelEstatesLobby,
  confirmEstatesLobby,
  createEstatesLobby,
  fetchMyEstatesGame,
  fetchMyEstatesGamesList,
  leaveEstatesLobby,
  joinEstatesLobby,
  listOpenEstatesLobbies,
  type EstatesGameState,
  type EstatesMyGameRow,
  type EstatesMyGamesResponse,
} from "./api";
import { estatesLobbiesWsUrl } from "./estatesWs";

function isUserInGame(game: EstatesGameState, userId: number | undefined): boolean {
  if (!userId) return false;
  return game.player_1_id === userId || game.player_2_id === userId;
}

function formatEstatesMyGameCreated(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function opponentNameForMyGameRow(row: EstatesMyGameRow): string | null {
  const hostName = row.player_names[0];
  const guestName = row.player_names[1];
  if (row.is_owner) {
    return guestName?.trim() || null;
  }
  return hostName?.trim() || null;
}

function myGameOpponentLabel(row: EstatesMyGameRow): string {
  const opponent = opponentNameForMyGameRow(row);
  if (opponent) return `vs. ${opponent}`;
  return "Waiting for opponent";
}

export default function EstatesPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    error: sessionError,
    refreshSession,
  } = useAppSession();

  const [openLobbies, setOpenLobbies] = useState<EstatesGameState[] | null>(null);
  const [myGame, setMyGame] = useState<EstatesGameState | null>(null);
  const [myGames, setMyGames] = useState<EstatesMyGamesResponse | null>(null);
  const [myGamesLoading, setMyGamesLoading] = useState(false);
  const [myGamesOpen, setMyGamesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const myUserId = sessionUser?.user.id;

  const loadLobbyData = useCallback(async () => {
    if (!isAuthenticated) return;
    setError(null);
    setMyGamesLoading(true);
    try {
      const token = await getApiAccessToken();
      const [rows, mine, gamesList] = await Promise.all([
        listOpenEstatesLobbies(token),
        fetchMyEstatesGame(token),
        fetchMyEstatesGamesList(token),
      ]);
      setOpenLobbies(rows);
      setMyGame(mine);
      setMyGames(gamesList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lobbies.");
    } finally {
      setMyGamesLoading(false);
    }
  }, [getApiAccessToken, isAuthenticated]);

  const myGamesTotalCount = useMemo(() => {
    if (!myGames) return 0;
    return myGames.open_lobby.length + myGames.in_progress.length + myGames.completed.length;
  }, [myGames]);

  useEffect(() => {
    void loadLobbyData();
  }, [loadLobbyData]);

  useEffect(() => {
    if (myGame?.status === "active" && myGame.id) {
      navigate(`/estates/play/${myGame.id}`, { replace: true });
    }
  }, [myGame, navigate]);

  useEffect(() => {
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = async () => {
      try {
        const token = await getApiAccessToken();
        if (cancelled) return;
        socket = new WebSocket(estatesLobbiesWsUrl(token));
        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as { type?: string };
            if (msg.type === "lobbies_update" || msg.type === "connected") {
              void loadLobbyData();
            }
          } catch {
            /* ignore malformed events */
          }
        };
        socket.onclose = () => {
          if (cancelled) return;
          reconnectTimer = window.setTimeout(() => {
            void connect();
          }, 1200);
        };
      } catch {
        if (cancelled) return;
        reconnectTimer = window.setTimeout(() => {
          void connect();
        }, 1200);
      }
    };

    void connect();
    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (socket) {
        socket.close();
      }
    };
  }, [getApiAccessToken, loadLobbyData]);

  const onCreateLobby = async () => {
    setBusyAction("create");
    setError(null);
    try {
      const token = await getApiAccessToken();
      const game = await createEstatesLobby(token, 7);
      setMyGame(game);
      await loadLobbyData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create lobby.");
    } finally {
      setBusyAction(null);
    }
  };

  const onJoinLobby = async (gameId: string) => {
    setBusyAction(`join-${gameId}`);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const game = await joinEstatesLobby(token, gameId);
      setMyGame(game);
      await loadLobbyData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join lobby.");
    } finally {
      setBusyAction(null);
    }
  };

  const onConfirmLobby = async (gameId: string) => {
    setBusyAction(`confirm-${gameId}`);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const game = await confirmEstatesLobby(token, gameId);
      setMyGame(game);
      await loadLobbyData();
      if (game.status === "active") {
        navigate(`/estates/play/${game.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm lobby.");
    } finally {
      setBusyAction(null);
    }
  };

  const onCancelLobby = async (gameId: string) => {
    setBusyAction(`cancel-${gameId}`);
    setError(null);
    try {
      const token = await getApiAccessToken();
      await cancelEstatesLobby(token, gameId);
      setMyGame(null);
      await loadLobbyData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel lobby.");
    } finally {
      setBusyAction(null);
    }
  };

  const onLeaveLobby = async (gameId: string) => {
    setBusyAction(`leave-${gameId}`);
    setError(null);
    try {
      const token = await getApiAccessToken();
      const game = await leaveEstatesLobby(token, gameId);
      setMyGame(game.player_2_id ? game : null);
      await loadLobbyData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not leave lobby.");
    } finally {
      setBusyAction(null);
    }
  };

  const openLobbyGame = myGame && myGame.status === "lobby" ? myGame : null;
  const amLobbyOwner = Boolean(openLobbyGame && myUserId === openLobbyGame.player_1_id);

  function renderMyGameRow(row: EstatesMyGameRow) {
    const showResume = row.status === "active";
    const showOpenLobby = row.status === "lobby";
    const showStatusTag = row.status === "completed";
    const scoreLabel =
      row.my_score != null && row.opponent_score != null
        ? `${row.my_score}–${row.opponent_score}`
        : null;
    return (
      <Flex
        key={row.id}
        flexWrap="wrap"
        alignItems="center"
        gap="3"
        py="3"
        borderBottomWidth="1px"
        borderColor="border"
        rowGap="2"
      >
        <Text minW="7rem" fontSize="sm" color="fg.muted" flexShrink={0}>
          {formatEstatesMyGameCreated(row.created_at)}
        </Text>
        <Text flex="1" minW="8rem" fontSize="sm">
          {myGameOpponentLabel(row)}
        </Text>
        {row.status === "active" && scoreLabel ? (
          <Text fontSize="sm" color="fg.muted" flexShrink={0}>
            Round {row.round} · {scoreLabel}
          </Text>
        ) : null}
        {showStatusTag ? (
          <Badge
            bg="yellow.200"
            color="black"
            borderWidth="1px"
            borderColor="yellow.400"
            flexShrink={0}
            fontWeight="semibold"
          >
            {row.winner_display_name ? `Winner: ${row.winner_display_name}` : "Completed"}
          </Badge>
        ) : null}
        <HStack gap="2" flexShrink={0} flexWrap="wrap">
          {showOpenLobby ? (
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="lilypad"
              disabled={row.id !== myGame?.id}
              onClick={() => void loadLobbyData()}
            >
              Open lobby
            </PondButton>
          ) : null}
          {showResume ? (
            <PondButton
              type="button"
              size="sm"
              colorPalette="lilypad"
              onClick={() => navigate(`/estates/play/${row.id}`)}
            >
              Resume game
            </PondButton>
          ) : null}
        </HStack>
      </Flex>
    );
  }

  function renderMyGamesSection(title: string, rows: EstatesMyGameRow[]) {
    if (rows.length === 0) return null;
    return (
      <Stack key={title} gap="2" align="stretch">
        <Text fontWeight="bold" fontSize={APP_TEXT_SIZES.body}>
          {title}
        </Text>
        <Stack gap="0" align="stretch">
          {rows.map((row) => renderMyGameRow(row))}
        </Stack>
      </Stack>
    );
  }

  if (isLoading) {
    return <SessionLoadingCard />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (!sessionUser) {
    return (
      <PanelPageShell>
        <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Stack gap="3" align="flex-start">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
                Reconnecting your API session…
              </Text>
              <Text fontSize={APP_TEXT_SIZES.helper}>
                {sessionError || "You are authenticated, but the API session is not ready yet."}
              </Text>
              <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
                Retry session sync
              </PondButton>
            </Stack>
          </Box>
        </Stack>
      </PanelPageShell>
    );
  }

  return (
    <PanelPageShell>
      <Stack gap={{ base: "3", md: "3" }} p={{ base: "2", md: "2" }}>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            Estates
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
            A head-to-head card duel. Create an open lobby, join an existing one, then confirm to deal opening
            hands and begin round 1.
          </Text>
        </Box>

        <PanelMessageSlot error={error} />

        {openLobbyGame ? (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Box borderWidth="1px" borderColor="border" borderRadius="md" bg="bg" p="3">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="3">
                {amLobbyOwner ? "Your Lobby" : `${openLobbyGame.player_1.display_name}'s Lobby`}
              </Text>
              <HStack gap="2" align="stretch" flexWrap="nowrap">
                {[
                  { key: "1", label: "Seat 1", player: openLobbyGame.player_1 },
                  { key: "2", label: "Seat 2", player: openLobbyGame.player_2 },
                ].map((seat) => {
                  const seated = Boolean(seat.player);
                  return (
                    <HStack
                      key={seat.key}
                      flex="1"
                      borderWidth="1px"
                      borderColor="border"
                      borderRadius="md"
                      p="2"
                      bg={seated ? "bg" : "bg.subtle"}
                      opacity={seated ? 1 : 0.7}
                      gap="2"
                    >
                      {seated ? (
                        <Avatar.Root size="sm">
                          <Avatar.Fallback name={seat.player?.display_name || seat.label} />
                          <Avatar.Image src={seat.player?.avatar_url || undefined} />
                        </Avatar.Root>
                      ) : (
                        <Box
                          w="8"
                          h="8"
                          borderRadius="full"
                          bg="gray.300"
                          borderWidth="1px"
                          borderColor="border"
                        />
                      )}
                      <Stack gap="0">
                        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                          {seat.label}
                        </Text>
                        <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium" color="fg">
                          {seat.player?.display_name || "Empty seat"}
                        </Text>
                      </Stack>
                    </HStack>
                  );
                })}
              </HStack>
            </Box>
            <HStack mt="1" gap="2" flexWrap="wrap">
              {openLobbyGame.player_2_id ? (
                <>
                {amLobbyOwner ? (
                  <PondButton
                    colorPalette="lilypad"
                    onClick={() => void onConfirmLobby(openLobbyGame.id)}
                    loading={busyAction === `confirm-${openLobbyGame.id}`}
                  >
                    Start Game
                  </PondButton>
                ) : (
                  <PondButton
                    colorPalette="sky"
                    variant="outline"
                    onClick={() => void onLeaveLobby(openLobbyGame.id)}
                    loading={busyAction === `leave-${openLobbyGame.id}`}
                  >
                    Leave lobby
                  </PondButton>
                )}
                </>
              ) : amLobbyOwner ? (
                <PondButton
                  colorPalette="nautical"
                  variant="outline"
                  onClick={() => void onCancelLobby(openLobbyGame.id)}
                  loading={busyAction === `cancel-${openLobbyGame.id}`}
                >
                  Cancel lobby
                </PondButton>
              ) : null}
            </HStack>
          </Box>
        ) : (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <HStack justify="space-between" align="center" mb="3">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label}>
                Open Lobbies
              </Text>
              <PondButton
                colorPalette="lilypad"
                onClick={() => void onCreateLobby()}
                loading={busyAction === "create"}
              >
                New Game
              </PondButton>
            </HStack>
            {openLobbies === null ? (
              <PanelListRowSkeleton rows={3} />
            ) : openLobbies.length === 0 ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                No open lobbies right now.
              </Text>
            ) : (
              <Stack gap="2">
                {openLobbies.map((game) => {
                  const inGame = isUserInGame(game, myUserId);
                  return (
                    <Box key={game.id} borderWidth="1px" borderColor="border" borderRadius="md" p="2" bg="bg">
                      <HStack justify="space-between" align="center" gap="2">
                        <HStack gap="2" minW="0">
                          <Avatar.Root size="sm">
                            <Avatar.Fallback name={game.player_1.display_name || "Player"} />
                            <Avatar.Image src={game.player_1.avatar_url || undefined} />
                          </Avatar.Root>
                          <Text fontSize={APP_TEXT_SIZES.body} fontWeight="semibold" lineClamp={1}>
                            {game.player_1.display_name}'s lobby
                          </Text>
                        </HStack>
                        <PondButton
                          size="sm"
                          colorPalette="lilypad"
                          onClick={() => void onJoinLobby(game.id)}
                          loading={busyAction === `join-${game.id}`}
                          disabled={inGame}
                        >
                          {inGame ? "Joined" : "Join"}
                        </PondButton>
                      </HStack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}

        {myGamesTotalCount >= 1 && !myGamesLoading && myGames ? (
          <Box {...PANEL_ENTRY_CARD_PROPS}>
            <Collapsible.Root
              open={myGamesOpen}
              onOpenChange={(details) => setMyGamesOpen(details.open)}
            >
              <Collapsible.Trigger asChild>
                <button
                  type="button"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    width: "100%",
                    textAlign: "left",
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "inherit",
                    cursor: "pointer",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    margin: 0,
                  }}
                >
                  <Text
                    as="span"
                    transform={myGamesOpen ? "rotate(90deg)" : "rotate(0deg)"}
                    transition="transform 0.15s ease"
                    lineHeight="1"
                    flexShrink={0}
                  >
                    ›
                  </Text>
                  <Text as="span" flex="1">
                    My games ({myGamesTotalCount})
                  </Text>
                </button>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <Stack gap="4" pt="2">
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                    Resume an in-progress duel or return to a lobby you are hosting or joined.
                  </Text>
                  <Stack gap="6" align="stretch">
                    {renderMyGamesSection("Open lobby", myGames.open_lobby)}
                    {renderMyGamesSection("In progress", myGames.in_progress)}
                    {renderMyGamesSection("Completed", myGames.completed)}
                  </Stack>
                </Stack>
              </Collapsible.Content>
            </Collapsible.Root>
          </Box>
        ) : null}

      </Stack>
    </PanelPageShell>
  );
}

