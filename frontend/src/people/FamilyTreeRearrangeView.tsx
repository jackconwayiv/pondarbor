import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import FamilyTreeCanvas from "./FamilyTreeCanvas";
import FamilyTreeGrid, { cellDndId } from "./FamilyTreeGrid";
import {
  familyTreeCellCollisionDetection,
  resolveRearrangeDropCell,
} from "./familyTreeDnd";
import PersonCard from "./PersonCard";
import {
  resolveDisplayLayout,
  swapPeopleInLayout,
  trimGridAroundOccupied,
} from "./treeLayout";
import { TREE_CARD_SIZE } from "./treeGridConstants";
import type { PeopleGraphBundle, PeopleTreeLayout } from "./types";
import { usePeopleTreeAnchors } from "./usePeopleTreeAnchors";

export type FamilyTreeRearrangeViewProps = {
  bundle: PeopleGraphBundle;
  layout: PeopleTreeLayout;
  onLayoutChange: (layout: PeopleTreeLayout) => void;
  treeOwnerUserId?: number;
};

type GridCell = { col: number; row: number };

type DragPreviewSize = { width: number; height: number };

function DraggablePersonCard({
  personId,
  disabled,
  isDropTarget,
  allowInnerPointerEvents,
  children,
}: {
  personId: string;
  disabled: boolean;
  isDropTarget: boolean;
  allowInnerPointerEvents?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: personId,
    disabled,
  });
  return (
    <Box
      ref={setNodeRef}
      data-tree-draggable=""
      cursor={disabled ? "default" : "grab"}
      touchAction="none"
      w={TREE_CARD_SIZE}
      h={TREE_CARD_SIZE}
      flexShrink={0}
      outline={isDropTarget ? "2px solid" : undefined}
      outlineColor={isDropTarget ? "teal.solid" : undefined}
      outlineOffset={isDropTarget ? "2px" : undefined}
      borderRadius={isDropTarget ? "xl" : undefined}
      boxShadow={
        isDropTarget ? "0 0 0 2px var(--chakra-colors-teal-solid)" : undefined
      }
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      {isDragging ? (
        <Box w={TREE_CARD_SIZE} h={TREE_CARD_SIZE} flexShrink={0} aria-hidden />
      ) : (
        <Box pointerEvents={allowInnerPointerEvents ? "auto" : "none"} w="100%" h="100%">
          {children}
        </Box>
      )}
    </Box>
  );
}

function DroppableCell({
  col,
  row,
  highlighted,
  children,
}: {
  col: number;
  row: number;
  highlighted: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: cellDndId(col, row) });
  return (
    <Box
      ref={setNodeRef}
      w="100%"
      h="100%"
      borderRadius="md"
      bg={highlighted ? "teal.muted" : undefined}
      borderWidth={highlighted ? "2px" : undefined}
      borderStyle={highlighted ? "solid" : undefined}
      borderColor={highlighted ? "teal.solid" : undefined}
      boxShadow={
        highlighted ? "0 0 0 2px var(--chakra-colors-teal-solid)" : undefined
      }
    >
      {children}
    </Box>
  );
}

function isSameCell(a: GridCell | null, col: number, row: number): boolean {
  return a != null && a.col === col && a.row === row;
}

export default function FamilyTreeRearrangeView({
  bundle,
  layout: layoutProp,
  onLayoutChange,
  treeOwnerUserId,
}: FamilyTreeRearrangeViewProps) {
  const personCount = bundle.people.length;
  const anchorApi = usePeopleTreeAnchors(personCount);
  const { registerAnchor, bumpMeasure } = anchorApi;

  const gridLayout = useMemo(() => {
    const resolved = resolveDisplayLayout(layoutProp, bundle.people, bundle.partnerships);
    return trimGridAroundOccupied(resolved);
  }, [layoutProp, bundle.people, bundle.partnerships]);

  const selfId = bundle.people.find((p) => p.is_self)?.id ?? null;
  const byId = useMemo(() => new Map(bundle.people.map((p) => [p.id, p])), [bundle.people]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<GridCell | null>(null);
  const [dragPreviewSize, setDragPreviewSize] = useState<DragPreviewSize | null>(null);

  const activeFrom = activeId ? gridLayout.positions[activeId] : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  useEffect(() => {
    bumpMeasure();
  }, [gridLayout, bumpMeasure]);

  const clearDragState = useCallback(() => {
    setActiveId(null);
    setHoverCell(null);
    setDragPreviewSize(null);
  }, []);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const rect = event.active.rect.current.initial;
    if (rect) {
      setDragPreviewSize({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
    } else {
      setDragPreviewSize(null);
    }
  }, []);

  const onDragOver = useCallback(
    (event: DragOverEvent) => {
      const from = gridLayout.positions[String(event.active.id)];
      const cell = resolveRearrangeDropCell(
        event.over?.id,
        event.collisions ?? undefined,
        gridLayout,
      );
      if (cell && from && cell.col === from.col && cell.row === from.row) {
        setHoverCell(null);
        return;
      }
      setHoverCell(cell);
    },
    [gridLayout],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const draggedId = String(event.active.id);
      const cell = resolveRearrangeDropCell(
        event.over?.id,
        event.collisions ?? undefined,
        gridLayout,
      );
      clearDragState();
      if (!cell) return;
      const next = swapPeopleInLayout(gridLayout, draggedId, cell.col, cell.row, bundle.people);
      if (next) onLayoutChange(next);
    },
    [gridLayout, bundle.people, onLayoutChange, clearDragState],
  );

  const onDragCancel = useCallback(() => {
    clearDragState();
  }, [clearDragState]);

  const activePerson = activeId ? byId.get(activeId) : null;

  const cellHighlighted = useCallback(
    (col: number, row: number) => {
      if (!isSameCell(hoverCell, col, row)) return false;
      if (activeFrom && activeFrom.col === col && activeFrom.row === row) return false;
      return true;
    },
    [hoverCell, activeFrom],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={familyTreeCellCollisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <FamilyTreeCanvas
        personCount={personCount}
        centerOnPersonId={selfId}
        enablePinchZoom={false}
        anchorApi={anchorApi}
      >
        <FamilyTreeGrid
          layout={gridLayout}
          registerAnchor={registerAnchor}
          showGridLines
          renderCell={(col, row, occupantId) => {
            const highlighted = cellHighlighted(col, row);
            const isOccupiedDropTarget = Boolean(occupantId && highlighted);
            const occupant = occupantId ? byId.get(occupantId) : undefined;
            return (
              <DroppableCell col={col} row={row} highlighted={highlighted}>
                {occupant ? (
                  <DraggablePersonCard
                    personId={occupantId!}
                    disabled={occupantId === selfId}
                    isDropTarget={isOccupiedDropTarget}
                    allowInnerPointerEvents={
                      occupant.is_self && treeOwnerUserId != null
                    }
                  >
                    <PersonCard
                      person={occupant}
                      bundle={bundle}
                      treeOwnerUserId={treeOwnerUserId}
                      variant="squareCompact"
                    />
                  </DraggablePersonCard>
                ) : null}
              </DroppableCell>
            );
          }}
        />
      </FamilyTreeCanvas>
      <DragOverlay dropAnimation={null} adjustScale={false}>
        {activePerson && dragPreviewSize ? (
          <Box
            w={`${dragPreviewSize.width}px`}
            h={`${dragPreviewSize.height}px`}
            flexShrink={0}
            opacity={0.95}
            pointerEvents="none"
            boxShadow="sm"
          >
            <PersonCard
              person={activePerson}
              bundle={bundle}
              treeOwnerUserId={treeOwnerUserId}
              variant="squareCompact"
              fillContainer
            />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
