/**
 * Drag a ship between berths and the reserve. Each successful reassignment
 * costs 1 command (engine enforces). DnD is disabled when command is at 0
 * or when the parent declares the board readonly (e.g. during cinematic).
 */

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useMemo } from "react";

import type {
  HarborCatalog,
  HarborState,
  ShipInstance,
  StageDef,
} from "../engine/types";

type Props = {
  state: HarborState;
  stage: StageDef;
  catalog: HarborCatalog;
  /** target = -1 for reserve, else berth index. */
  onReassign: (shipId: string, targetBerthIndex: number | null) => void;
  readOnly?: boolean;
};

function shipName(ship: ShipInstance, catalog: HarborCatalog): string {
  return catalog.ships.find((s) => s.slug === ship.defSlug)?.name ?? ship.defSlug;
}

function ShipChip({
  ship,
  catalog,
  draggable,
}: {
  ship: ShipInstance;
  catalog: HarborCatalog;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ship.id,
    disabled: !draggable,
  });
  const cls = `harbor-ship ${isDragging ? "harbor-ship--dragging" : ""} ${
    !draggable ? "harbor-ship--away" : ""
  }`;
  return (
    <div
      ref={setNodeRef}
      className={cls}
      {...listeners}
      {...attributes}
    >
      <span className="harbor-ship__name">{shipName(ship, catalog)}</span>
      <span className="harbor-ship__status">
        {ship.status === "voyage"
          ? "at sea"
          : ship.status === "repair"
            ? "in shipyard"
            : ship.status === "berthed"
              ? `berth ${(ship.berthIndex ?? 0) + 1}`
              : "reserve"}
      </span>
    </div>
  );
}

function BerthSlot({
  index,
  occupant,
  catalog,
  canDrop,
}: {
  index: number;
  occupant: ShipInstance | undefined;
  catalog: HarborCatalog;
  canDrop: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `berth-${index}`,
    disabled: !canDrop,
  });
  return (
    <div
      ref={setNodeRef}
      className={`harbor-berth ${isOver ? "harbor-berth--over" : ""} ${
        occupant ? "harbor-berth--occupied" : ""
      }`}
    >
      <span className="harbor-berth__label">Berth {index + 1}</span>
      {occupant ? (
        <ShipChip ship={occupant} catalog={catalog} draggable={canDrop} />
      ) : (
        <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>(empty)</span>
      )}
    </div>
  );
}

function ReserveDropZone({
  ships,
  catalog,
  canDrop,
}: {
  ships: ShipInstance[];
  catalog: HarborCatalog;
  canDrop: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "reserve",
    disabled: !canDrop,
  });
  return (
    <div
      ref={setNodeRef}
      className={`harbor-reserve ${isOver ? "harbor-reserve--over" : ""}`}
    >
      {ships.length === 0 ? (
        <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>(no ships in reserve)</span>
      ) : (
        ships.map((s) => (
          <ShipChip key={s.id} ship={s} catalog={catalog} draggable={canDrop} />
        ))
      )}
    </div>
  );
}

export default function BerthBoard({
  state,
  stage,
  catalog,
  onReassign,
  readOnly,
}: Props) {
  const dndEnabled = !readOnly && state.command >= 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
  );

  const berthOccupants = useMemo(() => {
    const map = new Map<number, ShipInstance>();
    for (const s of state.ships) {
      if (s.status === "berthed" && s.berthIndex != null) {
        map.set(s.berthIndex, s);
      }
    }
    return map;
  }, [state.ships]);

  const reserveShips = state.ships.filter((s) => s.status === "reserve");
  const awayShips = state.ships.filter(
    (s) => s.status === "voyage" || s.status === "repair",
  );

  function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const shipId = String(e.active.id);
    const overId = String(e.over.id);
    let targetBerthIndex: number | null;
    if (overId === "reserve") {
      targetBerthIndex = null;
    } else if (overId.startsWith("berth-")) {
      targetBerthIndex = Number.parseInt(overId.slice("berth-".length), 10);
    } else {
      return;
    }
    onReassign(shipId, targetBerthIndex);
  }

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Berths</span>
        <span className="harbor-panel__hint">
          {dndEnabled
            ? "Drag a ship to reassign (1 command)"
            : readOnly
              ? "Locked"
              : "Need at least 1 command to reassign"}
        </span>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="harbor-berths">
          {Array.from({ length: stage.berthCap }).map((_, i) => (
            <BerthSlot
              key={i}
              index={i}
              occupant={berthOccupants.get(i)}
              catalog={catalog}
              canDrop={dndEnabled}
            />
          ))}
        </div>
        <div className="harbor-stack" style={{ marginTop: "0.5rem" }}>
          <span className="harbor-panel__hint">Reserve</span>
          <ReserveDropZone
            ships={reserveShips}
            catalog={catalog}
            canDrop={dndEnabled}
          />
        </div>
      </DndContext>
      {awayShips.length > 0 && (
        <div className="harbor-stack" style={{ marginTop: "0.5rem" }}>
          <span className="harbor-panel__hint">Away</span>
          <div className="harbor-row">
            {awayShips.map((s) => (
              <ShipChip
                key={s.id}
                ship={s}
                catalog={catalog}
                draggable={false}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
