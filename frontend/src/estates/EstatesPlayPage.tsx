import { Box, Grid, Heading, HStack, Spinner, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, useNavigate, useParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { SessionLoadingCard } from "../components/panelStatus";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  chooseEstatesEffectTarget,
  concedeEstatesGame,
  fetchMyEstatesGame,
  placeEstatesCard,
  type EstatesGameState,
} from "./api";
import { ESTATES_PLAY_CANVAS_BG } from "./estatesPlayTheme";
import { estatesGameWsUrl } from "./estatesWs";
import EstatesPlayView from "./EstatesPlayView";
import {
  mergeOptimisticPlacement,
  serverHasPendingPlacement,
  type PendingPlacement,
} from "./optimisticPlacement";
import { ScoringStepHourglassTimer } from "./ScoringStepHourglassTimer";

function seatForUser(game: EstatesGameState, userId: number): number | null {
  if (game.player_1_id === userId) return 1;
  if (game.player_2_id === userId) return 2;
  return null;
}

const SCORING_ZONE_ORDER = ["gate", "farm", "road", "tower", "throne"] as const;

function priorScoredZones(sourceZone: string): ReadonlySet<string> {
  const idx = SCORING_ZONE_ORDER.indexOf(sourceZone as (typeof SCORING_ZONE_ORDER)[number]);
  if (idx <= 0) return new Set();
  return new Set(SCORING_ZONE_ORDER.slice(0, idx));
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
    if (effectType === "road_upgrade") {
      return (myPlayerState?.hand ?? []).map((card) => ({
        cardId: String(card.card_id || ""),
        modifierLabel: "+1",
      }));
    }
    if (effectType === "gate_debuff" || effectType === "farm_buff") {
      const sourceZone = String(scoringAwaitingChoice.source_zone || "");
      const targetSeat =
        effectType === "gate_debuff" ? String(mySeat === 1 ? 2 : 1) : String(mySeat);
      const modifierLabel = effectType === "gate_debuff" ? "-1" : "+2";
      const placements = game.round_state?.placements_by_zone ?? {};
      const excludedZones = new Set<string>([sourceZone]);
      if (effectType === "farm_buff") {
        for (const zone of priorScoredZones(sourceZone)) excludedZones.add(zone);
      }
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
    if (effectType === "farm_buff") return "mine";
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
    if (effectType === "farm_buff") {
      return `You won the ${zoneLabel}! Choose one of your other zone cards to apply +2.`;
    }
    if (effectType === "road_upgrade") {
      return `You won the ${zoneLabel}! Choose a hand card to permanently gain +1.`;
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
  const statusMessage = game?.round_state?.status_message || "";
  const mobileStatusCentered = (isMyTurn || isMyScoringChoice) && !isPaused;

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
        effectType === "road_upgrade"
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
      w={isMobile ? "full" : undefined}
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
      w={isMobile ? "full" : undefined}
      flexShrink={0}
      colorPalette="lilypad"
      onClick={() => navigate("/estates")}
    >
      Lobby
    </PondButton>
  );

  const trailingControl = isCompleted ? lobbyButton : concedeButton;

  return (
    <Stack
      flex="1"
      minH={0}
      h={{ base: "min(100dvh, 100%)", md: "100%" }}
      maxH="100%"
      gap="0"
      {...playCanvasProps}
      overflow="hidden"
    >
      <Grid
        templateColumns={{ base: "1fr auto", md: "1fr auto 1fr" }}
        alignItems="center"
        gap={{ base: "2", md: "3" }}
        px={{ base: "2", md: "3" }}
        py="2"
        borderBottomWidth="1px"
        borderColor="border"
        bg="bg"
        flexShrink={0}
        w="full"
      >
        <Text
          display={{ base: "none", md: "block" }}
          fontSize={APP_TEXT_SIZES.helper}
          color="fg.muted"
          whiteSpace="nowrap"
          fontWeight="medium"
          justifySelf="start"
        >
          Round {game.round}
        </Text>

        <Stack
          gap="0.5"
          align={{ base: mobileStatusCentered ? "center" : "flex-start", md: "center" }}
          justify="center"
          textAlign={{ base: mobileStatusCentered ? "center" : "start", md: "center" }}
          minW={0}
          minH={{ base: undefined, md: game.status === "active" ? "5.5rem" : undefined }}
          px="1"
          w="full"
        >
          {isCompleted ? (
            <Heading size="lg" color="lilypad.fg" lineHeight="1.1" lineClamp={2}>
              {completionMessage}
            </Heading>
          ) : isPaused ? (
            <>
              <Text fontWeight="semibold" color="nautical.solid" fontSize={APP_TEXT_SIZES.body}>
                Game paused
              </Text>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg" lineClamp={2}>
                {statusMessage || "Waiting for a disconnected player to return to the game."}
              </Text>
            </>
          ) : isMyTurn ? (
            <Heading size="lg" color="lilypad.fg" lineHeight="1.1">
              Your turn!
            </Heading>
          ) : isMyScoringChoice ? (
            <Heading size="lg" color="lilypad.fg" lineHeight="1.2" lineClamp={3}>
              {myScoringChoiceMessage}
            </Heading>
          ) : (
            <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineClamp={2}>
              {statusMessage || "Waiting for updates…"}
            </Text>
          )}
          {isScoringProcessing && scoringWaitUntilMs != null ? (
            <ScoringStepHourglassTimer waitingUntilMs={scoringWaitUntilMs} />
          ) : null}
        </Stack>

        <Stack gap="0" align="flex-end" justifySelf="end" flexShrink={0}>
          <Text
            display={{ base: "block", md: "none" }}
            fontSize={APP_TEXT_SIZES.helper}
            color="fg.muted"
            whiteSpace="nowrap"
            fontWeight="medium"
            lineHeight="1.2"
          >
            Round {game.round}
          </Text>
          <HStack gap="3" align="center">
            <Text fontSize="2xl" fontWeight="bold" color="fg" letterSpacing="wide" whiteSpace="nowrap">
              {myScore} - {opponentScore}
            </Text>
            {!isMobile ? trailingControl : null}
          </HStack>
        </Stack>
      </Grid>

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
