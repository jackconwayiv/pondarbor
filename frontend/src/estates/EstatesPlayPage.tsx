import { Box, Flex, Grid, HStack, IconButton, Spinner, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FaQuestionCircle } from "react-icons/fa";
import { Navigate, useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { AppModal } from "../components/AppModal";
import { SessionLoadingCard } from "../components/panelStatus";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  chooseEstatesEffectTarget,
  concedeEstatesGame,
  fetchMyEstatesGame,
  placeEstatesCard,
  reorderEstatesHand,
  type EstatesGameState,
} from "./api";
import { ESTATES_HOW_TO_PLAY_BODY, ESTATES_HOW_TO_PLAY_TITLE } from "./estatesHowToPlay";
import { ESTATES_GAME_FONT_FAMILY, ESTATES_PLAY_CANVAS_BG } from "./estatesPlayTheme";
import { personalizeEstatesStatusMessage } from "./estatesStatusMessage";
import { estatesGameWsUrl } from "./estatesWs";
import EstatesPlayView from "./EstatesPlayView";
import {
  mergeOptimisticPlacement,
  serverHasPendingPlacement,
  type PendingPlacement,
} from "./optimisticPlacement";
import { ScoringStepHourglassTimer } from "./ScoringStepHourglassTimer";

/** Override theme heading font (Caprasimo) so status bar uses Spinnaker. */
const estatesGameFont = { fontFamily: ESTATES_GAME_FONT_FAMILY } as const;

/** Single text size for the in-game status header (matches default “waiting for…” line). */
const headerTextSize = APP_TEXT_SIZES.body;

function seatForUser(game: EstatesGameState, userId: number): number | null {
  if (game.player_1_id === userId) return 1;
  if (game.player_2_id === userId) return 2;
  return null;
}

function placedCardEntry(value: unknown): { card: Record<string, unknown>; confirmed: boolean } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { card?: unknown; confirmed?: unknown };
  if (!row.card || typeof row.card !== "object") return null;
  return { card: row.card as Record<string, unknown>, confirmed: Boolean(row.confirmed) };
}

export default function EstatesPlayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    error: sessionError,
    refreshSession,
  } = useAppSession();

  const [game, setGame] = useState<EstatesGameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingPlacement, setPendingPlacement] = useState<PendingPlacement | null>(null);
  const [confirmConcede, setConfirmConcede] = useState(false);
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const confirmConcedeButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingPlacementRef = useRef<PendingPlacement | null>(null);
  const isMobile = useIsMobile();

  const myUserId = sessionUser?.user.id;
  const playCanvasProps = { bg: ESTATES_PLAY_CANVAS_BG } as const;

  const setPending = useCallback((placement: PendingPlacement | null) => {
    pendingPlacementRef.current = placement;
    setPendingPlacement(placement);
  }, []);

  const applyFetchedGame = useCallback(
    (mine: EstatesGameState) => {
      const seat = myUserId != null ? seatForUser(mine, myUserId) : null;
      const pending = pendingPlacementRef.current;
      if (pending && seat != null) {
        if (serverHasPendingPlacement(mine, seat, pending)) {
          setPending(null);
          setGame(mine);
          return;
        }
        setGame(mergeOptimisticPlacement(mine, seat, pending));
        return;
      }
      setGame(mine);
    },
    [myUserId, setPending],
  );

  const loadGame = useCallback(async () => {
    if (!isAuthenticated || !gameId) return;
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      const mine = await fetchMyEstatesGame(token);
      if (!mine || mine.id !== gameId) {
        setPending(null);
        setGame(null);
        setLoadError("Game not found or you are not a player in this match.");
        return;
      }
      // Lobby state should not show the play board — bounce back to /estates.
      // Completed games stay on this page so the player can inspect the final board.
      if (mine.status === "lobby") {
        navigate("/estates", { replace: true });
        return;
      }
      applyFetchedGame(mine);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load game.");
    }
  }, [applyFetchedGame, gameId, getApiAccessToken, isAuthenticated, navigate, setPending]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!gameId || !isAuthenticated) return;
    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;

    const connect = async () => {
      try {
        const token = await getApiAccessToken();
        if (cancelled) return;
        socket = new WebSocket(estatesGameWsUrl(gameId, token));
        socket.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as { type?: string };
            if (msg.type === "game_update" || msg.type === "connected") {
              void loadGame();
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
  }, [gameId, getApiAccessToken, isAuthenticated, loadGame]);

  useEffect(() => {
    if (!game || game.round_state?.phase !== "scoring") return;
    const id = window.setInterval(() => {
      void loadGame();
    }, 2000);
    return () => window.clearInterval(id);
  }, [game, loadGame]);

  const mySeat = useMemo(() => {
    if (!game || !myUserId) return null;
    if (game.player_1_id === myUserId) return 1;
    if (game.player_2_id === myUserId) return 2;
    return null;
  }, [game, myUserId]);

  const displayGame = useMemo(() => {
    if (!game || !mySeat) return game;
    return mergeOptimisticPlacement(game, mySeat, pendingPlacement);
  }, [game, mySeat, pendingPlacement]);

  const myPlayerState = useMemo(() => {
    if (!displayGame || !mySeat) return null;
    return displayGame.players.find((p) => p.seat_index === mySeat) ?? null;
  }, [displayGame, mySeat]);

  const opponentPlayerState = useMemo(() => {
    if (!displayGame || !mySeat) return null;
    return displayGame.players.find((p) => p.seat_index !== mySeat) ?? null;
  }, [displayGame, mySeat]);

  const scoringAwaitingChoice = useMemo(() => {
    if (!game) return null;
    const pending = (game.round_state?.pending_payload ?? {}) as Record<string, unknown>;
    const scoring = (pending.scoring ?? {}) as Record<string, unknown>;
    return (scoring.awaiting_choice ?? null) as Record<string, unknown> | null;
  }, [game]);

  const isMyScoringChoice = Boolean(
    scoringAwaitingChoice && mySeat && Number(scoringAwaitingChoice.actor_seat || 0) === mySeat,
  );

  const scoringTargets = useMemo<Array<{ zone?: string; cardId: string; modifierLabel: string }>>(() => {
    if (!game || !scoringAwaitingChoice) return [];
    const effectType = String(scoringAwaitingChoice.type || "");
    if (effectType === "farm_upgrade" || effectType === "road_upgrade") {
      return (myPlayerState?.hand ?? []).map((card) => ({
        cardId: String(card.card_id || ""),
        modifierLabel: "+1",
      }));
    }
    if (effectType === "gate_debuff") {
      const sourceZone = String(scoringAwaitingChoice.source_zone || "");
      const targetSeat = String(mySeat === 1 ? 2 : 1);
      const modifierLabel = "-1";
      const placements = game.round_state?.placements_by_zone ?? {};
      const excludedZones = new Set<string>([sourceZone]);
      const out: Array<{ zone?: string; cardId: string; modifierLabel: string }> = [];
      for (const [zoneName, zonePayload] of Object.entries(placements)) {
        if (excludedZones.has(zoneName)) continue;
        if (!zonePayload || typeof zonePayload !== "object") continue;
        const seatPayload = (zonePayload as Record<string, unknown>)[targetSeat];
        const placed = placedCardEntry(seatPayload);
        if (!placed) continue;
        out.push({
          zone: zoneName,
          cardId: String(placed.card.card_id || ""),
          modifierLabel,
        });
      }
      return out;
    }
    return [];
  }, [game, myPlayerState?.hand, mySeat, scoringAwaitingChoice]);

  const scoringZoneCardOwner = useMemo<"mine" | "opponent" | null>(() => {
    if (!isMyScoringChoice || !scoringAwaitingChoice) return null;
    const effectType = String(scoringAwaitingChoice.type || "");
    if (effectType === "gate_debuff") return "opponent";
    return null;
  }, [isMyScoringChoice, scoringAwaitingChoice]);

  const myScoringChoiceMessage = useMemo(() => {
    if (!isMyScoringChoice || !scoringAwaitingChoice) return "";
    const effectType = String(scoringAwaitingChoice.type || "");
    const zone = String(scoringAwaitingChoice.source_zone || "");
    const zoneLabel = zone ? `${zone.charAt(0).toUpperCase()}${zone.slice(1)}` : "Zone";
    if (effectType === "gate_debuff") {
      return `You won the ${zoneLabel}! Choose a card to apply -1.`;
    }
    if (effectType === "farm_upgrade" || effectType === "road_upgrade") {
      return `You won the ${zoneLabel}! Choose a hand card to permanently gain +1.`;
    }
    if (effectType === "tower_start_choice") {
      return "Go first or second next round?";
    }
    return "Choose a scoring target.";
  }, [isMyScoringChoice, scoringAwaitingChoice]);

  const isPaused = Boolean(game?.round_state?.is_paused);
  const isMyTurn = Boolean(
    game &&
      !isPaused &&
      game.round_state?.phase === "placement" &&
      game.round_state.pending_actor_seat === mySeat,
  );
  const scoringPayload = (game?.round_state?.pending_payload?.scoring ?? null) as Record<
    string,
    unknown
  > | null;
  const scoringWaitUntilMs = useMemo(() => {
    const raw = scoringPayload?.waiting_until_ms;
    if (raw == null) return null;
    const ms = Number(raw);
    return Number.isFinite(ms) ? ms : null;
  }, [scoringPayload?.waiting_until_ms]);
  const isScoringProcessing = Boolean(
    game?.round_state?.phase === "scoring" &&
      !scoringPayload?.awaiting_choice &&
      scoringWaitUntilMs != null,
  );
  const myScore = myPlayerState?.score ?? 0;
  const opponentScore = opponentPlayerState?.score ?? 0;
  const statusMessage = useMemo(() => {
    const raw = game?.round_state?.status_message || "";
    return personalizeEstatesStatusMessage(raw, myPlayerState?.display_name);
  }, [game?.round_state?.status_message, myPlayerState?.display_name]);
  const completionMessage = useMemo(() => {
    if (!game || game.status !== "completed") return null;
    const opponentName = opponentPlayerState?.display_name || "Opponent";
    const byConcession = game.completion_outcome === "concession";
    const conceder = game.conceded_by_user_id;
    const iWon = game.winner_user_id != null && myUserId === game.winner_user_id;
    const opponentWon =
      game.winner_user_id != null && opponentPlayerState?.user_id === game.winner_user_id;
    let headline: string;
    if (iWon) {
      headline = byConcession ? "You win — by concession." : "You win the game!";
    } else if (opponentWon) {
      headline = byConcession && conceder === myUserId
        ? "You conceded. Game over."
        : `${opponentName} won the game.`;
    } else {
      headline = "Game complete.";
    }
    return headline;
  }, [game, myUserId, opponentPlayerState?.display_name, opponentPlayerState?.user_id]);

  useEffect(() => {
    if (!confirmConcede) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (confirmConcedeButtonRef.current?.contains(target)) return;
      setConfirmConcede(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [confirmConcede]);

  const isCompleted = game?.status === "completed";

  const onConcede = async () => {
    if (!game) return;
    setBusyAction("concede");
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      await concedeEstatesGame(token, game.id);
      setConfirmConcede(false);
      navigate("/estates", { replace: true });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not concede game.");
    } finally {
      setBusyAction(null);
    }
  };

  const onReorderHand = useCallback(
    async (cardIds: string[]) => {
      if (!game || cardIds.length === 0) return;
      setBusyAction("reorder-hand");
      setLoadError(null);
      try {
        const token = await getApiAccessToken();
        const updated = await reorderEstatesHand(token, game.id, cardIds);
        setGame(updated);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not reorder hand.");
      } finally {
        setBusyAction(null);
      }
    },
    [game, getApiAccessToken],
  );

  const onPlaceCard = useCallback(
    async (zone: string, cardId: string) => {
      if (!game || !mySeat) return;
      const player = game.players.find((p) => p.seat_index === mySeat);
      const card = (player?.hand ?? []).find((c) => String(c.card_id || "") === cardId);
      if (!card) return;

      const placement: PendingPlacement = {
        zone,
        cardId,
        card: card as Record<string, unknown>,
      };
      setPending(placement);
      setBusyAction(`place-${cardId}`);
      setLoadError(null);
      try {
        const token = await getApiAccessToken();
        const updated = await placeEstatesCard(token, game.id, { card_id: cardId, zone });
        setPending(null);
        setGame(updated);
      } catch (e) {
        setPending(null);
        setLoadError(e instanceof Error ? e.message : "Could not place card.");
      } finally {
        setBusyAction(null);
      }
    },
    [game, getApiAccessToken, mySeat, setPending],
  );

  const onApplyScoringTarget = async (cardId: string, zone: string) => {
    if (!game || !scoringAwaitingChoice || !cardId) return;
    setBusyAction("choose-target");
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      const effectType = String(scoringAwaitingChoice.type || "");
      const payload =
        effectType === "farm_upgrade" || effectType === "road_upgrade"
          ? { target_card_id: cardId }
          : { target_zone: zone, target_card_id: cardId };
      const updated = await chooseEstatesEffectTarget(token, game.id, payload);
      setGame(updated);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not apply scoring choice.");
    } finally {
      setBusyAction(null);
    }
  };

  const onTowerStartChoice = async (goFirst: boolean) => {
    if (!game || !scoringAwaitingChoice) return;
    setBusyAction("choose-target");
    setLoadError(null);
    try {
      const token = await getApiAccessToken();
      const updated = await chooseEstatesEffectTarget(token, game.id, { go_first: goFirst });
      setGame(updated);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not apply scoring choice.");
    } finally {
      setBusyAction(null);
    }
  };

  const scoringEffectType = String(scoringAwaitingChoice?.type || "");
  const isTowerStartChoice =
    isMyScoringChoice && scoringEffectType === "tower_start_choice";

  if (isLoading) {
    return (
      <Stack flex="1" minH={{ base: "min(100dvh, 100%)", md: "full" }} {...playCanvasProps} align="center" justify="center">
        <SessionLoadingCard />
      </Stack>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!sessionUser) {
    return (
      <Stack flex="1" minH={{ base: "min(100dvh, 100%)", md: "full" }} {...playCanvasProps} p="4" align="center" justify="center">
        <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="md" p="4" maxW="md">
          <Text fontWeight="semibold" mb="2">
            Reconnecting your API session…
          </Text>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" mb="3">
            {sessionError || "You are authenticated, but the API session is not ready yet."}
          </Text>
          <PondButton colorPalette="sky" onClick={() => void refreshSession()}>
            Retry session sync
          </PondButton>
        </Box>
      </Stack>
    );
  }

  if (!gameId) {
    return <Navigate to="/estates" replace />;
  }

  if (!game && !loadError) {
    return (
      <Stack flex="1" minH={{ base: "min(100dvh, 100%)", md: "full" }} {...playCanvasProps} align="center" justify="center">
        <Spinner size="lg" colorPalette="lilypad" />
      </Stack>
    );
  }

  if (!game) {
    return (
      <Stack flex="1" minH={{ base: "min(100dvh, 100%)", md: "full" }} {...playCanvasProps} p="4" align="center" justify="center">
        <Box bg="bg" borderWidth="1px" borderColor="border" borderRadius="md" p="4" maxW="md">
          <Text color="nautical.solid" fontWeight="medium" mb="3">
            {loadError || "Unable to open this game."}
          </Text>
          <PondButton colorPalette="sky" onClick={() => navigate("/estates")}>
            Back to Estates
          </PondButton>
        </Box>
      </Stack>
    );
  }

  if (!mySeat || !myPlayerState) {
    return <Navigate to="/estates" replace />;
  }

  const concedeButton: ReactNode = (
    <PondButton
      ref={confirmConcedeButtonRef}
      size="sm"
      flexShrink={0}
      colorPalette="nautical"
      variant={confirmConcede ? "solid" : "outline"}
      bg={isMobile && !confirmConcede ? "white" : undefined}
      borderWidth={isMobile && !confirmConcede ? "1px" : undefined}
      borderColor={isMobile && !confirmConcede ? "nautical.border" : undefined}
      color={isMobile && !confirmConcede ? "nautical.fg" : undefined}
      _hover={
        isMobile && !confirmConcede
          ? { bg: "gray.50", borderColor: "nautical.border", color: "nautical.fg" }
          : undefined
      }
      loading={busyAction === "concede"}
      disabled={busyAction === "concede"}
      onClick={(e) => {
        e.stopPropagation();
        if (!confirmConcede) {
          setConfirmConcede(true);
          return;
        }
        void onConcede();
      }}
    >
      {confirmConcede ? "Confirm Concede" : "Concede Game"}
    </PondButton>
  );

  const lobbyButton: ReactNode = (
    <PondButton
      size="sm"
      flexShrink={0}
      colorPalette="lilypad"
      onClick={() => navigate("/estates")}
    >
      Lobby
    </PondButton>
  );

  const trailingControl = (
    <HStack gap="2" justify="flex-end" w="auto" flexShrink={0}>
      {isCompleted ? lobbyButton : concedeButton}
    </HStack>
  );

  const towerStartChoiceButtons = (
    <HStack gap="2" flexShrink={0} flexWrap="nowrap">
      <PondButton
        size="xs"
        variant="outline"
        colorPalette="lilypad"
        minH="7"
        h="auto"
        py="1"
        px="3"
        whiteSpace="nowrap"
        loading={busyAction === "choose-target"}
        disabled={busyAction === "choose-target"}
        onClick={() => void onTowerStartChoice(true)}
      >
        First
      </PondButton>
      <PondButton
        size="xs"
        colorPalette="lilypad"
        minH="7"
        h="auto"
        py="1"
        px="3"
        whiteSpace="nowrap"
        loading={busyAction === "choose-target"}
        disabled={busyAction === "choose-target"}
        onClick={() => void onTowerStartChoice(false)}
      >
        Second
      </PondButton>
    </HStack>
  );

  return (
    <Stack
      flex="1"
      minH={0}
      h={{ base: "min(100dvh, 100%)", md: "calc(100dvh - 2.75rem)" }}
      maxH={{ base: "min(100dvh, 100%)", md: "calc(100dvh - 2.75rem)" }}
      gap="0"
      fontFamily={ESTATES_GAME_FONT_FAMILY}
      {...playCanvasProps}
      overflow="hidden"
    >
      <Grid
        templateColumns={{ base: "1fr auto", md: "1fr auto 1fr" }}
        alignItems="center"
        gap={{ base: "2", md: "3" }}
        px={{ base: "2", md: "3" }}
        py="1.5"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg"
        flexShrink={0}
        w="full"
        {...estatesGameFont}
      >
        <Text
          display={{ base: "none", md: "block" }}
          fontSize={headerTextSize}
          color="fg.muted"
          whiteSpace="nowrap"
          fontWeight="medium"
          justifySelf="start"
          {...estatesGameFont}
        >
          Round {game.round}
        </Text>

        <Stack
          gap="0.5"
          align={{ base: "flex-start", md: "center" }}
          justify="center"
          textAlign={{ base: "start", md: "center" }}
          minW={0}
          minH={game.status === "active" ? { base: "2.75rem", md: "2.5rem" } : undefined}
          px="1"
          w="full"
        >
          {isCompleted ? (
            <Text
              fontSize={headerTextSize}
              fontWeight="bold"
              color="fg"
              lineHeight="1.25"
              lineClamp={2}
              {...estatesGameFont}
            >
              {completionMessage}
            </Text>
          ) : isPaused ? (
            <>
              <Text
                fontWeight="semibold"
                color="nautical.solid"
                fontSize={headerTextSize}
                {...estatesGameFont}
              >
                Game paused
              </Text>
              <Text fontSize={headerTextSize} color="fg" lineClamp={2} {...estatesGameFont}>
                {statusMessage || "Waiting for a disconnected player to return to the game."}
              </Text>
            </>
          ) : isMyTurn ? (
            <Text fontSize={headerTextSize} fontWeight="bold" color="fg" lineHeight="1.25" {...estatesGameFont}>
              Your turn!
            </Text>
          ) : isMyScoringChoice && isTowerStartChoice ? (
            <Flex
              align="center"
              gap="2"
              w="full"
              minW={0}
              justify={{ base: "flex-start", md: "center" }}
            >
              <Text
                fontSize={headerTextSize}
                fontWeight="semibold"
                color="fg"
                flex="1"
                minW={0}
                lineClamp={2}
                lineHeight="1.25"
                textAlign={{ base: "start", md: "center" }}
                {...estatesGameFont}
              >
                {myScoringChoiceMessage}
              </Text>
              {towerStartChoiceButtons}
            </Flex>
          ) : isMyScoringChoice ? (
            <Text
              fontSize={headerTextSize}
              fontWeight="semibold"
              color="fg"
              lineClamp={3}
              lineHeight="1.25"
              textAlign={{ base: "start", md: "center" }}
              {...estatesGameFont}
            >
              {myScoringChoiceMessage}
            </Text>
          ) : (
            <Text fontSize={headerTextSize} color="fg" lineClamp={2} {...estatesGameFont}>
              {statusMessage || "Waiting for updates…"}
            </Text>
          )}
          {isScoringProcessing && scoringWaitUntilMs != null ? (
            <ScoringStepHourglassTimer
              waitingUntilMs={scoringWaitUntilMs}
              labelFontFamily={ESTATES_GAME_FONT_FAMILY}
            />
          ) : null}
        </Stack>

        <Stack gap="0" align="flex-end" justifySelf="end" flexShrink={0}>
          <Text
            display={{ base: "block", md: "none" }}
            fontSize={headerTextSize}
            color="fg.muted"
            whiteSpace="nowrap"
            fontWeight="medium"
            lineHeight="1.2"
            {...estatesGameFont}
          >
            Round {game.round}
          </Text>
          <HStack gap="2" align="center">
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label="How to play"
              title="How to play"
              color="fg.muted"
              _hover={{ color: "fg", bg: "bg.subtle" }}
              onClick={() => setHowToPlayOpen(true)}
            >
              <FaQuestionCircle size={16} />
            </IconButton>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="fg"
              letterSpacing="wide"
              whiteSpace="nowrap"
              {...estatesGameFont}
            >
              {myScore} - {opponentScore}
            </Text>
            {!isMobile ? trailingControl : null}
          </HStack>
        </Stack>
      </Grid>

      <AppModal
        open={howToPlayOpen}
        onOpenChange={setHowToPlayOpen}
        title={ESTATES_HOW_TO_PLAY_TITLE}
        size="lg"
        contentProps={{ fontFamily: ESTATES_GAME_FONT_FAMILY }}
        bodyProps={{ fontFamily: ESTATES_GAME_FONT_FAMILY }}
      >
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall" whiteSpace="pre-line">
          {ESTATES_HOW_TO_PLAY_BODY}
        </Text>
      </AppModal>

      {loadError ? (
        <Box px="3" py="2" bg="nautical.subtle" flexShrink={0}>
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium">
            {loadError}
          </Text>
        </Box>
      ) : null}

      <Box
        flex="1"
        minH={0}
        overflow="hidden"
        px={0}
        py={0}
        display="flex"
        flexDirection="column"
      >
        <EstatesPlayView
          activeGame={displayGame ?? game}
          mySeat={mySeat}
          myPlayerState={myPlayerState}
          opponentPlayerState={opponentPlayerState}
          onPlaceCard={onPlaceCard}
          onReorderHand={onReorderHand}
          isMyScoringChoice={isMyScoringChoice}
          scoringZoneCardOwner={scoringZoneCardOwner}
          scoringTargets={scoringTargets}
          onApplyScoringTarget={onApplyScoringTarget}
          busyAction={busyAction}
          placementPending={pendingPlacement != null}
          fillHeight={isMobile}
          mobileConcedeControl={isMobile ? trailingControl : null}
        />
      </Box>
    </Stack>
  );
}
