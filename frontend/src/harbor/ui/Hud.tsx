import { Link } from "react-router";

import type { HarborCatalog, HarborState, Resource, StageDef } from "../engine/types";
import {
  derivePendingCargoUnloadIncome,
  deriveTotalCommandReserved,
  dailyResourceIncome,
  metricPressureBand,
} from "../engine/derive";

const RESOURCE_EMOJI: Partial<Record<Resource, string>> = {
  food: "🐟",
  timber: "🪵",
  stone: "🪨",
  metal: "⚙️",
  oil: "🛢️",
  rareMinerals: "💎",
  wealth: "🪙",
};

const RESOURCE_LABELS: Record<string, string> = {
  food: "Food",
  timber: "Timber",
  stone: "Stone",
  metal: "Metal",
  oil: "Oil",
  rareMinerals: "Rare",
  wealth: "Wealth",
};

const METRIC_LABELS: Record<string, string> = {
  population: "POPULATION",
  prestige: "Prestige",
  influence: "Influence",
  morale: "Morale",
  security: "Security",
  sanitation: "Sanitation",
  readiness: "Readiness",
  congestion: "Congestion",
};

type Props = {
  state: HarborState;
  stage: StageDef;
  catalog: HarborCatalog;
  /** Save slot display name (from lobby). */
  harborName: string;
  onEndDay: () => void;
  canEndDay: boolean;
  saveHint: string;
};

export default function Hud({
  state,
  stage,
  catalog,
  harborName,
  onEndDay,
  canEndDay,
  saveHint,
}: Props) {
  const reserved = deriveTotalCommandReserved(state);
  const usable = Math.max(0, state.command - reserved);
  /**
   * Coins = discretionary anchors only. Reserved (unload / queued sailing) is bookkeeping,
   * not extra doubloons — otherwise spent anchors looked “stuck” as silver coins.
   */
  const anchorCount = Math.max(0, Math.floor(usable));

  const incoming =
    state.stageId === 1
      ? derivePendingCargoUnloadIncome(state)
      : dailyResourceIncome(state, catalog);

  return (
    <header className="harbor-hud">
      <div className="harbor-hud__title-row">
        <div className="harbor-hud__title-block">
          <div className="harbor-hud__title">{harborName}</div>
          <div className="harbor-hud__title-sub">
            {stage.title} · Day {state.day}
          </div>
        </div>
        <Link to="/harbor" className="harbor-hud__lobby">
          Lobby
        </Link>
      </div>
      <div className="harbor-hud__metrics-row">
        {stage.metrics.length > 0 ? (
          <div className="harbor-hud__metrics">
            {stage.metrics.map((m) => {
              const value = state.metrics[m] ?? 0;
              const band = metricPressureBand(m, value);
              const cls =
                band === "low"
                  ? "harbor-hud__metric--low"
                  : band === "high"
                    ? "harbor-hud__metric--high"
                    : "";
              return (
                <div key={m} className={`harbor-hud__metric ${cls}`}>
                  <span className="harbor-hud__metric-label">
                    {METRIC_LABELS[m] ?? m}
                  </span>
                  <span className="harbor-hud__metric-value">
                    {Math.round(value)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
        <button
          type="button"
          className="harbor-hud__end-day"
          onClick={() => onEndDay()}
          disabled={!canEndDay}
        >
          End day {state.day} →
        </button>
      </div>
      <div
        className="harbor-hud__anchors"
        aria-label={
          anchorCount > 0
            ? `${anchorCount} anchor${anchorCount === 1 ? "" : "s"} to spend${reserved > 0 ? `; ${reserved} reserved for unload or sailing` : ""}`
            : `No anchors to spend${reserved > 0 ? `; ${reserved} reserved for unload or sailing` : ""}`
        }
      >
        <span className="harbor-hud__command-label">Command:</span>
        {Array.from({ length: anchorCount }).map((_, i) => (
          <span
            key={i}
            className="harbor-hud__anchor-coin harbor-hud__anchor-coin--gold"
            aria-hidden
          >
            <span className="harbor-hud__anchor-coin__anchor">⚓</span>
          </span>
        ))}
      </div>
      <div className="harbor-hud__resources">
        {stage.resources.map((r) => {
          const owned = Math.floor(state.resources[r] ?? 0);
          const cap = state.resourceCaps[r] ?? 0;
          const inc = Math.floor(incoming[r] ?? 0);
          const emoji = RESOURCE_EMOJI[r] ?? "";
          const label = RESOURCE_LABELS[r] ?? r;
          return (
            <div
              key={r}
              className="harbor-hud__resource"
              aria-label={
                inc > 0
                  ? state.stageId === 1
                    ? `${label} ${owned} stored of ${cap}, +${inc} from unloading laden berthed ships when you end the day`
                    : `${label} ${owned} stored of ${cap}, +${inc} from buildings and policies when you end the day`
                  : `${label} ${owned} stored of ${cap}`
              }
            >
              <span className="harbor-hud__resource-name">
                <span className="harbor-hud__resource-emoji" aria-hidden>
                  {emoji}
                </span>
                <span className="harbor-hud__resource-label">{label}</span>
              </span>
              <span className="harbor-hud__resource-values">
                <span className="harbor-hud__resource-owned">{owned}</span>
                {inc > 0 ? (
                  <span className="harbor-hud__resource-incoming">+{inc}</span>
                ) : null}
                <span className="harbor-hud__resource-cap"> / {cap}</span>
              </span>
            </div>
          );
        })}
      </div>
      {saveHint ? (
        <div className="harbor-hud__save-hint">{saveHint}</div>
      ) : null}
    </header>
  );
}
