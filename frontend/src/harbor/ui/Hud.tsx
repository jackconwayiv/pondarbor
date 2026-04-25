import type { HarborState, Resource, StageDef } from "../engine/types";
import { deriveCommandReserved, metricPressureBand } from "../engine/derive";

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
  population: "Pop.",
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
  onEndDay: () => void;
  canEndDay: boolean;
  saveHint: string;
};

export default function Hud({
  state,
  stage,
  onEndDay,
  canEndDay,
  saveHint,
}: Props) {
  const reserved = deriveCommandReserved(state);
  const usable = state.command - reserved;
  const cmdDisplay =
    state.stageId === 1 && reserved > 0
      ? `${usable} + ${reserved} / ${state.commandPerDay}`
      : `${state.command} / ${state.commandPerDay}`;

  return (
    <header className="harbor-hud">
      <div className="harbor-hud__title-row">
        <div>
          <div className="harbor-hud__title">
            Stage {stage.id} · {stage.title}
          </div>
          <div className="harbor-hud__day">Day {state.day}</div>
        </div>
        <button
          type="button"
          className="harbor-hud__end-day"
          onClick={() => onEndDay()}
          disabled={!canEndDay}
        >
          End day {state.day} →
        </button>
      </div>
      {stage.metrics.length > 0 && (
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
      )}
      <div className="harbor-hud__resources">
        <div
          className="harbor-hud__resource"
          aria-label={`Command ${cmdDisplay}`}
        >
          <span className="harbor-hud__resource-name">
            <span className="harbor-hud__resource-emoji" aria-hidden>
              ⚓
            </span>
            <span className="harbor-hud__resource-label">Command</span>
          </span>
          <span>{cmdDisplay}</span>
        </div>
        {stage.resources.map((r) => {
          const v = state.resources[r] ?? 0;
          const cap = state.resourceCaps[r] ?? 0;
          const emoji = RESOURCE_EMOJI[r] ?? "";
          const label = RESOURCE_LABELS[r] ?? r;
          return (
            <div
              key={r}
              className="harbor-hud__resource"
              aria-label={`${label} ${Math.floor(v)} of ${cap}`}
            >
              <span className="harbor-hud__resource-name">
                <span className="harbor-hud__resource-emoji" aria-hidden>
                  {emoji}
                </span>
                <span className="harbor-hud__resource-label">{label}</span>
              </span>
              <span>
                {Math.floor(v)}
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
