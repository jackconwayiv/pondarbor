import type { HarborState } from "../engine/types";

type Props = {
  state: HarborState;
  onResolve: (id: string) => void;
};

function fmtMap(map: Record<string, number | undefined>): string {
  const entries = Object.entries(map).filter(([, v]) => typeof v === "number" && v !== 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${k}`).join(", ");
}

const SEVERITY_CHIP = {
  minor: "harbor-chip",
  serious: "harbor-chip harbor-chip--warn",
  crisis: "harbor-chip harbor-chip--bad",
} as const;

export default function EventsPanel({ state, onResolve }: Props) {
  if (state.activeEvents.length === 0) return null;
  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Active Events</span>
        <span className="harbor-panel__hint">{state.activeEvents.length} unresolved</span>
      </div>
      {state.activeEvents.map((e) => (
        <article key={e.id} className="harbor-card">
          <div className="harbor-card__title">{e.name}</div>
          {e.description && (
            <div className="harbor-card__desc">{e.description}</div>
          )}
          <div className="harbor-card__row">
            <span className={SEVERITY_CHIP[e.severity]}>{e.severity}</span>
            {Object.keys(e.metricEffects).length > 0 && (
              <span className="harbor-chip harbor-chip--bad">
                While active: {fmtMap(e.metricEffects)}
              </span>
            )}
            {Object.keys(e.cost).length > 0 && (
              <span className="harbor-chip">Pay: {fmtMap(e.cost)}</span>
            )}
            {e.commandCost > 0 && (
              <span className="harbor-chip">⚓ {e.commandCost}</span>
            )}
          </div>
          <div className="harbor-actions">
            <button
              type="button"
              className="harbor-button harbor-button--accent"
              onClick={() => onResolve(e.id)}
              disabled={state.command < e.commandCost}
            >
              Resolve
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
