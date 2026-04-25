import type { HarborCatalog, HarborState, StageDef } from "../engine/types";

type Props = {
  state: HarborState;
  stage: StageDef;
  catalog: HarborCatalog;
  onChoose: (slug: string) => void;
};

function fmtMap(map: Record<string, number | undefined>): string {
  const entries = Object.entries(map).filter(([, v]) => typeof v === "number" && v !== 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${k}`).join(", ");
}

export default function DoctrinePanel({ state, stage, catalog, onChoose }: Props) {
  if (!stage.doctrineUnlocked) return null;
  const doctrines = catalog.doctrines.filter(
    (d) => d.enabled && d.stage_min <= stage.id,
  );
  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Doctrine</span>
        <span className="harbor-panel__hint">
          {state.doctrine ? "Chosen" : "Choose your harbor's identity"}
        </span>
      </div>
      {doctrines.map((d) => {
        const isChosen = state.doctrine === d.slug;
        return (
          <article key={d.slug} className="harbor-card">
            <div className="harbor-card__title">{d.name}</div>
            {d.description && (
              <div className="harbor-card__desc">{d.description}</div>
            )}
            <div className="harbor-card__row">
              {d.extra.permanent_metric_effects &&
                Object.keys(d.extra.permanent_metric_effects).length > 0 && (
                  <span className="harbor-chip harbor-chip--good">
                    Permanent: {fmtMap(d.extra.permanent_metric_effects)}
                  </span>
                )}
              {isChosen && (
                <span className="harbor-chip harbor-chip--good">Chosen</span>
              )}
            </div>
            <div className="harbor-actions">
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                disabled={state.doctrine !== null}
                onClick={() => onChoose(d.slug)}
              >
                {isChosen ? "Active" : "Adopt"}
              </button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
