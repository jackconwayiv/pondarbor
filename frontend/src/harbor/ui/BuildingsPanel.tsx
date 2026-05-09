import { useMemo, useState } from "react";

import { getBuildingLevel } from "../engine/derive";
import { AGE1_CONSTRUCTION_DAYS } from "../engine/rules";
import type {
  BuildingDefExtra,
  CatalogDef,
  HarborCatalog,
  HarborState,
} from "../engine/types";
import {
  constructionRemainingLabel,
  hourglassLine,
} from "./harborDuration";
import { formatResourceCostLine } from "./harborResourceCost";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onUpgrade: (slug: string) => void;
};

type Segment = "all" | "available" | "owned" | "locked";

function pendingBuildingDays(
  state: HarborState,
  slug: string,
): number | undefined {
  return state.pendingBuildingProjects.find((p) => p.slug === slug)
    ?.remainingDays;
}

export default function BuildingsPanel({ state, catalog, onUpgrade }: Props) {
  const [segment, setSegment] = useState<Segment>("all");
  const [category, setCategory] = useState<string>("all");
  const [detailSlug, setDetailSlug] = useState<string | null>(null);

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

  const districts = useMemo(() => {
    const d = new Set<string>();
    for (const b of inStage) {
      const dist = b.extra.district;
      if (dist) d.add(dist);
    }
    return ["all", ...[...d].sort()];
  }, [inStage]);

  const filtered = useMemo(() => {
    return inStage.filter((def) => {
      const level = getBuildingLevel(state, def.slug);
      const maxLevel =
        def.extra.max_level ?? def.extra.level_costs?.length ?? 1;
      const atMax = level >= maxLevel;
      const nextCost = def.extra.level_costs?.[level] ?? {};
      const buildingPending = state.pendingBuildingProjects.some(
        (p) => p.slug === def.slug,
      );
      const insufficient = Object.entries(nextCost).some(
        ([k, v]) => (state.resources as Record<string, number>)[k] < (v as number),
      );
      const canAfford =
        !atMax &&
        !insufficient &&
        state.command >= 1 &&
        level < maxLevel &&
        !buildingPending;

      if (segment === "owned" && level <= 0) return false;
      if (segment === "available" && (!canAfford || atMax)) return false;
      if (segment === "locked" && (canAfford || level > 0)) return false;

      if (category !== "all") {
        const dist = def.extra.district ?? "";
        if (dist !== category) return false;
      }
      return true;
    });
  }, [inStage, state, segment, category]);

  const detailDef = detailSlug
    ? inStage.find((b) => b.slug === detailSlug)
    : null;

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Construction Projects</span>
      </div>
      <div className="harbor-filter-row" role="tablist" aria-label="Building filters">
        {(
          [
            ["all", "All"],
            ["available", "Available"],
            ["owned", "Owned"],
            ["locked", "Unavailable"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={segment === id}
            className={`harbor-filter-btn${segment === id ? " harbor-filter-btn--active" : ""}`}
            onClick={() => setSegment(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {districts.length > 1 && (
        <div className="harbor-filter-row">
          <label className="harbor-filter-label" htmlFor="harbor-build-cat">
            District
          </label>
          <select
            id="harbor-build-cat"
            className="harbor-filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {d === "all" ? "All districts" : d}
              </option>
            ))}
          </select>
        </div>
      )}
      {filtered.length === 0 ? (
        <div className="harbor-panel__empty">No blueprints match this filter.</div>
      ) : (
        filtered.map((def) => {
          const level = getBuildingLevel(state, def.slug);
          const maxLevel =
            def.extra.max_level ?? def.extra.level_costs?.length ?? 1;
          const atMax = level >= maxLevel;
          const nextCost = def.extra.level_costs?.[level] ?? {};
          const constructDays = pendingBuildingDays(state, def.slug);
          const headTags =
            Boolean(def.extra.district) ||
            Boolean(def.extra.building_tier) ||
            constructDays != null;
          return (
            <article
              key={def.slug}
              className={`harbor-card${constructDays != null ? " harbor-card--constructing" : ""}`}
            >
              <button
                type="button"
                className="harbor-card__main"
                onClick={() => setDetailSlug(def.slug)}
              >
                <div className="harbor-card__main-body">
                  <div className="harbor-card__head">
                    <div className="harbor-card__title">
                      {def.name} {level > 0 ? `· L${level}` : ""}
                    </div>
                    {headTags ? (
                      <div className="harbor-card__tags" aria-label="Tags">
                        {def.extra.district ? (
                          <span className="harbor-chip">{def.extra.district}</span>
                        ) : null}
                        {def.extra.building_tier ? (
                          <span className="harbor-chip">
                            {def.extra.building_tier}
                          </span>
                        ) : null}
                        {constructDays != null ? (
                          <span className="harbor-chip harbor-chip--info">
                            Under construction
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  {def.description && (
                    <div className="harbor-card__desc">{def.description}</div>
                  )}
                </div>
                <div
                  className={`harbor-card__cost-foot${constructDays != null || !atMax ? " harbor-card__cost-foot--split" : ""}`}
                  aria-label={
                    constructDays != null ? "Construction progress" : "Cost"
                  }
                >
                  {constructDays != null ? (
                    <>
                      <span
                        className="harbor-card__cost-foot-left"
                        aria-hidden
                      />
                      <span
                        className="harbor-card__cost-foot-right harbor-card__cost-foot-item harbor-card__cost-foot-item--hourglasses"
                        aria-label={constructionRemainingLabel(constructDays)}
                      >
                        {hourglassLine(constructDays)}
                      </span>
                    </>
                  ) : atMax ? (
                    <span className="harbor-card__cost-foot-item">Max</span>
                  ) : (
                    <>
                      <span className="harbor-card__cost-foot-left harbor-card__cost-foot-left--costs">
                        <span className="harbor-card__cost-foot-item harbor-card__cost-foot-item--resources">
                          {formatResourceCostLine(nextCost)}
                        </span>
                        <span className="harbor-card__cost-foot-sep" aria-hidden>
                          ·
                        </span>
                        <span className="harbor-card__cost-foot-item harbor-card__cost-foot-item--anchor">
                          1 ⚓
                        </span>
                      </span>
                      <span className="harbor-card__cost-foot-right harbor-card__cost-foot-item harbor-card__cost-foot-item--lead-time">
                        {AGE1_CONSTRUCTION_DAYS} days
                      </span>
                    </>
                  )}
                </div>
              </button>
            </article>
          );
        })
      )}

      {detailDef ? (
        <div
          className="harbor-daybreak"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bd-title"
          onClick={() => setDetailSlug(null)}
        >
          <div
            className="harbor-daybreak__card harbor-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="bd-title" className="harbor-daybreak__title">
              {detailDef.name}
            </div>
            <div className="harbor-daybreak__hint">{detailDef.description}</div>
            <BuildingDetailBody def={detailDef} state={state} />
            <div className="harbor-row" style={{ justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="harbor-button"
                onClick={() => setDetailSlug(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                disabled={
                  (() => {
                    const level = getBuildingLevel(state, detailDef.slug);
                    const maxLevel =
                      detailDef.extra.max_level ??
                      detailDef.extra.level_costs?.length ??
                      1;
                    const atMax = level >= maxLevel;
                    const nextCost =
                      detailDef.extra.level_costs?.[level] ?? {};
                    const insufficient = Object.entries(nextCost).some(
                      ([k, v]) =>
                        (state.resources as Record<string, number>)[k] <
                        (v as number),
                    );
                    const pending = state.pendingBuildingProjects.some(
                      (p) => p.slug === detailDef.slug,
                    );
                    return (
                      atMax ||
                      insufficient ||
                      state.command < 1 ||
                      pending
                    );
                  })()
                }
                onClick={() => {
                  onUpgrade(detailDef.slug);
                  setDetailSlug(null);
                }}
              >
                Commit to buy
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BuildingDetailBody({
  def,
  state,
}: {
  def: CatalogDef<BuildingDefExtra>;
  state: HarborState;
}) {
  const level = getBuildingLevel(state, def.slug);
  const maxLevel =
    def.extra.max_level ?? def.extra.level_costs?.length ?? 1;
  const nextCost = def.extra.level_costs?.[level] ?? {};
  const constructDays = pendingBuildingDays(state, def.slug);
  return (
    <ul className="harbor-detail-list">
      <li>
        <strong>Next level:</strong> L{Math.min(level + 1, maxLevel)}
      </li>
      {constructDays != null ? (
        <li>
          <strong>Under construction:</strong>{" "}
          <span aria-label={constructionRemainingLabel(constructDays)}>
            {hourglassLine(constructDays)}
          </span>
          <span className="harbor-panel__hint">
            {" "}
            (Age 1 sites take {AGE1_CONSTRUCTION_DAYS} days by default)
          </span>
        </li>
      ) : (
        <li>
          <strong>Cost:</strong> {formatResourceCostLine(nextCost)} · 1 ⚓
        </li>
      )}
      {def.extra.building_tier ? (
        <li>
          <strong>Tier:</strong> {def.extra.building_tier}
        </li>
      ) : null}
    </ul>
  );
}
