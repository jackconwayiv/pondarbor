import { useMemo, useState } from "react";

import { deriveEffectiveBerthCap, getShipDef } from "../engine/derive";
import {
  AGE1_CONSTRUCTION_DAYS,
  attachShipUpgrade,
  commissionHullOrder,
} from "../engine/rules";
import type {
  CatalogDef,
  HarborCatalog,
  HarborState,
  ShipDefExtra,
} from "../engine/types";
import {
  constructionRemainingLabel,
  hourglassLine,
} from "./harborDuration";
import { formatResourceCostLine } from "./harborResourceCost";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onApply: (mutate: (s: HarborState, c: HarborCatalog) => HarborState) => void;
};

type Segment = "all" | "available" | "installed" | "locked";

function minHullRemaining(
  state: HarborState,
  shipSlug: string,
): number | null {
  const pending = state.pendingHullOrders ?? [];
  const forSlug = pending
    .filter((p) => p.shipSlug === shipSlug)
    .map((p) => p.remainingDays);
  if (forSlug.length === 0) return null;
  return Math.min(...forSlug);
}

export default function ShipUpgradesPanel({ state, catalog, onApply }: Props) {
  const [segment, setSegment] = useState<Segment>("all");
  const [category, setCategory] = useState<string>("all");
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [detailHullSlug, setDetailHullSlug] = useState<string | null>(null);
  const [modalShipId, setModalShipId] = useState<string | null>(null);

  const upgrades = catalog.ship_upgrades ?? [];

  const hullOffers = useMemo(() => {
    return catalog.ships.filter(
      (s) =>
        s.enabled &&
        s.stage_min <= state.stageId &&
        (s.stage_max == null || s.stage_max >= state.stageId) &&
        (s.extra as ShipDefExtra).shipwright_purchase != null,
    );
  }, [catalog.ships, state.stageId]);

  const shipwrightPanelVisible =
    state.stageId === 1 && (upgrades.length > 0 || hullOffers.length > 0);

  const categories = useMemo(() => {
    if (!shipwrightPanelVisible) return ["all"];
    const t = new Set<string>();
    for (const u of upgrades) {
      for (const tag of u.tags ?? []) t.add(tag);
    }
    return ["all", ...[...t].sort()];
  }, [upgrades, shipwrightPanelVisible]);

  const filtered = useMemo(() => {
    if (!shipwrightPanelVisible) return [];
    return upgrades.filter((u) => {
      const installedOnSome = state.ships.some((s) =>
        (s.attachments ?? []).includes(u.slug),
      );
      const cost = u.extra.cost ?? {};
      const insufficient = Object.entries(cost).some(
        ([k, v]) => (state.resources as Record<string, number>)[k] < (v as number),
      );
      const shipOk = state.ships.some(
        (s) =>
          (s.status === "mooring" || s.status === "berthed") &&
          !(s.attachments ?? []).includes(u.slug) &&
          !state.pendingShipwrightProjects.some((p) => p.shipId === s.id),
      );
      const canDo = !insufficient && state.command >= 1 && shipOk;

      if (segment === "installed" && !installedOnSome) return false;
      if (segment === "available" && (!canDo || installedOnSome)) return false;
      if (segment === "locked" && (canDo || installedOnSome)) return false;

      if (category !== "all") {
        if (!(u.tags ?? []).includes(category)) return false;
      }
      return true;
    });
  }, [upgrades, state, segment, category, shipwrightPanelVisible]);

  if (!shipwrightPanelVisible) {
    return null;
  }

  const eligibleShips = state.ships.filter(
    (s) => s.status === "mooring" || s.status === "berthed",
  );

  const detailUp = detailSlug
    ? upgrades.find((u) => u.slug === detailSlug)
    : null;

  const detailHullDef = detailHullSlug
    ? hullOffers.find((s) => s.slug === detailHullSlug)
    : null;

  const effectiveBerthCap = deriveEffectiveBerthCap(state, catalog);
  const hullOrdersPending = state.pendingHullOrders ?? [];
  const slotsUsed = state.ships.length + hullOrdersPending.length;
  const berthOk = slotsUsed < effectiveBerthCap;

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Shipwright Projects</span>
      </div>
      <div className="harbor-filter-row" role="tablist" aria-label="Upgrade filters">
        {(
          [
            ["all", "All"],
            ["available", "Available"],
            ["installed", "Owned"],
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
      {categories.length > 1 && (
        <div className="harbor-filter-row">
          <label className="harbor-filter-label" htmlFor="harbor-up-cat">
            Class / tag
          </label>
          <select
            id="harbor-up-cat"
            className="harbor-filter-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All" : c}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="harbor-stack">
        {hullOffers.map((def) => {
          const extra = def.extra as ShipDefExtra;
          const purchase = extra.shipwright_purchase!;
          const cost = purchase.cost ?? {};
          const cmdCost = Math.max(0, Math.floor(purchase.command ?? 1));
          const hullRemain = minHullRemaining(state, def.slug);
          const constructing = hullRemain != null;
          const headTags = constructing;
          return (
            <article
              key={`hull-${def.slug}`}
              className={`harbor-card${constructing ? " harbor-card--constructing" : ""}`}
            >
              <button
                type="button"
                className="harbor-card__main"
                onClick={() => {
                  setDetailHullSlug(def.slug);
                  setDetailSlug(null);
                }}
              >
                <div className="harbor-card__main-body">
                  <div className="harbor-card__head">
                    <div className="harbor-card__title">{def.name}</div>
                    {headTags ? (
                      <div className="harbor-card__tags" aria-label="Tags">
                        <span className="harbor-chip harbor-chip--info">
                          Under construction
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="harbor-card__desc">{def.description}</div>
                </div>
                <div
                  className="harbor-card__cost-foot harbor-card__cost-foot--split"
                  aria-label={
                    constructing ? "Construction progress" : "Cost"
                  }
                >
                  {constructing && hullRemain != null ? (
                    <>
                      <span
                        className="harbor-card__cost-foot-left"
                        aria-hidden
                      />
                      <span
                        className="harbor-card__cost-foot-right harbor-card__cost-foot-item harbor-card__cost-foot-item--hourglasses"
                        aria-label={constructionRemainingLabel(hullRemain)}
                      >
                        {hourglassLine(hullRemain)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="harbor-card__cost-foot-left harbor-card__cost-foot-left--costs">
                        <span className="harbor-card__cost-foot-item harbor-card__cost-foot-item--resources">
                          {formatResourceCostLine(cost)}
                        </span>
                        <span className="harbor-card__cost-foot-sep" aria-hidden>
                          ·
                        </span>
                        <span className="harbor-card__cost-foot-item harbor-card__cost-foot-item--anchor">
                          {cmdCost} ⚓
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
        })}
        {filtered.map((u) => {
          const cost = u.extra.cost ?? {};
          const pendingSlots = state.pendingShipwrightProjects.filter(
            (p) => p.upgradeSlug === u.slug,
          );
          const minConstruct =
            pendingSlots.length > 0
              ? Math.min(...pendingSlots.map((p) => p.remainingDays))
              : null;
          const headTags =
            (u.tags ?? []).length > 0 || minConstruct != null;
          const constructing = minConstruct != null;
          return (
            <article
              key={u.slug}
              className={`harbor-card${constructing ? " harbor-card--constructing" : ""}`}
            >
              <button
                type="button"
                className="harbor-card__main"
                onClick={() => {
                  setDetailSlug(u.slug);
                  setDetailHullSlug(null);
                  const pick = eligibleShips.find(
                    (s) =>
                      !(s.attachments ?? []).includes(u.slug) &&
                      !state.pendingShipwrightProjects.some(
                        (p) => p.shipId === s.id,
                      ),
                  );
                  setModalShipId(pick?.id ?? null);
                }}
              >
                <div className="harbor-card__main-body">
                  <div className="harbor-card__head">
                    <div className="harbor-card__title">{u.name}</div>
                    {headTags ? (
                      <div className="harbor-card__tags" aria-label="Tags">
                        {(u.tags ?? []).map((tag) => (
                          <span key={tag} className="harbor-chip">
                            {tag}
                          </span>
                        ))}
                        {minConstruct != null ? (
                          <span className="harbor-chip harbor-chip--info">
                            Under construction ({pendingSlots.length})
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="harbor-card__desc">{u.description}</div>
                </div>
                <div
                  className="harbor-card__cost-foot harbor-card__cost-foot--split"
                  aria-label={
                    minConstruct != null ? "Construction progress" : "Cost"
                  }
                >
                  {minConstruct != null ? (
                    <>
                      <span
                        className="harbor-card__cost-foot-left"
                        aria-hidden
                      />
                      <span
                        className="harbor-card__cost-foot-right harbor-card__cost-foot-item harbor-card__cost-foot-item--hourglasses"
                        aria-label={constructionRemainingLabel(minConstruct)}
                      >
                        {hourglassLine(minConstruct)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="harbor-card__cost-foot-left harbor-card__cost-foot-left--costs">
                        <span className="harbor-card__cost-foot-item harbor-card__cost-foot-item--resources">
                          {formatResourceCostLine(cost)}
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
        })}
      </div>

      {detailHullDef ? (
        <div
          className="harbor-daybreak"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hull-title"
          onClick={() => setDetailHullSlug(null)}
        >
          <div
            className="harbor-daybreak__card harbor-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="hull-title" className="harbor-daybreak__title">
              {detailHullDef.name}
            </div>
            <div className="harbor-daybreak__hint">{detailHullDef.description}</div>
            <HullDetailBody
              def={detailHullDef}
              state={state}
              catalog={catalog}
            />
            <div className="harbor-row" style={{ justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                className="harbor-button"
                onClick={() => setDetailHullSlug(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                disabled={(() => {
                  const extra = detailHullDef.extra as ShipDefExtra;
                  const purchase = extra.shipwright_purchase!;
                  const cost = purchase.cost ?? {};
                  const cmdCost = Math.max(0, Math.floor(purchase.command ?? 1));
                  const insufficient = Object.entries(cost).some(
                    ([k, v]) =>
                      (state.resources as Record<string, number>)[k] <
                      (v as number),
                  );
                  return (
                    insufficient ||
                    state.command < cmdCost ||
                    !berthOk ||
                    minHullRemaining(state, detailHullDef.slug) != null
                  );
                })()}
                onClick={() => {
                  onApply((s, c) =>
                    commissionHullOrder(s, c, detailHullDef.slug),
                  );
                  setDetailHullSlug(null);
                }}
              >
                Commission hull
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailUp ? (
        <div
          className="harbor-daybreak"
          role="dialog"
          aria-modal="true"
          aria-labelledby="su-title"
          onClick={() => setDetailSlug(null)}
        >
          <div
            className="harbor-daybreak__card harbor-detail-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="su-title" className="harbor-daybreak__title">
              {detailUp.name}
            </div>
            <div className="harbor-daybreak__hint">{detailUp.description}</div>
            <p className="harbor-panel__hint" style={{ marginTop: "0.35rem" }}>
              Target ship must be moored or berthed (not at sea). Age 1 refits
              take {AGE1_CONSTRUCTION_DAYS} days after you commit (cost + 1 ⚓
              upfront).
            </p>
            <label className="harbor-detail-field">
              <span>Eligible ship</span>
              <select
                className="harbor-filter-select"
                value={modalShipId ?? ""}
                onChange={(e) => setModalShipId(e.target.value || null)}
              >
                {eligibleShips
                  .filter(
                    (s) =>
                      !(s.attachments ?? []).includes(detailUp.slug) &&
                      !state.pendingShipwrightProjects.some(
                        (p) => p.shipId === s.id,
                      ),
                  )
                  .map((s) => {
                    const sd = getShipDef(catalog, s.defSlug);
                    return (
                      <option key={s.id} value={s.id}>
                        {sd?.name ?? s.defSlug}
                      </option>
                    );
                  })}
              </select>
            </label>
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
                  !modalShipId ||
                  (() => {
                    const cost = detailUp.extra.cost ?? {};
                    const insufficient = Object.entries(cost).some(
                      ([k, v]) =>
                        (state.resources as Record<string, number>)[k] <
                        (v as number),
                    );
                    return (
                      insufficient ||
                      state.command < 1 ||
                      state.pendingShipwrightProjects.some(
                        (p) => p.shipId === modalShipId,
                      )
                    );
                  })()
                }
                onClick={() => {
                  if (!modalShipId) return;
                  onApply((s, c) =>
                    attachShipUpgrade(s, c, modalShipId, detailUp.slug),
                  );
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

function HullDetailBody({
  def,
  state,
  catalog,
}: {
  def: CatalogDef<ShipDefExtra>;
  state: HarborState;
  catalog: HarborCatalog;
}) {
  const extra = def.extra as ShipDefExtra;
  const purchase = extra.shipwright_purchase!;
  const cost = purchase.cost ?? {};
  const cmdCost = Math.max(0, Math.floor(purchase.command ?? 1));
  const hullRemain = minHullRemaining(state, def.slug);
  const cap = deriveEffectiveBerthCap(state, catalog);
  const slotsUsed =
    state.ships.length + (state.pendingHullOrders ?? []).length;
  return (
    <ul className="harbor-detail-list">
      <li>
        <strong>Berths:</strong>{" "}
        {slotsUsed >= cap
          ? "No spare berth for a new hull."
          : `${slotsUsed} of ${cap} fleet slots in use (ships + hulls on order).`}
      </li>
      {hullRemain != null ? (
        <li>
          <strong>Under construction:</strong>{" "}
          <span aria-label={constructionRemainingLabel(hullRemain)}>
            {hourglassLine(hullRemain)}
          </span>
        </li>
      ) : (
        <li>
          <strong>Cost:</strong> {formatResourceCostLine(cost)} · {cmdCost} ⚓ ·{" "}
          {AGE1_CONSTRUCTION_DAYS} days at the yard
        </li>
      )}
    </ul>
  );
}
