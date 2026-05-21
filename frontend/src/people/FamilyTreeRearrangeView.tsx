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
  type DragStartEvent,
} from "@dnd-kit/core";
import { Box } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import FamilyTreeCanvas from "./FamilyTreeCanvas";
import FamilyTreeGrid, { cellDndId, parseCellDndId } from "./FamilyTreeGrid";
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
};

function DraggablePersonCard({
  personId,
  disabled,
  children,
}: {
  personId: string;
  disabled: boolean;
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
      {...(disabled ? {} : { ...listeners, ...attributes })}
    >
      {isDragging ? (
        <Box w={TREE_CARD_SIZE} h={TREE_CARD_SIZE} flexShrink={0} aria-hidden />
      ) : (
        <Box pointerEvents="none" w="100%" h="100%">
          {children}
        </Box>
      )}
    </Box>
  );
}

function DroppableCell({
  col,
  row,
  children,
}: {
  col: number;
  row: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellDndId(col, row) });
  return (
    <Box
      ref={setNodeRef}
      w="100%"
      h="100%"
      borderRadius="md"
      bg={isOver ? "teal.muted" : undefined}
      borderWidth={isOver ? "2px" : undefined}
      borderStyle={isOver ? "solid" : undefined}
      borderColor={isOver ? "teal.solid" : undefined}
      boxShadow={isOver ? "0 0 0 2px var(--chakra-colors-teal-solid)" : undefined}
    >
      {children}
    </Box>
  );
}

export default function FamilyTreeRearrangeView({
  bundle,
  layout: layoutProp,
  onLayoutChange,
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  useEffect(() => {
    bumpMeasure();
  }, [gridLayout, bumpMeasure]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const draggedId = String(event.active.id);
      const overId = event.over?.id ? String(event.over.id) : null;
      if (!overId) return;
      const cell = parseCellDndId(overId);
      if (!cell) return;
      const next = swapPeopleInLayout(gridLayout, draggedId, cell.col, cell.row, bundle.people);
      if (next) onLayoutChange(next);
    },
    [gridLayout, bundle.people, onLayoutChange],
  );

  const activePerson = activeId ? byId.get(activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
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
          renderCell={(col, row, occupantId) => (
            <DroppableCell col={col} row={row}>
              {occupantId ? (
                <DraggablePersonCard
                  personId={occupantId}
                  disabled={occupantId === selfId}
                >
                  <PersonCard
                    person={byId.get(occupantId)!}
                    bundle={bundle}
                    variant="squareCompact"
                  />
                </DraggablePersonCard>
              ) : null}
            </DroppableCell>
          )}
        />
      </FamilyTreeCanvas>
      <DragOverlay dropAnimation={null}>
        {activePerson ? (
          <Box
            w={TREE_CARD_SIZE}
            h={TREE_CARD_SIZE}
            flexShrink={0}
            opacity={0.95}
            pointerEvents="none"
            boxShadow="md"
          >
            <PersonCard person={activePerson} bundle={bundle} variant="squareCompact" />
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
