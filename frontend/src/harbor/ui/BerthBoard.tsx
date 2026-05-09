/**
 * Age 1 traffic: Berths = ships at port; Out to sea = queue + voyages + returned laden.
 * Ships prefer a numbered berth; overflow may sit in mooring or offshore (sea_waiting) in Out to Sea.
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
import { useEffect, useMemo, useState } from "react";

import { deriveEffectiveThroughput } from "../engine/derive";
import { hourglassLine } from "./harborDuration";
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
  onQueueDeparture?: (shipId: string) => void;
  onCancelQueuedDeparture?: (shipId: string) => void;
  readOnly?: boolean;
};

function shipName(ship: ShipInstance, catalog: HarborCatalog): string {
  return catalog.ships.find((s) => s.slug === ship.defSlug)?.name ?? ship.defSlug;
}

/** Empty hold — laden hold — underway (queued or active voyage/repair). */
type ShipVisualState = "empty" | "laden" | "voyaging";

function getShipVisualState(
  ship: ShipInstance,
  state: HarborState,
): ShipVisualState {
  if (ship.status === "sea_laden") return "laden";
  const queued = state.queuedDepartures.some((q) => q.shipId === ship.id);
  if (queued || ship.status === "voyage" || ship.status === "repair") {
    return "voyaging";
  }
  const pc = ship.pendingCargo;
  const laden =
    pc != null && Object.values(pc).some((v) => (v ?? 0) > 0);
  if (laden) return "laden";
  return "empty";
}

function formatDayLabel(n: number): string {
  const d = Math.max(1, Math.floor(n));
  return d === 1 ? "1 day" : `${d} days`;
}

function resourceEmoji(resourceKey: string): string {
  const map: Record<string, string> = {
    food: "🐟",
    timber: "🪵",
    stone: "🪨",
    metal: "⚙️",
    oil: "🛢️",
    rareMinerals: "💎",
    wealth: "🪙",
  };
  return map[resourceKey] ?? "";
}

/** e.g. "+5 🪵 +3 🐟" — amount before emoji */
function formatYieldBits(vy: Record<string, unknown> | undefined): string {
  if (!vy || typeof vy !== "object") return "";
  const parts: string[] = [];
  for (const [k, raw] of Object.entries(vy)) {
    const v = typeof raw === "number" ? raw : 0;
    if (v <= 0) continue;
    const emoji = resourceEmoji(k);
    parts.push(emoji ? `+${v} ${emoji}` : `+${v} ${k}`);
  }
  return parts.join(" ");
}

/** Nights remaining for queued departures or active voyage/repair ops. */
function voyageDaysRemaining(
  ship: ShipInstance,
  state: HarborState,
  catalog: HarborCatalog,
): number {
  const queued = state.queuedDepartures.find((q) => q.shipId === ship.id);
  if (queued) return Math.max(1, Math.floor(queued.voyageNights));
  const def = catalog.ships.find((s) => s.slug === ship.defSlug);
  if (ship.status === "voyage" || ship.status === "repair") {
    const op = state.activeOperations.find((o) => o.id === ship.activeOpId);
    return Math.max(
      1,
      Math.floor(op?.remainingDays ?? def?.extra.voyage_nights ?? 1),
    );
  }
  return Math.max(1, Math.floor(def?.extra.voyage_nights ?? 1));
}

type ShipStatusParts =
  | { kind: "split"; income: string | null; voyage: string }
  | { kind: "single"; text: string };

function chipStatusParts(
  ship: ShipInstance,
  catalog: HarborCatalog,
  state: HarborState,
): ShipStatusParts {
  const vs = getShipVisualState(ship, state);
  const def = catalog.ships.find((s) => s.slug === ship.defSlug);
  const vyRaw = def?.extra?.voyage_yield as Record<string, unknown> | undefined;
  const yieldLine = formatYieldBits(vyRaw);

  if (vs === "voyaging") {
    const days = voyageDaysRemaining(ship, state, catalog);
    return {
      kind: "split",
      income: yieldLine || null,
      voyage: hourglassLine(days),
    };
  }

  if (vs === "laden") {
    if (ship.status === "sea_laden") {
      return {
        kind: "split",
        income: yieldLine || null,
        voyage: "LADEN",
      };
    }
    return {
      kind: "single",
      text: "Cargo aboard · banks after one full day in berth",
    };
  }

  if (ship.status === "in_port") {
    return { kind: "single", text: "Arrivals basin" };
  }

  if (ship.status === "sea_waiting") {
    return {
      kind: "single",
      text: "Offshore · waiting for a berth (not on voyage)",
    };
  }

  const nights = Math.max(1, Math.floor(def?.extra.voyage_nights ?? 1));
  if (yieldLine) {
    return {
      kind: "split",
      income: yieldLine,
      voyage: formatDayLabel(nights),
    };
  }
  if (ship.status === "berthed") {
    return {
      kind: "single",
      text: `Ready · berth ${(ship.berthIndex ?? 0) + 1}`,
    };
  }
  if (ship.status === "mooring") {
    return { kind: "single", text: "Waiting for a free berth" };
  }
  return { kind: "single", text: "At port" };
}

function ShipStatusDisplay({ parts }: { parts: ShipStatusParts }) {
  if (parts.kind === "single") {
    return (
      <span className="harbor-ship__status harbor-ship__status--single">
        {parts.text}
      </span>
    );
  }
  const { income, voyage } = parts;
  return (
    <div
      className={`harbor-ship__status-row${income ? "" : " harbor-ship__status-row--voyage-only"}`}
    >
      {income ? (
        <span className="harbor-ship__status-income">{income}</span>
      ) : null}
      <span className="harbor-ship__status-voyage">{voyage}</span>
    </div>
  );
}

function ShipDragOverlayCard({
  ship,
  catalog,
  state,
}: {
  ship: ShipInstance;
  catalog: HarborCatalog;
  state: HarborState;
}) {
  const vs = getShipVisualState(ship, state);
  const parts = chipStatusParts(ship, catalog, state);
  return (
    <div
      className={`harbor-ship harbor-ship--overlay harbor-ship--state-${vs}${
        ship.status === "sea_laden" ? " harbor-ship--laden-at-sea" : ""
      }${ship.status === "sea_waiting" ? " harbor-ship--sea-waiting" : ""}`}
    >
      <span className="harbor-ship__name">{shipName(ship, catalog)}</span>
      <ShipStatusDisplay parts={parts} />
    </div>
  );
}

function ShipChip({
  ship,
  catalog,
  state,
  draggable,
}: {
  ship: ShipInstance;
  catalog: HarborCatalog;
  state: HarborState;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: ship.id,
    disabled: !draggable,
  });
  const vs = getShipVisualState(ship, state);
  const awayStyle =
    !draggable && (ship.status === "voyage" || ship.status === "repair");
  const cls = `harbor-ship ${isDragging ? "harbor-ship--dragging" : ""} ${
    awayStyle ? "harbor-ship--away" : ""
  } harbor-ship--state-${vs}${
    ship.status === "sea_laden" ? " harbor-ship--laden-at-sea" : ""
  }${ship.status === "sea_waiting" ? " harbor-ship--sea-waiting" : ""}`;
  const parts = chipStatusParts(ship, catalog, state);
  return (
    <div
      ref={setNodeRef}
      className={cls}
      {...listeners}
      {...attributes}
    >
      <span className="harbor-ship__name">{shipName(ship, catalog)}</span>
      <ShipStatusDisplay parts={parts} />
    </div>
  );
}

function BerthSlot({
  index,
  occupant,
  catalog,
  state,
  canDrop,
}: {
  index: number;
  occupant: ShipInstance | undefined;
  catalog: HarborCatalog;
  state: HarborState;
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
        occupant ? "harbor-berth--occupied" : "harbor-berth--empty"
      }`}
    >
      {occupant ? (
        <ShipChip
          ship={occupant}
          catalog={catalog}
          state={state}
          draggable={canDrop}
        />
      ) : (
        <span className="harbor-berth__placeholder">
          BERTH {index + 1}
        </span>
      )}
    </div>
  );
}

const OUT_TO_SEA_PAGE_SIZE = 9;

/** Queued departures; voyages/repairs; unladen hulls waiting for a berth; returned laden. */
function buildOutToSeaRows(state: HarborState): Array<
  | { key: string; kind: "queued"; q: QueuedDeparture }
  | { key: string; kind: "away"; ship: ShipInstance }
> {
  const rows: Array<
    | { key: string; kind: "queued"; q: QueuedDeparture }
    | { key: string; kind: "away"; ship: ShipInstance }
  > = [];
  for (const q of state.queuedDepartures) {
    rows.push({ key: `qd-${q.id}`, kind: "queued", q });
  }
  const awayCandidates = state.ships.filter(
    (s) =>
      s.status === "voyage" ||
      s.status === "repair" ||
      s.status === "sea_laden" ||
      s.status === "sea_waiting",
  );
  const voyageLike = awayCandidates.filter(
    (s) => s.status === "voyage" || s.status === "repair",
  );
  const seaWaiting = awayCandidates.filter((s) => s.status === "sea_waiting");
  const seaLaden = awayCandidates.filter((s) => s.status === "sea_laden");

  function remainingForShip(s: ShipInstance): number {
    const op = state.activeOperations.find((o) => o.id === s.activeOpId);
    return Math.max(0, Math.floor(op?.remainingDays ?? 0));
  }

  voyageLike.sort((a, b) => {
    const ra = remainingForShip(a);
    const rb = remainingForShip(b);
    if (ra !== rb) return ra - rb;
    return a.id.localeCompare(b.id);
  });
  seaWaiting.sort((a, b) => a.id.localeCompare(b.id));
  seaLaden.sort((a, b) => a.id.localeCompare(b.id));

  for (const s of voyageLike) {
    rows.push({ key: `away-${s.id}`, kind: "away", ship: s });
  }
  for (const s of seaWaiting) {
    rows.push({ key: `wait-${s.id}`, kind: "away", ship: s });
  }
  for (const s of seaLaden) {
    rows.push({ key: `sea-${s.id}`, kind: "away", ship: s });
  }
  return rows;
}

function DeparturesDropZone({
  canDrop,
  rows,
  state,
  catalog,
  departuresEnabled,
  portDragEnabled,
}: {
  canDrop: boolean;
  rows: ReturnType<typeof buildOutToSeaRows>;
  state: HarborState;
  catalog: HarborCatalog;
  departuresEnabled: boolean;
  portDragEnabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: "departures",
    disabled: !canDrop,
  });
  const [page, setPage] = useState(0);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / OUT_TO_SEA_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(total / OUT_TO_SEA_PAGE_SIZE));
    setPage((p) => Math.min(p, tp - 1));
  }, [total]);

  const pageRows = useMemo(() => {
    const start = safePage * OUT_TO_SEA_PAGE_SIZE;
    return rows.slice(start, start + OUT_TO_SEA_PAGE_SIZE);
  }, [rows, safePage]);

  const empty = total === 0;
  const showPager = total > OUT_TO_SEA_PAGE_SIZE;

  return (
    <div
      ref={setNodeRef}
      className={`harbor-reserve harbor-out-to-sea harbor-sea-surface ${empty ? "harbor-out-to-sea--empty" : ""} ${isOver ? "harbor-reserve--over" : ""}`}
    >
      {empty ? (
        <span className="harbor-out-to-sea__placeholder">OUT TO SEA</span>
      ) : (
        <div className="harbor-out-to-sea__content">
          {showPager ? (
            <div className="harbor-out-to-sea__pager">
              <button
                type="button"
                className="harbor-out-to-sea__nav"
                aria-label="Previous ships"
                disabled={safePage <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ‹
              </button>
              <span className="harbor-out-to-sea__page-indicator">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="harbor-out-to-sea__nav"
                aria-label="Next ships"
                disabled={safePage >= totalPages - 1}
                onClick={() =>
                  setPage((p) => Math.min(totalPages - 1, p + 1))
                }
              >
                ›
              </button>
            </div>
          ) : null}
          <div className="harbor-out-to-sea__ships-row">
            <div className="harbor-out-to-sea__ships">
              {pageRows.map((row) => {
                if (row.kind === "queued") {
                  const inst = state.ships.find((s) => s.id === row.q.shipId);
                  if (!inst) {
                    return (
                      <div key={row.key} className="harbor-chip harbor-chip--info">
                        Unknown ship
                      </div>
                    );
                  }
                  return (
                    <ShipChip
                      key={row.key}
                      ship={inst}
                      catalog={catalog}
                      state={state}
                      draggable={departuresEnabled}
                    />
                  );
                }
                const s = row.ship;
                const draggable =
                  (s.status === "sea_laden" || s.status === "sea_waiting") &&
                  portDragEnabled;
                return (
                  <ShipChip
                    key={row.key}
                    ship={s}
                    catalog={catalog}
                    state={state}
                    draggable={draggable}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BerthBoard({
  state,
  catalog,
  onReassign,
  onQueueDeparture,
  onCancelQueuedDeparture,
  readOnly,
}: Props) {
  const age1 = state.stageId === 1;
  const queuedIds = useMemo(
    () => new Set(state.queuedDepartures.map((q) => q.shipId)),
    [state.queuedDepartures],
  );
  const effCap = deriveEffectiveThroughput(state, catalog);
  /** Let the engine enforce ⚓ cost (Age 2+); disabling drops hid failures as “nothing happens”. */
  const portDragEnabled = !readOnly;
  const departuresEnabled =
    age1 &&
    !readOnly &&
    onQueueDeparture != null &&
    onCancelQueuedDeparture != null;

  /** Age 2+ still shows Out to Sea when voyages / laden / offshore-waiting hulls need a home. */
  const hasOutToSeaPopulation =
    state.queuedDepartures.length > 0 ||
    state.ships.some(
      (s) =>
        s.status === "voyage" ||
        s.status === "repair" ||
        s.status === "sea_laden" ||
        s.status === "sea_waiting",
    );

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

  const mooringOverflow = state.ships.filter(
    (s) => s.status === "mooring" && !queuedIds.has(s.id),
  );
  const arrivalsShips = state.ships.filter((s) => s.status === "in_port");

  const outToSeaRows = useMemo(() => buildOutToSeaRows(state), [state]);

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

    if (overId.startsWith("berth-")) {
      const idx = Number.parseInt(overId.slice("berth-".length), 10);
      if (queuedIds.has(shipId) && onCancelQueuedDeparture) {
        onCancelQueuedDeparture(shipId);
      }
      onReassign(shipId, idx);
      return;
    }

    if (overId === "departures" && departuresEnabled && onQueueDeparture) {
      onQueueDeparture(shipId);
    }
  }

  function handleDragCancel() {
    setDragShipId(null);
  }

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Harbor Traffic</span>
        {readOnly ? (
          <span className="harbor-panel__hint">Locked</span>
        ) : null}
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="harbor-traffic__column">
          {(age1 || hasOutToSeaPopulation) && (
            <DeparturesDropZone
              canDrop={departuresEnabled}
              rows={outToSeaRows}
              state={state}
              catalog={catalog}
              departuresEnabled={departuresEnabled}
              portDragEnabled={portDragEnabled}
            />
          )}

          <div className="harbor-stack harbor-stack--berths-only">
            <div className="harbor-berths">
              {Array.from({ length: effCap }).map((_, i) => (
                <BerthSlot
                  key={i}
                  index={i}
                  occupant={berthOccupants.get(i)}
                  catalog={catalog}
                  state={state}
                  canDrop={portDragEnabled}
                />
              ))}
            </div>
          </div>

          {mooringOverflow.length > 0 && (
            <div className="harbor-stack harbor-traffic__overflow">
              <span className="harbor-panel__hint">Waiting for a berth</span>
              <div className="harbor-row">
                {mooringOverflow.map((s) => (
                  <ShipChip
                    key={s.id}
                    ship={s}
                    catalog={catalog}
                    state={state}
                    draggable={portDragEnabled}
                  />
                ))}
              </div>
            </div>
          )}

          {age1 && arrivalsShips.length > 0 && (
            <div className="harbor-stack">
              <span className="harbor-panel__hint">Incoming (needs berth)</span>
              <div className="harbor-reserve harbor-reserve--muted harbor-sea-surface harbor-sea-surface--harbor">
                {arrivalsShips.map((s) => (
                  <ShipChip
                    key={s.id}
                    ship={s}
                    catalog={catalog}
                    state={state}
                    draggable={portDragEnabled}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragShip ? (
            <ShipDragOverlayCard ship={dragShip} catalog={catalog} state={state} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
