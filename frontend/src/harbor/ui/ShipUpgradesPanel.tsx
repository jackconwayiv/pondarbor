import { useState } from "react";

import type { HarborCatalog, HarborState } from "../engine/types";
import { getShipDef } from "../engine/derive";
import { attachShipUpgrade } from "../engine/rules";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onApply: (mutate: (s: HarborState, c: HarborCatalog) => HarborState) => void;
};

export default function ShipUpgradesPanel({ state, catalog, onApply }: Props) {
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const upgrades = catalog.ship_upgrades ?? [];
  if (state.stageId !== 1 || upgrades.length === 0) return null;

  const eligibleShips = state.ships.filter(
    (s) => s.status === "reserve" || s.status === "berthed",
  );

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Ship upgrades</span>
        <span className="harbor-panel__hint">Select a ship, then an upgrade</span>
      </div>
      <div className="harbor-row" style={{ marginBottom: "0.5rem" }}>
        {eligibleShips.map((s) => {
          const def = getShipDef(catalog, s.defSlug);
          return (
            <button
              key={s.id}
              type="button"
              className={`harbor-button harbor-button--ghost ${selectedShipId === s.id ? "harbor-button--accent" : ""}`}
              onClick={() => setSelectedShipId(s.id)}
            >
              {def?.name ?? s.defSlug}
            </button>
          );
        })}
      </div>
      <div className="harbor-stack">
        {upgrades.map((u) => (
          <article key={u.slug} className="harbor-card">
            <div className="harbor-card__title">{u.name}</div>
            <div className="harbor-card__desc">{u.description}</div>
            <div className="harbor-actions">
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                disabled={!selectedShipId}
                onClick={() => {
                  if (!selectedShipId) return;
                  onApply((s, c) =>
                    attachShipUpgrade(s, c, selectedShipId, u.slug),
                  );
                }}
              >
                Install
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
