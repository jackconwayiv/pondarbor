import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Box } from "@chakra-ui/react";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import CombatHandCard from "./CombatHandCard";
import { getCardEnergyCost } from "./combatRules";
import {
  DEFEND_DROP_ZONE_ID,
  enemyDropId,
  handCardDragId,
  isDefendDropId,
  parseEnemyDropId,
  parseHandCardDragId,
} from "./combatDnDIds";
import type { CombatCard, EquippedGear } from "./shantiesTypes";
import {
  cardRequiresAmmo,
  isAttackCard,
  targetsEnemyManually,
  targetsSelfAutomatically,
} from "./shantiesTypes";
import "./squallsCombat.css";

type CombatBattleDndContextValue = {
  isPlayerTurn: boolean;
  viewingHand: boolean;
  energy: number;
  attackDragActive: boolean;
  defendDragActive: boolean;
};

const CombatBattleDndContext = createContext<CombatBattleDndContextValue>({
  isPlayerTurn: false,
  viewingHand: true,
  energy: 0,
  attackDragActive: false,
  defendDragActive: false,
});

function useCombatBattleDnd() {
  return useContext(CombatBattleDndContext);
}

type CombatBattleDndProps = {
  hand: CombatCard[];
  equipped: EquippedGear;
  isPlayerTurn: boolean;
  viewingHand: boolean;
  energy: number;
  heroAmmo: number;
  onPlayCard: (handIndex: number, enemyIndex?: number) => void;
  children: ReactNode;
};

export function CombatBattleDnd({
  hand,
  equipped,
  isPlayerTurn,
  viewingHand,
  energy,
  heroAmmo,
  onPlayCard,
  children,
}: CombatBattleDndProps) {
  const [activeHandIndex, setActiveHandIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeCard =
    activeHandIndex !== null ? (hand[activeHandIndex] ?? null) : null;
  const attackDragActive =
    activeCard !== null && targetsEnemyManually(activeCard);
  const defendDragActive =
    activeCard !== null && targetsSelfAutomatically(activeCard);

  const contextValue = useMemo(
    () => ({
      isPlayerTurn,
      viewingHand,
      energy,
      attackDragActive,
      defendDragActive,
    }),
    [attackDragActive, defendDragActive, energy, isPlayerTurn, viewingHand],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveHandIndex(parseHandCardDragId(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const handIndex = parseHandCardDragId(event.active.id);
    setActiveHandIndex(null);

    if (handIndex === null) return;
    const card = hand[handIndex];
    if (
      !card ||
      (!targetsEnemyManually(card) && !targetsSelfAutomatically(card))
    ) {
      return;
    }
    if (!isPlayerTurn || !viewingHand) return;
    if (energy < getCardEnergyCost(card)) return;
    if (cardRequiresAmmo(card) && heroAmmo < 1) return;

    if (targetsEnemyManually(card)) {
      if (!isAttackCard(card)) return;
      const enemyIndex = parseEnemyDropId(event.over?.id);
      if (enemyIndex === null) return;
      onPlayCard(handIndex, enemyIndex);
      return;
    }

    if (targetsSelfAutomatically(card) && isDefendDropId(event.over?.id)) {
      onPlayCard(handIndex);
    }
  };

  const handleDragCancel = () => {
    setActiveHandIndex(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <CombatBattleDndContext.Provider value={contextValue}>
        {children}
      </CombatBattleDndContext.Provider>
      <DragOverlay dropAnimation={null}>
        {activeCard && (attackDragActive || defendDragActive) ? (
          <Box w="5.5rem" aspectRatio="2.5/3.5" pointerEvents="none">
            <CombatHandCard
              card={activeCard}
              cost={getCardEnergyCost(activeCard)}
              equipped={equipped}
              layout="hand"
              fillSlot
              onClick={() => {}}
            />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

type DraggableHandCardSlotProps = {
  handIndex: number;
  card: CombatCard;
  cost: number;
  equipped: EquippedGear;
  heroAmmo: number;
  disabled: boolean;
};

export function DraggableCombatHandCard({
  handIndex,
  card,
  cost,
  equipped,
  heroAmmo,
  disabled,
}: DraggableHandCardSlotProps) {
  const { isPlayerTurn, viewingHand, energy } = useCombatBattleDnd();
  const lacksAmmo = cardRequiresAmmo(card) && heroAmmo < 1;
  const canDrag =
    (targetsEnemyManually(card) || targetsSelfAutomatically(card)) &&
    isPlayerTurn &&
    viewingHand &&
    !disabled &&
    !lacksAmmo &&
    energy >= cost;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: handCardDragId(handIndex),
    disabled: !canDrag,
  });

  return (
    <Box
      ref={setNodeRef}
      className={canDrag ? "squalls-combat-hand-card--draggable" : undefined}
      position="absolute"
      inset={0}
      opacity={isDragging ? 0.35 : 1}
      cursor={canDrag ? "grab" : undefined}
      touchAction={canDrag ? "none" : undefined}
      userSelect={canDrag ? "none" : undefined}
      _active={canDrag ? { cursor: "grabbing" } : undefined}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
    >
      <CombatHandCard
        card={card}
        cost={cost}
        equipped={equipped}
        layout="hand"
        fillSlot
        dragPassthrough={canDrag}
        disabled={disabled}
        viewOnly={canDrag}
        onClick={() => {}}
      />
    </Box>
  );
}

type EnemyDropTargetProps = {
  enemyIndex: number;
  slain: boolean;
  children: ReactNode;
};

export function CombatEnemyDropTarget({
  enemyIndex,
  slain,
  children,
}: EnemyDropTargetProps) {
  const { isPlayerTurn, attackDragActive } = useCombatBattleDnd();
  const canDrop = isPlayerTurn && !slain && attackDragActive;

  const { setNodeRef, isOver } = useDroppable({
    id: enemyDropId(enemyIndex),
    disabled: !canDrop,
  });

  return (
    <Box
      ref={setNodeRef}
      position="relative"
      w="100%"
      h="100%"
      minH="3.25rem"
      borderRadius="md"
      outline={isOver ? "2px solid var(--chakra-colors-orange-400)" : undefined}
      outlineOffset="1px"
      boxShadow={isOver ? "0 0 0 2px var(--chakra-colors-orange-200)" : undefined}
    >
      {children}
    </Box>
  );
}

type DefendDropZoneProps = {
  children: ReactNode;
};

/** Drop defend cards anywhere on the enemy battlefield grid. */
export function CombatDefendDropZone({ children }: DefendDropZoneProps) {
  const { isPlayerTurn, defendDragActive } = useCombatBattleDnd();
  const canDrop = isPlayerTurn && defendDragActive;

  const { setNodeRef, isOver } = useDroppable({
    id: DEFEND_DROP_ZONE_ID,
    disabled: !canDrop,
  });

  return (
    <Box
      ref={setNodeRef}
      flex="1"
      minH={0}
      w="100%"
      position="relative"
      borderRadius="md"
      outline={
        isOver && canDrop
          ? "2px dashed var(--chakra-colors-cyan-400)"
          : undefined
      }
      outlineOffset="2px"
      bg={isOver && canDrop ? "cyan.50" : undefined}
    >
      {children}
    </Box>
  );
}
