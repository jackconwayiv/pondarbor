import {
  Avatar,
  Badge,
  Box,
  Collapsible,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { emojiForAchievementSlug } from "../achievements/achievementIcon";
import {
  PanelMessageSlot,
  PanelPageShell,
  SessionLoadingCard,
} from "../components/panelStatus";
import PondButton from "../PondButton";
import { APP_SHELL_TAB_LIST_PROPS, APP_SHELL_TAB_TRIGGER_PROPS } from "../theme/appShellTabs";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import {
  cancelEstatesLobby,
  confirmEstatesLobby,
  createEstatesLobby,
  createSoloEstatesGame,
  fetchMyEstatesGame,
  fetchMyEstatesGamesList,
  fetchMyEstatesStats,
  leaveEstatesLobby,
  joinEstatesLobby,
  listOpenEstatesLobbies,
  type EstatesGameState,
  type EstatesComputerDifficulty,
  type EstatesMyGameRow,
  type EstatesMyGamesResponse,
  type EstatesUserStats,
} from "./api";
import { EstatesHowToPlayPanel } from "./EstatesHowToPlayPanel";
import EstatesResumeBanners from "./EstatesResumeBanners";
import { connectEstatesWebSocket } from "./estatesWsClient";
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

const MY_GAMES_PAGE_SIZE = 10;
/** Coalesce rapid lobby WebSocket events into one background fetch. */
const LOBBY_WS_REFRESH_DEBOUNCE_MS = 600;

type EstatesLandingTab = "play" | "help";

function formatStatProgress(current: number, target: number): string {
  return `${current} / ${target}`;
}

function hasNonZeroEstatesStats(stats: EstatesUserStats | null): boolean {
  if (!stats) return false;
  if (stats.games_completed > 0 || stats.pvp_wins > 0 || stats.solo_wins > 0) {
    return true;
  }
  return Object.values(stats.zone_wins).some((count) => count > 0);
}

const ZONE_STAT_ROWS = [
  { slug: "estates_farmhand", label: "Farm", zoneKey: "farm" as const },
  { slug: "estates_highwayman", label: "Road", zoneKey: "road" as const },
  { slug: "estates_lookout", label: "Tower", zoneKey: "tower" as const },
  { slug: "estates_gatekeeper", label: "Gate", zoneKey: "gate" as const },
  { slug: "estates_monarch", label: "Throne", zoneKey: "throne" as const },
] as const;

const MATCH_STAT_ROWS = [
  { slug: "estates_noble", label: "Games played", statKey: "games_completed" as const, thresholdKey: "noble" as const },
  { slug: "estates_royal", label: "Wins vs players", statKey: "pvp_wins" as const, thresholdKey: "royal" as const },
  { slug: "estates_peasant", label: "Wins vs computer", statKey: "solo_wins" as const, thresholdKey: "peasant" as const },
] as const;

function computerDifficultyLabel(
  difficulty: EstatesMyGameRow["computer_difficulty"],
): string | null {
  if (!difficulty) return null;
  return DIFFICULTY_OPTIONS.find((opt) => opt.value === difficulty)?.label ?? null;
}

function computerOpponentName(
  difficulty: EstatesMyGameRow["computer_difficulty"],
): string {
  const label = computerDifficultyLabel(difficulty);
  return label ? `Computer (${label})` : "Computer";
}

function myGameOpponentLabel(row: EstatesMyGameRow): string {
  if (row.is_solo) {
    return `vs. ${computerOpponentName(row.computer_difficulty)}`;
  }
  const opponent = opponentNameForMyGameRow(row);
  if (opponent) return `vs. ${opponent}`;
  return "Waiting for opponent";
}

const DIFFICULTY_OPTIONS: { value: EstatesComputerDifficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Hard" },
];

const ESTATES_COMPUTER_CARD_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
  bg: "sky.subtle",
  borderWidth: "1px",
  borderColor: "sky.border",
  h: "full",
} as const;

const ESTATES_LOBBY_CARD_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
  bg: "lilypad.subtle",
  borderWidth: "1px",
  borderColor: "lilypad.border",
  h: "full",
} as const;

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
  const [myStats, setMyStats] = useState<EstatesUserStats | null>(null);
  const [myGamesLoading, setMyGamesLoading] = useState(false);
  const [myGamesOpen, setMyGamesOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [soloDifficulty, setSoloDifficulty] = useState<EstatesComputerDifficulty>("normal");
  const [myGamesPage, setMyGamesPage] = useState(0);
  const [landingTab, setLandingTab] = useState<EstatesLandingTab>("play");
  const [hasLoadedLobbyDataOnce, setHasLoadedLobbyDataOnce] = useState(false);
  const lobbyWsRefreshTimerRef = useRef<number | null>(null);
  const prevMyGameStatusRef = useRef<EstatesGameState["status"] | null>(null);
  const myUserId = sessionUser?.user.id;

  const loadLobbyData = useCallback(
    async (options?: { background?: boolean }) => {
      if (!isAuthenticated) return;
      const background = options?.background ?? false;
      if (!background) {
        setError(null);
        setMyGamesLoading(true);
      }
      try {
        const token = await getApiAccessToken();
        const [rows, mine, gamesList, stats] = await Promise.all([
          listOpenEstatesLobbies(token),
          fetchMyEstatesGame(token),
          fetchMyEstatesGamesList(token),
          fetchMyEstatesStats(token),
        ]);
        setOpenLobbies(rows);
        setMyGame(mine);
        setMyGames(gamesList);
        setMyStats(stats);
        setHasLoadedLobbyDataOnce(true);
      } catch (e) {
        if (!background) {
          setError(e instanceof Error ? e.message : "Failed to load lobbies.");
        }
      } finally {
        if (!background) {
          setMyGamesLoading(false);
        }
      }
    },
    [getApiAccessToken, isAuthenticated],
  );

  const scheduleBackgroundLobbyRefresh = useCallback(() => {
    if (lobbyWsRefreshTimerRef.current != null) {
      window.clearTimeout(lobbyWsRefreshTimerRef.current);
    }
    lobbyWsRefreshTimerRef.current = window.setTimeout(() => {
      lobbyWsRefreshTimerRef.current = null;
      void loadLobbyData({ background: true });
    }, LOBBY_WS_REFRESH_DEBOUNCE_MS);
  }, [loadLobbyData]);

  const myGamesAllRows = useMemo(() => {
    if (!myGames) return [];
    return [...myGames.open_lobby, ...myGames.in_progress, ...myGames.completed].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
  }, [myGames]);

  const myGamesTotalCount = myGamesAllRows.length;

  const myGamesTotalPages = Math.max(1, Math.ceil(myGamesTotalCount / MY_GAMES_PAGE_SIZE));

  const myGamesSafePage = Math.min(myGamesPage, myGamesTotalPages - 1);

  const myGamesPageRows = useMemo(() => {
    const start = myGamesSafePage * MY_GAMES_PAGE_SIZE;
    return myGamesAllRows.slice(start, start + MY_GAMES_PAGE_SIZE);
  }, [myGamesAllRows, myGamesSafePage]);

  const resumeTargets = useMemo(() => {
    if (!myGames) return [];
    return myGames.in_progress
      .filter((row) => row.status === "active")
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map((row) => {
        const scoreLabel =
          row.my_score != null && row.opponent_score != null
            ? `${row.my_score}–${row.opponent_score}`
            : null;
        return {
          id: row.id,
          opponentLabel: myGameOpponentLabel(row),
          scoreLabel,
        };
      });
  }, [myGames]);

  const showStatsRecord = hasNonZeroEstatesStats(myStats);

  useEffect(() => {
    setMyGamesPage((p) => Math.min(p, Math.max(0, myGamesTotalPages - 1)));
  }, [myGamesTotalCount, myGamesTotalPages]);

  useEffect(() => {
    void loadLobbyData();
  }, [loadLobbyData]);

  /** When the host starts, move the guest from the lobby card into the play route. */
  useEffect(() => {
    const game = myGame;
    if (!game || !isUserInGame(game, myUserId)) {
      prevMyGameStatusRef.current = null;
      return;
    }
    const prev = prevMyGameStatusRef.current;
    const status = game.status;
    if (status === "active" && prev === "lobby") {
      navigate(`/estates/play/${game.id}`, { replace: true });
    }
    prevMyGameStatusRef.current = status;
  }, [myGame, myUserId, navigate]);

  useEffect(() => {
    return connectEstatesWebSocket({
      getUrl: async () => {
        const token = await getApiAccessToken();
        return estatesLobbiesWsUrl(token);
      },
      onMessage: (msg) => {
        // Initial fetch runs on mount; WS reconnect "connected" must not flash the UI.
        if (msg.type === "lobbies_update") {
          scheduleBackgroundLobbyRefresh();
        }
      },
    });
  }, [getApiAccessToken, scheduleBackgroundLobbyRefresh]);

  useEffect(() => {
    return () => {
      if (lobbyWsRefreshTimerRef.current != null) {
        window.clearTimeout(lobbyWsRefreshTimerRef.current);
      }
    };
  }, []);

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

  const onPlayVsComputer = async () => {
    setBusyAction("solo");
    setError(null);
    try {
      const token = await getApiAccessToken();
      const game = await createSoloEstatesGame(token, soloDifficulty);
      setMyGame(game);
      await loadLobbyData();
      navigate(`/estates/play/${game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start solo game.");
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
  const myActiveGame =
    myGame && myGame.status === "active" && isUserInGame(myGame, myUserId) ? myGame : null;
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
          (() => {
            const myName = sessionUser?.profile.display_name?.trim();
            const winnerName = row.winner_display_name?.trim();
            if (!winnerName) {
              return (
                <Badge
                  bg="bg.subtle"
                  color="fg.muted"
                  borderWidth="1px"
                  borderColor="border"
                  flexShrink={0}
                  fontWeight="semibold"
                >
                  Completed
                </Badge>
              );
            }
            const didWin = Boolean(myName && winnerName === myName);
            return (
              <Badge
                bg={didWin ? "lilypad.subtle" : "nautical.subtle"}
                color={didWin ? "lilypad.fg" : "nautical.fg"}
                borderWidth="1px"
                borderColor={didWin ? "lilypad.border" : "nautical.border"}
                flexShrink={0}
                fontWeight="semibold"
              >
                {didWin ? "WIN" : "LOSS"}
              </Badge>
            );
          })()
        ) : null}
        <HStack gap="2" flexShrink={0} flexWrap="wrap">
          {showOpenLobby ? (
            <PondButton
              type="button"
              size="sm"
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

  const myGamesPagination =
    myGamesTotalCount > MY_GAMES_PAGE_SIZE ? (
      <Box
        bg="bg.subtle"
        borderWidth="1px"
        borderColor="border"
        borderRadius="md"
        p="3"
      >
        <Stack gap="2">
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Showing {myGamesSafePage * MY_GAMES_PAGE_SIZE + 1}–
            {Math.min((myGamesSafePage + 1) * MY_GAMES_PAGE_SIZE, myGamesTotalCount)} of{" "}
            {myGamesTotalCount}
          </Text>
          <HStack gap="3" flexWrap="wrap" align="center">
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="sky"
              onClick={() => setMyGamesPage(myGamesSafePage - 1)}
              disabled={myGamesSafePage === 0}
            >
              Previous
            </PondButton>
            <Text fontSize={APP_TEXT_SIZES.helper}>
              Page {myGamesSafePage + 1} of {myGamesTotalPages}
            </Text>
            <PondButton
              type="button"
              size="sm"
              variant="outline"
              colorPalette="sky"
              onClick={() => setMyGamesPage(myGamesSafePage + 1)}
              disabled={myGamesSafePage >= myGamesTotalPages - 1}
            >
              Next
            </PondButton>
          </HStack>
        </Stack>
      </Box>
    ) : null;

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
            <HStack as="span" display="inline-flex" gap="2" alignItems="center">
              <Text as="span" aria-hidden="true">
                🏰
              </Text>
              <Text as="span">Estates</Text>
            </HStack>
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall">
            Estates is a custom card game designed and developed by Jack! It's a head-to-head card-placing duel. Start a solo game against the computer, or create an open lobby and invite a friend to face you!
          </Text>
          <EstatesResumeBanners
            targets={resumeTargets}
            loading={myGamesLoading && !hasLoadedLobbyDataOnce}
          />
        </Box>

        <Tabs.Root
          value={landingTab}
          lazyMount
          unmountOnExit
          variant="plain"
          onValueChange={(details) => {
            const next = details.value;
            if (next === "play" || next === "help") {
              setLandingTab(next);
            }
          }}
        >
          <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
            <Tabs.Trigger value="play" {...APP_SHELL_TAB_TRIGGER_PROPS}>
              Play
            </Tabs.Trigger>
            <Tabs.Trigger value="help" {...APP_SHELL_TAB_TRIGGER_PROPS}>
              How to Play
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="play" pt="2">
            <Stack gap={{ base: "3", md: "3" }}>
        <PanelMessageSlot error={error} />

        {myActiveGame ? (
          <Box {...ESTATES_LOBBY_CARD_PROPS}>
            <Stack gap="3" align="stretch" textAlign="center">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label}>
                Your match has started
              </Text>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
                {myUserId === myActiveGame.player_1_id
                  ? "Head to the board to play your cards."
                  : `${myActiveGame.player_1.display_name} started the game. Join the board when you are ready.`}
              </Text>
              <PondButton
                colorPalette="lilypad"
                onClick={() => navigate(`/estates/play/${myActiveGame.id}`)}
              >
                Begin game
              </PondButton>
            </Stack>
          </Box>
        ) : openLobbyGame ? (
          <Box {...ESTATES_LOBBY_CARD_PROPS}>
            <Stack gap="3" align="stretch">
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label}>
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
                      bg="white"
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
              <HStack gap="2" flexWrap="wrap" justify="center">
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
                    colorPalette="lilypad"
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
                  colorPalette="lilypad"
                  onClick={() => void onCancelLobby(openLobbyGame.id)}
                  loading={busyAction === `cancel-${openLobbyGame.id}`}
                >
                  Cancel lobby
                </PondButton>
              ) : null}
              </HStack>
            </Stack>
          </Box>
        ) : (
          <>
          {openLobbies != null && openLobbies.length > 0 ? (
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label} mb="3">
                Open Lobbies
              </Text>
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
            </Box>
          ) : null}
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" alignItems="stretch">
            <Box {...ESTATES_COMPUTER_CARD_PROPS}>
              <Stack align="center" textAlign="center" gap="3" w="full">
                <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label}>
                  Play vs Computer
                </Text>
                <HStack
                  gap="4"
                  flexWrap="wrap"
                  justify="center"
                  role="radiogroup"
                  aria-label="Computer difficulty"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        cursor: busyAction === "solo" ? "not-allowed" : "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="estates-solo-difficulty"
                        value={opt.value}
                        checked={soloDifficulty === opt.value}
                        disabled={busyAction === "solo"}
                        onChange={() => setSoloDifficulty(opt.value)}
                      />
                      <Text fontSize={APP_TEXT_SIZES.body}>{opt.label}</Text>
                    </label>
                  ))}
                </HStack>
                <PondButton
                  colorPalette="sky"
                  onClick={() => void onPlayVsComputer()}
                  loading={busyAction === "solo"}
                >
                  Play vs Computer
                </PondButton>
              </Stack>
            </Box>
            <Box {...ESTATES_LOBBY_CARD_PROPS}>
              <Stack align="center" textAlign="center" gap="3" w="full">
                <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.label}>
                  Play vs. Friend
                </Text>
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall" maxW="20rem">
                  Host a lobby and invite a friend to join.
                </Text>
                <PondButton
                  colorPalette="lilypad"
                  onClick={() => void onCreateLobby()}
                  loading={busyAction === "create"}
                >
                  New Game Lobby
                </PondButton>
              </Stack>
            </Box>
          </SimpleGrid>
          </>
        )}

        {myGamesTotalCount >= 1 && myGames ? (
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
                  <Stack gap="0" align="stretch">
                    {myGamesPageRows.map((row) => renderMyGameRow(row))}
                  </Stack>
                  {myGamesPagination}
                </Stack>
              </Collapsible.Content>
            </Collapsible.Root>
          </Box>
        ) : null}

        {showStatsRecord && myStats ? (
          <Collapsible.Root open={statsOpen} onOpenChange={(e) => setStatsOpen(e.open)}>
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Collapsible.Trigger asChild>
                <PondButton
                  type="button"
                  variant="ghost"
                  colorPalette="sky"
                  w="full"
                  justifyContent="space-between"
                  px="0"
                  h="auto"
                  minH="0"
                  fontWeight="semibold"
                  fontSize={APP_TEXT_SIZES.label}
                >
                  <Text as="span">Your Stats</Text>
                  <Text as="span" aria-hidden="true">
                    {statsOpen ? "▾" : "▸"}
                  </Text>
                </PondButton>
              </Collapsible.Trigger>
              <Collapsible.Content>
                <Stack gap="3" pt="3">
                  <Stack gap="2">
                    {MATCH_STAT_ROWS.map((row) => {
                      const current = myStats[row.statKey];
                      const target = myStats.achievement_thresholds[row.thresholdKey];
                      return (
                        <HStack key={row.slug} justify="space-between" gap="3">
                          <HStack gap="2" minW="0">
                            <Text aria-hidden="true">{emojiForAchievementSlug(row.slug)}</Text>
                            <Text fontSize={APP_TEXT_SIZES.body}>{row.label}</Text>
                          </HStack>
                          <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium" flexShrink={0}>
                            {formatStatProgress(current, target)}
                          </Text>
                        </HStack>
                      );
                    })}
                  </Stack>
                  <Stack gap="2">
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="semibold">
                      Zone wins
                    </Text>
                    {ZONE_STAT_ROWS.map((row) => {
                      const current = myStats.zone_wins[row.zoneKey];
                      const target = myStats.achievement_thresholds.zone_badges;
                      return (
                        <HStack key={row.slug} justify="space-between" gap="3">
                          <HStack gap="2" minW="0">
                            <Text aria-hidden="true">{emojiForAchievementSlug(row.slug)}</Text>
                            <Text fontSize={APP_TEXT_SIZES.body}>{row.label}</Text>
                          </HStack>
                          <Text fontSize={APP_TEXT_SIZES.body} fontWeight="medium" flexShrink={0}>
                            {formatStatProgress(current, target)}
                          </Text>
                        </HStack>
                      );
                    })}
                  </Stack>
                </Stack>
              </Collapsible.Content>
            </Box>
          </Collapsible.Root>
        ) : null}
            </Stack>
          </Tabs.Content>

          <Tabs.Content value="help" p={{ base: "2", md: "2" }} pt="3">
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <EstatesHowToPlayPanel />
            </Box>
          </Tabs.Content>
        </Tabs.Root>

      </Stack>
    </PanelPageShell>
  );
}

