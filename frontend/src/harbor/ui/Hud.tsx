import type { HarborCatalog, HarborState, StageDef } from "../engine/types";
import { metricPressureBand } from "../engine/derive";

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
  catalog: HarborCatalog;
};

export default function Hud({ state, stage }: Props) {
  return (
    <header className="harbor-hud">
      <div className="harbor-hud__title-row">
        <div>
          <div className="harbor-hud__title">
            Stage {stage.id} · {stage.title}
          </div>
          <div className="harbor-stage-banner">{stage.ageQuestion}</div>
        </div>
        <span className="harbor-hud__command" title="Command points">
          ⚓ {state.command} / {state.commandPerDay}
        </span>
      </div>
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
              <span className="harbor-hud__metric-value">{Math.round(value)}</span>
            </div>
          );
        })}
      </div>
      <div className="harbor-hud__resources">
        {stage.resources.map((r) => {
          const v = state.resources[r] ?? 0;
          const cap = state.resourceCaps[r] ?? 0;
          return (
            <div key={r} className="harbor-hud__resource">
              <span className="harbor-hud__resource-name">
                {RESOURCE_LABELS[r] ?? r}
              </span>
              <span>
                {Math.floor(v)}
                <span className="harbor-hud__resource-cap"> / {cap}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="harbor-hud__day">Day {state.day}</div>
    </header>
  );
}
