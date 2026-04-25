/**
 * Drag ships between reserve, berths, departures (Age 1), and arrivals (in_port).
 */

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
import { useMemo, useState } from "react";

import { deriveEffectiveBerthCap } from "../engine/derive";
import type {
  HarborCatalog,
  HarborState,
  QueuedDeparture,
  ShipInstance,
} from "../engine/types";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onReassign: (shipId: string, targetBerthIndex: number | null) => void;
  /** Age 1: player wants to queue a voyage (opens confirm in parent). */
  onRequestDeparture?: (shipId: string) => void;
  /** Age 1: cancel queued departure by dragging back to reserve. */
  onCancelQueuedDeparture?: (shipId: string) => void;
  readOnly?: boolean;
};

function shipName(ship: ShipInstance, catalog: HarborCatalog): string {
  return catalog.ships.find((s) => s.slug === ship.defSlug)?.name ?? ship.defSlug;
}

function shipStatusLabel(ship: ShipInstance): string {
  if (ship.status === "voyage") return "at sea";
  if (ship.status === "repair") return "in shipyard";
  if (ship.status === "berthed")
    return `berth ${(ship.berthIndex ?? 0) + 1}`;
  if (ship.status === "in_port") return "arrivals";
  return "reserve";
}

/** Visual clone for `DragOverlay` (not a draggable). */
function ShipDragOverlayCard({
  ship,
  catalog,
}: {
  ship: ShipInstance;
  catalog: HarborCatalog;
}) {
  return (
    <div className="harbor-ship harbor-ship--overlay">
      <span className="harbor-ship__name">{shipName(ship, catalog)}</span>
      <span className="harbor-ship__status">{shipStatusLabel(ship)}</span>
    </div>
  );
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
  const statusLabel = shipStatusLabel(ship);
  return (
    <div
      ref={setNodeRef}
      className={cls}
      {...listeners}
      {...attributes}
    >
      <span className="harbor-ship__name">{shipName(ship, catalog)}</span>
      <span className="harbor-ship__status">{statusLabel}</span>
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
        <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>
          (no ships in reserve)
        </span>
      ) : (
        ships.map((s) => (
          <ShipChip key={s.id} ship={s} catalog={catalog} draggable={canDrop} />
        ))
      )}
    </div>
  );
}

function DeparturesDropZone({
  canDrop,
  queued,
  state,
  catalog,
}: {
  canDrop: boolean;
  queued: QueuedDeparture[];
  state: HarborState;
  catalog: HarborCatalog;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "departures",
    disabled: !canDrop,
  });
  return (
    <div
      ref={setNodeRef}
      className={`harbor-reserve harbor-departures ${isOver ? "harbor-reserve--over" : ""}`}
    >
      <span className="harbor-panel__hint">Departures</span>
      {queued.length === 0 ? (
        <span style={{ fontSize: "0.78rem", opacity: 0.5 }}>
          Drag a ship here to plan a voyage (confirm after drop)
        </span>
      ) : (
        queued.map((q) => {
          const inst = state.ships.find((s) => s.id === q.shipId);
          const nm = inst ? shipName(inst, catalog) : q.shipId;
          return (
            <div key={q.id} className="harbor-chip harbor-chip--info">
              {nm} · {q.commandCost} command · {q.voyageNights} night
              {q.voyageNights === 1 ? "" : "s"} at sea
            </div>
          );
        })
      )}
    </div>
  );
}

export default function BerthBoard({
  state,
  catalog,
  onReassign,
  onRequestDeparture,
  onCancelQueuedDeparture,
  readOnly,
}: Props) {
  const age1 = state.stageId === 1;
  const queuedIds = useMemo(
    () => new Set(state.queuedDepartures.map((q) => q.shipId)),
    [state.queuedDepartures],
  );
  const effCap = deriveEffectiveBerthCap(state, catalog);
  const berthShuffle =
    !readOnly && (state.stageId === 1 || state.command >= 1);
  const departuresEnabled =
    age1 &&
    !readOnly &&
    onRequestDeparture != null &&
    onCancelQueuedDeparture != null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 6 },
    }),
  );

  const berthOccupants = useMemo(() => {
    const map = new Map<number, ShipInstance>();
    for (const s of state.ships) {
      if (
        s.status === "berthed" &&
        s.berthIndex != null &&
        !queuedIds.has(s.id)
      ) {
        map.set(s.berthIndex, s);
      }
    }
    return map;
  }, [state.ships, queuedIds]);

  const reserveShips = state.ships.filter(
    (s) => s.status === "reserve" && !queuedIds.has(s.id),
  );
  const arrivalsShips = state.ships.filter((s) => s.status === "in_port");
  const awayShips = state.ships.filter(
    (s) => s.status === "voyage" || s.status === "repair",
  );

  const [dragShipId, setDragShipId] = useState<string | null>(null);
  const dragShip = useMemo(
    () => (dragShipId ? state.ships.find((s) => s.id === dragShipId) : null),
    [dragShipId, state.ships],
  );

  function handleDragStart(e: DragStartEvent) {
    setDragShipId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setDragShipId(null);
    if (!e.over) return;
    const shipId = String(e.active.id);
    const overId = String(e.over.id);
    if (overId === "reserve") {
      if (queuedIds.has(shipId) && onCancelQueuedDeparture) {
        onCancelQueuedDeparture(shipId);
        return;
      }
      onReassign(shipId, null);
      return;
    }
    if (overId === "departures" && departuresEnabled && onRequestDeparture) {
      onRequestDeparture(shipId);
      return;
    }
    if (overId.startsWith("berth-")) {
      const idx = Number.parseInt(overId.slice("berth-".length), 10);
      onReassign(shipId, idx);
    }
  }

  function handleDragCancel() {
    setDragShipId(null);
  }

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Harbor Traffic</span>
        <span className="harbor-panel__hint">
          {readOnly
            ? "Locked"
            : state.stageId === 1
              ? "Drag to berth, reserve, or departures"
              : "Drag a ship to reassign (1 command)"}
        </span>
      </div>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="harbor-traffic__grid">
          <div className="harbor-traffic__main">
            {age1 && departuresEnabled && (
              <div className="harbor-stack">
                <DeparturesDropZone
                  canDrop={departuresEnabled}
                  queued={state.queuedDepartures}
                  state={state}
                  catalog={catalog}
                />
              </div>
            )}
            <div className="harbor-berths">
              {Array.from({ length: effCap }).map((_, i) => (
                <BerthSlot
                  key={i}
                  index={i}
                  occupant={berthOccupants.get(i)}
                  catalog={catalog}
                  canDrop={berthShuffle}
                />
              ))}
            </div>
            {age1 && arrivalsShips.length > 0 && (
              <div className="harbor-stack">
                <span className="harbor-panel__hint">Arrivals</span>
                <div className="harbor-reserve">
                  {arrivalsShips.map((s) => (
                    <ShipChip
                      key={s.id}
                      ship={s}
                      catalog={catalog}
                      draggable={berthShuffle}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="harbor-traffic__reserve">
            <span className="harbor-panel__hint">Reserve fleet</span>
            <ReserveDropZone
              ships={reserveShips}
              catalog={catalog}
              canDrop={berthShuffle || departuresEnabled}
            />
          </aside>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragShip ? (
            <ShipDragOverlayCard ship={dragShip} catalog={catalog} />
          ) : null}
        </DragOverlay>
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
