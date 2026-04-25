import type { HarborState } from "../engine/types";

type Props = {
  state: HarborState;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
};

function fmtMap(map: Record<string, number | undefined>): string {
  const entries = Object.entries(map).filter(([, v]) => typeof v === "number" && v !== 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${k}`).join(", ");
}

export default function ArrivalsPanel({ state, onAccept, onDecline }: Props) {
  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Arrivals</span>
        <span className="harbor-panel__hint">{state.pendingArrivals.length} waiting</span>
      </div>
      {state.pendingArrivals.length === 0 ? (
        <div className="harbor-panel__empty">The water's quiet today.</div>
      ) : (
        state.pendingArrivals.map((a) => (
          <article key={a.id} className="harbor-card">
            <div className="harbor-card__title">{a.name}</div>
            {a.description && (
              <div className="harbor-card__desc">{a.description}</div>
            )}
            <div className="harbor-card__row">
              {Object.keys(a.offer).length > 0 && (
                <span className="harbor-chip harbor-chip--good">
                  Offer: {fmtMap(a.offer)}
                </span>
              )}
              {Object.keys(a.request).length > 0 && (
                <span className="harbor-chip harbor-chip--bad">
                  Asks: {fmtMap(a.request)}
                </span>
              )}
              {Object.keys(a.metricEffects).length > 0 && (
                <span className="harbor-chip harbor-chip--info">
                  Effect: {fmtMap(a.metricEffects)}
                </span>
              )}
              {a.givesShipSlug && (
                <span className="harbor-chip harbor-chip--good">+ ship</span>
              )}
              {a.commandCost > 0 && (
                <span className="harbor-chip">⚓ {a.commandCost}</span>
              )}
            </div>
            <div className="harbor-actions">
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                onClick={() => onAccept(a.id)}
                disabled={state.command < a.commandCost}
              >
                Accept
              </button>
              <button
                type="button"
                className="harbor-button harbor-button--ghost"
                onClick={() => onDecline(a.id)}
              >
                Decline
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
