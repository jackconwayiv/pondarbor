import { useMemo } from "react";

import { getBuildingLevel } from "../engine/derive";
import type { HarborCatalog, HarborState } from "../engine/types";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onUpgrade: (slug: string) => void;
};

function fmtCost(cost: Record<string, number | undefined>): string {
  const entries = Object.entries(cost).filter(
    ([, v]) => typeof v === "number" && v !== 0,
  );
  if (entries.length === 0) return "free";
  return entries.map(([k, v]) => `${v} ${k}`).join(", ");
}

export default function BuildingsPanel({ state, catalog, onUpgrade }: Props) {
  const inStage = useMemo(
    () =>
      catalog.buildings.filter(
        (b) =>
          b.enabled &&
          b.stage_min <= state.stageId &&
          (b.stage_max == null || b.stage_max >= state.stageId),
      ),
    [catalog.buildings, state.stageId],
  );
  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Buildings</span>
        <span className="harbor-panel__hint">{inStage.length} available</span>
      </div>
      {inStage.length === 0 ? (
        <div className="harbor-panel__empty">No blueprints unlocked yet.</div>
      ) : (
        inStage.map((def) => {
          const level = getBuildingLevel(state, def.slug);
          const maxLevel =
            def.extra.max_level ?? def.extra.level_costs?.length ?? 1;
          const atMax = level >= maxLevel;
          const nextCost = def.extra.level_costs?.[level] ?? {};
          const insufficient = Object.entries(nextCost).some(
            ([k, v]) => (state.resources as Record<string, number>)[k] < (v as number),
          );
          return (
            <article key={def.slug} className="harbor-card">
              <div className="harbor-card__title">
                {def.name} {level > 0 ? `· L${level}` : ""}
              </div>
              {def.description && (
                <div className="harbor-card__desc">{def.description}</div>
              )}
              <div className="harbor-card__row">
                {def.extra.district && (
                  <span className="harbor-chip">{def.extra.district}</span>
                )}
                <span className="harbor-chip harbor-chip--info">
                  {atMax ? "Max" : `Next L${level + 1}: ${fmtCost(nextCost)}`}
                </span>
                <span className="harbor-chip">⚓ 1</span>
              </div>
              <div className="harbor-actions">
                <button
                  type="button"
                  className="harbor-button harbor-button--accent"
                  disabled={atMax || state.command < 1 || insufficient}
                  onClick={() => onUpgrade(def.slug)}
                >
                  {level === 0 ? "Build" : "Upgrade"}
                </button>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
