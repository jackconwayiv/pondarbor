import { useMemo, useState } from "react";

import { listAvailableOperations } from "../engine/derive";
import type { HarborCatalog, HarborState, ShipInstance } from "../engine/types";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onStart: (opSlug: string, shipId: string | null) => void;
};

function fmtMap(map: Record<string, number | undefined>): string {
  const entries = Object.entries(map).filter(([, v]) => typeof v === "number" && v !== 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${k}`).join(", ");
}

function shipPickerLabel(ship: ShipInstance, catalog: HarborCatalog): string {
  const def = catalog.ships.find((s) => s.slug === ship.defSlug);
  const name = def?.name ?? ship.defSlug;
  const where =
    ship.status === "berthed" ? `berth ${(ship.berthIndex ?? 0) + 1}` : ship.status;
  return `${name} (${where})`;
}

export default function OperationsPanel({ state, catalog, onStart }: Props) {
  const ops = useMemo(
    () => listAvailableOperations(state, catalog),
    [state, catalog],
  );
  const availableShips = state.ships.filter(
    (s) => s.status === "berthed" || s.status === "reserve",
  );
  const [pickedShipFor, setPickedShipFor] = useState<Record<string, string>>({});

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Operations</span>
        <span className="harbor-panel__hint">
          {ops.filter((o) => o.available).length} available
        </span>
      </div>

      {state.activeOperations.length > 0 && (
        <div className="harbor-stack" style={{ marginBottom: "0.6rem" }}>
          <div className="harbor-panel__hint">In progress</div>
          {state.activeOperations.map((op) => {
            const def = catalog.operations.find((o) => o.slug === op.defSlug);
            return (
              <article key={op.id} className="harbor-card">
                <div className="harbor-card__title">{def?.name ?? op.defSlug}</div>
                <div className="harbor-card__row">
                  <span className="harbor-chip">{op.kind}</span>
                  <span className="harbor-chip harbor-chip--info">
                    {op.remainingDays} day{op.remainingDays === 1 ? "" : "s"} left
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {ops.map(({ def, available, reason }) => {
        const opCost = def.extra.command_cost ?? 0;
        const needsShip =
          def.extra.kind === "voyage" || def.extra.kind === "repair";
        const pickedShipId = pickedShipFor[def.slug] ?? availableShips[0]?.id ?? "";
        const insufficientCommand = state.command < opCost;
        return (
          <article key={def.slug} className="harbor-card">
            <div className="harbor-card__title">{def.name}</div>
            {def.description && (
              <div className="harbor-card__desc">{def.description}</div>
            )}
            <div className="harbor-card__row">
              <span className="harbor-chip">{def.extra.kind}</span>
              {def.extra.voyage_type && (
                <span className="harbor-chip">{def.extra.voyage_type}</span>
              )}
              {opCost > 0 && (
                <span className="harbor-chip">⚓ {opCost}</span>
              )}
              {def.extra.duration_days != null && (
                <span className="harbor-chip">
                  {def.extra.duration_days}d
                </span>
              )}
              {def.extra.cost && Object.keys(def.extra.cost).length > 0 && (
                <span className="harbor-chip harbor-chip--bad">
                  Cost: {fmtMap(def.extra.cost)}
                </span>
              )}
              {def.extra.rewards && Object.keys(def.extra.rewards).length > 0 && (
                <span className="harbor-chip harbor-chip--good">
                  Yield: {fmtMap(def.extra.rewards)}
                </span>
              )}
              {def.extra.metric_effects && Object.keys(def.extra.metric_effects).length > 0 && (
                <span className="harbor-chip harbor-chip--info">
                  Effect: {fmtMap(def.extra.metric_effects)}
                </span>
              )}
              {(def.extra.risk ?? 0) > 0 && (
                <span className="harbor-chip harbor-chip--warn">
                  Risk {Math.round((def.extra.risk ?? 0) * 100)}%
                </span>
              )}
            </div>
            {needsShip && availableShips.length > 0 && (
              <label
                style={{
                  display: "flex",
                  gap: "0.4rem",
                  alignItems: "center",
                  fontSize: "0.8rem",
                }}
              >
                Ship:
                <select
                  value={pickedShipId}
                  onChange={(e) =>
                    setPickedShipFor((prev) => ({
                      ...prev,
                      [def.slug]: e.target.value,
                    }))
                  }
                  className="harbor-button"
                  style={{ padding: "0.25rem 0.4rem" }}
                >
                  {availableShips.map((s) => (
                    <option key={s.id} value={s.id}>
                      {shipPickerLabel(s, catalog)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="harbor-actions">
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                disabled={
                  !available || insufficientCommand || (needsShip && !pickedShipId)
                }
                onClick={() =>
                  onStart(def.slug, needsShip ? pickedShipId || null : null)
                }
              >
                Start
              </button>
              {!available && reason && (
                <span className="harbor-panel__hint">{reason}</span>
              )}
            </div>
          </article>
        );
      })}
      {ops.length === 0 && (
        <div className="harbor-panel__empty">No operations unlocked yet.</div>
      )}
    </section>
  );
}
