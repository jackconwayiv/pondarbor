import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Text } from "@chakra-ui/react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { AppModal } from "../components/AppModal";
import { useIsMobile } from "../responsive";
import { APP_TEXT_SIZES } from "../theme/typography";
import type { EstatesGameState, EstatesPlayerState } from "./api";
import {
  ZONE_NAMES as ZONE_ORDER,
  getZoneDropBlockReason,
  isZoneDropAllowed,
  placedCardEntry,
  resolveCardSuit,
  type ZoneName,
} from "./estatesDropRules";
import { Card, DraggableHandCard, DragPreviewCard } from "./play/Card";
import { HAND_RETURN_DROP_ID, PlayerBand } from "./play/PlayerBand";
import { PlayCanvas } from "./play/PlayCanvas";
import { RealmGrid } from "./play/RealmGrid";
import { Zone, parseZoneDropId } from "./play/Zone";

const HAND_CARD_DRAG_PREFIX = "hand-card:";

function handCardDragId(cardId: string): string {
  return `${HAND_CARD_DRAG_PREFIX}${cardId}`;
}

function parseHandCardDragId(id: string | number): string | null {
  const raw = String(id);
  if (!raw.startsWith(HAND_CARD_DRAG_PREFIX)) return null;
  return raw.slice(HAND_CARD_DRAG_PREFIX.length);
}

function scoringTargetKey(zone: string | undefined, cardId: string): string {
  return `${zone || "hand"}:${cardId}`;
}

type ActiveDragMeta = { cardId: string; suit: string };

function prioritizeZoneCollisionHits(
  hits: Array<{ id: string | number }>,
  drag: ActiveDragMeta | null,
  canDrop: (zone: ZoneName, cardId: string) => boolean,
): Array<{ id: string | number }> {
  if (!drag || hits.length === 0) return hits;
  const zoneHits = hits.filter((hit) => parseZoneDropId(hit.id));
  if (zoneHits.length === 0) return hits;
  const validZoneHits = zoneHits.filter((hit) => {
    const zone = parseZoneDropId(hit.id);
    return zone != null && canDrop(zone, drag.cardId);
  });
  if (validZoneHits.length === 0) return hits;
  const validIds = new Set(validZoneHits.map((hit) => hit.id));
  const rest = hits.filter((hit) => !validIds.has(hit.id));
  return [...validZoneHits, ...rest];
}

function createEstatesCollisionDetection(
  dragRef: RefObject<ActiveDragMeta | null>,
  canDropRef: RefObject<(zone: ZoneName, cardId: string) => boolean>,
): CollisionDetection {
  return (args) => {
    const drag = dragRef.current;
    const canDrop = canDropRef.current;

    const pointerHits = pointerWithin(args);
    const handReturnHit = pointerHits.find((hit) => hit.id === HAND_RETURN_DROP_ID);
    if (handReturnHit) return [handReturnHit];
    if (pointerHits.some((hit) => parseHandCardDragId(hit.id))) {
      const handReturnContainer = args.droppableContainers.find(
        (container) => container.id === HAND_RETURN_DROP_ID && !container.disabled,
      );
      if (handReturnContainer) {
        return [{ id: HAND_RETURN_DROP_ID }];
      }
    }
    if (pointerHits.length > 0) {
      return prioritizeZoneCollisionHits(pointerHits, drag, canDrop);
    }

    const rectHits = rectIntersection(args);
    const handReturnRect = rectHits.find((hit) => hit.id === HAND_RETURN_DROP_ID);
    if (handReturnRect) return [handReturnRect];
    if (rectHits.length > 0) {
      return prioritizeZoneCollisionHits(rectHits, drag, canDrop);
    }

    const centered = closestCenter(args);
    return prioritizeZoneCollisionHits(centered, drag, canDrop);
  };
}

function isHandReturnDrop(id: string | number | undefined): boolean {
  return id === HAND_RETURN_DROP_ID;
}

function firstValidDropZone(
  hits: Array<{ id: string | number }>,
  cardId: string,
  canDrop: (zone: ZoneName, cardId: string) => boolean,
): ZoneName | null {
  const seen = new Set<ZoneName>();
  for (const hit of hits) {
    const zone = parseZoneDropId(hit.id);
    if (!zone || seen.has(zone)) continue;
    seen.add(zone);
    if (canDrop(zone, cardId)) return zone;
  }
  return null;
}

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function findReorderTargetCardId(
  event: DragEndEvent,
  draggedCardId: string,
): string | null {
  const overId = event.over?.id;
  const fromOver = overId != null ? parseHandCardDragId(overId) : null;
  if (fromOver && fromOver !== draggedCardId) return fromOver;
  for (const hit of event.collisions ?? []) {
    const candidate = parseHandCardDragId(hit.id);
    if (candidate && candidate !== draggedCardId) return candidate;
  }
  return null;
}

function resolvePlacementZone(
  event: DragEndEvent,
  cardId: string,
  canDrop: (zone: ZoneName, cardId: string) => boolean,
): ZoneName | null {
  const collisionHits = event.collisions ?? [];
  const fromCollisions = firstValidDropZone(collisionHits, cardId, canDrop);
  if (fromCollisions) return fromCollisions;

  if (event.over) {
    const overZone = parseZoneDropId(event.over.id);
    if (overZone && canDrop(overZone, cardId)) return overZone;
  }

  return null;
}

type DiscardModalState = {
  title: string;
  cards: Array<Record<string, unknown>>;
};

export type EstatesPlayViewProps = {
  activeGame: EstatesGameState;
  mySeat: number;
  myPlayerState: EstatesPlayerState;
  opponentPlayerState: EstatesPlayerState | null;
  onPlaceCard: (zone: string, cardId: string) => Promise<void>;
  onReorderHand: (cardIds: string[]) => Promise<void>;
  isMyScoringChoice: boolean;
  scoringZoneCardOwner: "mine" | "opponent" | null;
  scoringTargets: Array<{ zone?: string; cardId: string; modifierLabel: string }>;
  onApplyScoringTarget: (cardId: string, zone: string) => Promise<void>;
  busyAction: string | null;
  placementPending?: boolean;
  fillHeight?: boolean;
  mobileConcedeControl?: ReactNode;
};

export default function EstatesPlayView({
  activeGame,
  mySeat,
  myPlayerState,
  opponentPlayerState,
  onPlaceCard,
  onReorderHand,
  isMyScoringChoice,
  scoringZoneCardOwner,
  scoringTargets,
  onApplyScoringTarget,
  busyAction,
  placementPending = false,
  mobileConcedeControl = null,
}: EstatesPlayViewProps) {
  const [activeDrag, setActiveDrag] = useState<ActiveDragMeta | null>(null);
  const [dragPreviewSize, setDragPreviewSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [discardModal, setDiscardModal] = useState<DiscardModalState | null>(null);
  const activeDragRef = useRef<ActiveDragMeta | null>(null);
  const canDropInZoneRef = useRef<(zone: ZoneName, cardId: string) => boolean>(() => false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handCardMeta = useMemo(() => {
    const map = new Map<string, { suit: string; card: Record<string, unknown> }>();
    for (const card of myPlayerState.hand ?? []) {
      const cardId = String(card.card_id || "");
      if (!cardId) continue;
      const resolved = resolveCardSuit(card as Record<string, unknown>);
      map.set(cardId, {
        suit: resolved,
        card: card as Record<string, unknown>,
      });
    }
    return map;
  }, [myPlayerState.hand]);

  const isPaused = Boolean(activeGame.round_state?.is_paused);

  const isMyTurn =
    !isPaused &&
    activeGame.round_state?.phase === "placement" &&
    activeGame.round_state.pending_actor_seat === mySeat;

  const isOpponentTurn =
    !isPaused &&
    activeGame.round_state?.phase === "placement" &&
    activeGame.round_state.pending_actor_seat !== mySeat;

  const canReorderHand = Boolean(
    !isPaused &&
    activeGame.round_state?.phase === "placement" &&
    !isMyScoringChoice &&
    !placementPending,
  );

  const canDragHandCard = canReorderHand;

  const scoringTargetMap = useMemo(() => {
    const map = new Map<string, { zone?: string; cardId: string; modifierLabel: string }>();
    for (const target of scoringTargets) {
      map.set(scoringTargetKey(target.zone, target.cardId), target);
    }
    return map;
  }, [scoringTargets]);

  const scoringApplying = busyAction === "choose-target";

  const resolveScoringTarget = useCallback(
    (zone: string | undefined, cardId: string) => {
      if (!isMyScoringChoice || !cardId) return undefined;
      const entry = scoringTargetMap.get(scoringTargetKey(zone, cardId));
      if (!entry) return undefined;
      return {
        modifierLabel: entry.modifierLabel,
        onApply: () => void onApplyScoringTarget(cardId, entry.zone ?? ""),
        applying: scoringApplying,
      };
    },
    [isMyScoringChoice, onApplyScoringTarget, scoringApplying, scoringTargetMap],
  );

  const zoneWinners =
    ((activeGame.round_state?.pending_payload?.zone_winners as Record<
      string,
      { winning_seat: number | null }
    >) ||
      {});

  const placementsByZone = (activeGame.round_state?.placements_by_zone ?? {}) as Record<
    string,
    Record<string, unknown>
  >;

  const mySeatKey = String(mySeat);
  const iHavePlacedThisRound = useMemo(
    () =>
      ZONE_ORDER.some((zone) => {
        const zonePayload = placementsByZone[zone];
        return placedCardEntry(zonePayload?.[mySeatKey]) != null;
      }),
    [mySeatKey, placementsByZone],
  );

  const isMobile = useIsMobile();
  const usePortraitCanvasScale = isMobile;
  const myHandCards = myPlayerState.hand ?? [];
  const showHandSixGrid = isMobile && myHandCards.length === 6 && !iHavePlacedThisRound;

  const canDropInZone = useCallback(
    (zone: ZoneName, cardId: string): boolean => {
      const card = handCardMeta.get(cardId)?.card;
      return isZoneDropAllowed({
        zone,
        card,
        placementsByZone,
        mySeat,
        isMyTurn,
      });
    },
    [handCardMeta, isMyTurn, mySeat, placementsByZone],
  );

  const getDropBlockReason = useCallback(
    (zone: ZoneName, cardId: string) => {
      const card = handCardMeta.get(cardId)?.card;
      return getZoneDropBlockReason({
        zone,
        card,
        placementsByZone,
        mySeat,
        isMyTurn,
      });
    },
    [handCardMeta, isMyTurn, mySeat, placementsByZone],
  );

  canDropInZoneRef.current = canDropInZone;

  const collisionDetection = useMemo(
    () => createEstatesCollisionDetection(activeDragRef, canDropInZoneRef),
    [],
  );

  const activeDragCard = activeDrag ? handCardMeta.get(activeDrag.cardId)?.card ?? null : null;

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const cardId = parseHandCardDragId(event.active.id);
      if (!cardId) return;
      const meta = handCardMeta.get(cardId);
      if (!meta) return;
      const drag = { cardId, suit: meta.suit };
      activeDragRef.current = drag;
      setActiveDrag(drag);
      const rect = event.active.rect.current.initial ?? event.active.rect.current.translated;
      if (rect && rect.width > 0 && rect.height > 0) {
        setDragPreviewSize({ width: rect.width, height: rect.height });
      } else {
        setDragPreviewSize(null);
      }
    },
    [handCardMeta],
  );

  const clearActiveDrag = useCallback(() => {
    activeDragRef.current = null;
    setActiveDrag(null);
    setDragPreviewSize(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const cardId = parseHandCardDragId(event.active.id);
      clearActiveDrag();
      if (!cardId) return;

      const reorderTargetId = findReorderTargetCardId(event, cardId);
      if (reorderTargetId && canReorderHand) {
        const hand = myPlayerState.hand ?? [];
        const oldIndex = hand.findIndex((card) => String(card.card_id || "") === cardId);
        const newIndex = hand.findIndex((card) => String(card.card_id || "") === reorderTargetId);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const reordered = arrayMove(hand, oldIndex, newIndex);
          void onReorderHand(reordered.map((card) => String(card.card_id || "")));
        }
        return;
      }

      const overId = event.over?.id;
      const droppedOnHand =
        isHandReturnDrop(overId) ||
        (overId != null && parseHandCardDragId(overId) != null) ||
        (event.collisions ?? []).some(
          (hit) => isHandReturnDrop(hit.id) || parseHandCardDragId(hit.id) != null,
        );
      if (droppedOnHand) return;

      if (!isMyTurn) return;

      const meta = handCardMeta.get(cardId);
      if (!meta) return;
      const zone = resolvePlacementZone(event, cardId, canDropInZone);
      if (!zone) return;
      void onPlaceCard(zone, cardId);
    },
    [
      canDropInZone,
      canReorderHand,
      clearActiveDrag,
      handCardMeta,
      isMyTurn,
      myPlayerState.hand,
      onPlaceCard,
      onReorderHand,
    ],
  );

  const handleDragCancel = useCallback(() => {
    clearActiveDrag();
  }, [clearActiveDrag]);

  const openDiscardModal = useCallback((title: string, cards: Array<Record<string, unknown>>) => {
    setDiscardModal({ title, cards });
  }, []);

  const myHandChips = myHandCards.map((card) => {
    const cardId = String(card.card_id || "");
    return (
      <DraggableHandCard
        key={cardId}
        card={card as Record<string, unknown>}
        dragId={handCardDragId(cardId)}
        disabled={!canDragHandCard}
        scoringTarget={resolveScoringTarget(undefined, cardId)}
      />
    );
  });

  const opponentName = opponentPlayerState?.display_name || "Opponent";
  const opponentAvatar = opponentPlayerState?.avatar_url || undefined;
  const myName = myPlayerState.display_name || "You";

  const pauseMessage =
    activeGame.round_state?.status_message ||
    "Waiting for a disconnected player to return to the game.";

  return (
    <div className="estates-play-shell">
      <div className="estates-play-shell__canvas">
        <DndContext
          sensors={sensors}
          autoScroll
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <PlayCanvas>
            <div className="estates-opponent-band">
              <PlayerBand
                opponent
                active={isOpponentTurn}
                displayName={opponentName}
                avatarUrl={opponentAvatar}
                deckCount={opponentPlayerState?.deck.length ?? 0}
                deckDrawBonus={opponentPlayerState?.draw_bonus ?? 0}
                discardCount={opponentPlayerState?.discard.length ?? 0}
                onDiscardClick={() =>
                  openDiscardModal(
                    `${opponentName}'s spent cards`,
                    (opponentPlayerState?.discard ?? []) as Array<Record<string, unknown>>,
                  )
                }
              />
            </div>

            <div className="estates-realm-region">
              <RealmGrid>
                {ZONE_ORDER.map((zone) => {
                  const zonePayload = (activeGame.round_state?.placements_by_zone?.[zone] ?? {}) as Record<
                    string,
                    unknown
                  >;
                  const mySeatKey = String(mySeat);
                  const opponentSeatKey = String(mySeat === 1 ? 2 : 1);
                  const myPlaced = placedCardEntry(zonePayload[mySeatKey]);
                  const opponentPlaced = placedCardEntry(zonePayload[opponentSeatKey]);
                  const winnerRow = zoneWinners[zone] || null;
                  const winningSeat = winnerRow?.winning_seat ?? null;
                  const dragCardId = activeDrag?.cardId ?? "";
                  const dragCard = dragCardId ? handCardMeta.get(dragCardId)?.card : null;
                  const dragSuit = dragCard ? resolveCardSuit(dragCard) : "";
                  const dropValid = Boolean(activeDrag && canDropInZone(zone, activeDrag.cardId));
                  const dropInvalid = Boolean(activeDrag && dragCard && !dropValid);
                  const invalidReason =
                    activeDrag && dropInvalid
                      ? getDropBlockReason(zone, activeDrag.cardId)
                      : null;
                  const iWinZone = winningSeat === Number(mySeatKey);
                  const hasResolvedZoneWinner = winningSeat === 1 || winningSeat === 2;

                  const opponentScoringTarget =
                    scoringZoneCardOwner === "opponent" && opponentPlaced?.card
                      ? resolveScoringTarget(zone, String(opponentPlaced.card.card_id || ""))
                      : undefined;
                  const mineScoringTarget =
                    scoringZoneCardOwner === "mine" && myPlaced?.card
                      ? resolveScoringTarget(zone, String(myPlaced.card.card_id || ""))
                      : undefined;

                  /* Dim ineligible candidate cards in the relevant pool during a scoring choice. */
                  const opponentDimmed =
                    isMyScoringChoice && scoringZoneCardOwner === "opponent" && !opponentScoringTarget;
                  const mineDimmed =
                    isMyScoringChoice && scoringZoneCardOwner === "mine" && !mineScoringTarget;

                  const opponentSlot = opponentPlaced?.card ? (
                    <Card
                      card={opponentPlaced.card}
                      isWinner={winningSeat === Number(opponentSeatKey)}
                      zoneLoser={
                        hasResolvedZoneWinner && winningSeat !== Number(opponentSeatKey)
                      }
                      winnerAnchor="top"
                      scoringTarget={opponentScoringTarget}
                      dimmed={opponentDimmed}
                    />
                  ) : undefined;

                  const mineSlot = myPlaced?.card ? (
                    <Card
                      card={myPlaced.card}
                      isWinner={iWinZone}
                      zoneLoser={hasResolvedZoneWinner && !iWinZone}
                      winnerAnchor="bottom"
                      scoringTarget={mineScoringTarget}
                      dimmed={mineDimmed}
                    />
                  ) : undefined;

                  return (
                    <Zone
                      key={zone}
                      zone={zone}
                      isMyTurn={isMyTurn}
                      dropValid={dropValid}
                      dropInvalid={dropInvalid}
                      invalidReason={invalidReason}
                      dragSuit={dragSuit}
                      opponentSlot={opponentSlot}
                      mineSlot={mineSlot}
                      stackAbove={iWinZone}
                    />
                  );
                })}
              </RealmGrid>
            </div>

            <div className="estates-hand-band">
              <PlayerBand
                active={isMyTurn || isMyScoringChoice}
                displayName={myName}
                avatarUrl={undefined}
                deckCount={myPlayerState.deck.length}
                deckDrawBonus={myPlayerState.draw_bonus}
                discardCount={myPlayerState.discard.length}
                onDiscardClick={() =>
                  openDiscardModal(
                    "Your spent cards",
                    (myPlayerState.discard ?? []) as Array<Record<string, unknown>>,
                  )
                }
                enableHandReturn={isMyTurn && !isMyScoringChoice && !placementPending}
                dragActive={Boolean(activeDrag)}
                scrollableHand={!showHandSixGrid}
                handSixGrid={showHandSixGrid}
                center={myHandChips}
              />
            </div>
          </PlayCanvas>

          {isPaused ? (
            <div className="estates-pause-veil" role="status">
              <div className="estates-pause-veil__ribbon">
                <div className="estates-pause-veil__title">Game paused</div>
                <div>{pauseMessage}</div>
              </div>
            </div>
          ) : null}

          <DragOverlay dropAnimation={null} className="estates-drag-layer">
            {activeDragCard ? (
              <DragPreviewCard
                card={activeDragCard}
                width={usePortraitCanvasScale ? undefined : dragPreviewSize?.width}
                height={usePortraitCanvasScale ? undefined : dragPreviewSize?.height}
                portraitScale={usePortraitCanvasScale}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <AppModal
          open={discardModal != null}
          onOpenChange={(open) => {
            if (!open) setDiscardModal(null);
          }}
          title={discardModal?.title ?? "Spent"}
          size="lg"
        >
          {discardModal && discardModal.cards.length > 0 ? (
            <div className="estates-drag-layer estates-spent-modal">
              <div className="estates-spent-modal__cards">
                {discardModal.cards.map((card) => (
                  <Card key={String(card.card_id)} card={card} size="small" />
                ))}
              </div>
            </div>
          ) : (
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" py="2" textAlign="center">
              No cards in this spent pile yet.
            </Text>
          )}
        </AppModal>
      </div>

      {mobileConcedeControl ? (
        <div className="estates-play-shell__footer">{mobileConcedeControl}</div>
      ) : null}
    </div>
  );
}
