import { getBuildingLevel } from "../engine/derive";
import { AGE1_CONSTRUCTION_DAYS } from "../engine/rules";
import { getStageDef } from "../stages";
import type {
  HarborCatalog,
  HarborState,
  StageDef,
  StageId,
} from "../engine/types";

const AGE1_PROMOTION_SLUGS = ["harbormasters-quarters", "second-berth"] as const;

function buildingName(catalog: HarborCatalog, slug: string): string {
  return catalog.buildings.find((b) => b.slug === slug)?.name ?? slug;
}

function pendingConstructionDays(
  state: HarborState,
  slug: string,
): number | undefined {
  return state.pendingBuildingProjects.find((p) => p.slug === slug)
    ?.remainingDays;
}

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  stage: StageDef;
};

export default function ObjectivesPanel({ state, catalog, stage }: Props) {
  const sid = stage.id;

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Objectives</span>
      </div>

      <div className="harbor-help-howto" role="tabpanel">
        <p className="harbor-help-howto__p" style={{ marginBottom: "1rem" }}>
          <strong>
            Age {sid}: {stage.title}
          </strong>
          <span style={{ color: "var(--harbor-text-dim)" }}>
            {" "}
            · {stage.era}
          </span>
        </p>

        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">Focus this age</h3>
          <p className="harbor-help-howto__p">{stage.mainLesson}</p>
          {stage.ageQuestion ? (
            <p className="harbor-help-howto__p">
              <strong>Question:</strong> {stage.ageQuestion}
            </p>
          ) : null}
          {stage.coreTension ? (
            <p className="harbor-help-howto__p">
              <strong>Tension:</strong> {stage.coreTension}
            </p>
          ) : null}
        </section>

        {sid === 1 ? (
          <section className="harbor-help-howto__block">
            <h3 className="harbor-help-howto__heading">What to do in Dock</h3>
            <ul className="harbor-help-howto__ul">
              <li>
                Organize ships on the traffic board: berth arrivals, queue voyages
                from <strong>Out to sea</strong>, and end the day to advance time.
              </li>
              <li>
                Commission buildings from the 🏗️ tab — in Age 1, construction finishes
                after <strong>{AGE1_CONSTRUCTION_DAYS}</strong> end-day ticks once you
                start a site.
              </li>
              <li>
                When unlocked, use 🚢 Shipwright for hull upgrades that fit your trade
                routes.
              </li>
            </ul>
          </section>
        ) : (
          <section className="harbor-help-howto__block">
            <h3 className="harbor-help-howto__heading">Growing this harbor</h3>
            <p className="harbor-help-howto__p">
              Expand buildings, run operations, manage arrivals and voyages, and watch
              pressures on your metrics. New options appear in the catalog as your stage
              unlocks content tags and mechanics.
            </p>
          </section>
        )}

        <section className="harbor-help-howto__block">
          <h3 className="harbor-help-howto__heading">
            {sid === 12 ? "Endgame" : "Next age"}
          </h3>
          {sid === 1 ? (
            <Age1Promotion state={state} catalog={catalog} />
          ) : sid === 12 ? (
            <p className="harbor-help-howto__p">
              You&apos;ve reached the final stage. When doctrine is unlocked, choose a
              permanent identity for your harbor under{" "}
              <strong>Policies / Doctrine</strong> — then live with the tradeoffs.
            </p>
          ) : (
            <LaterAgesNext currentId={sid as StageId} />
          )}
        </section>
      </div>
    </section>
  );
}

function Age1Promotion({
  state,
  catalog,
}: {
  state: HarborState;
  catalog: HarborCatalog;
}) {
  const next = getStageDef(2);
  const hqOk =
    getBuildingLevel(state, "harbormasters-quarters") >= 1;
  const berthOk = getBuildingLevel(state, "second-berth") >= 1;
  const bothDone = hqOk && berthOk;

  return (
    <>
      <p className="harbor-help-howto__p">
        To reach <strong>{next.title}</strong> (Age 2 · {next.era}), both milestones
        below must reach <strong>level 1</strong>. When construction catches up, the
        harbor promotes automatically — you&apos;ll see it in the log.
      </p>
      <ul className="harbor-help-howto__ul">
        {AGE1_PROMOTION_SLUGS.map((slug) => {
          const done = getBuildingLevel(state, slug) >= 1;
          const pending = pendingConstructionDays(state, slug);
          const label = buildingName(catalog, slug);
          let status: string;
          if (done) {
            status = "Done";
          } else if (pending != null) {
            status =
              pending <= 1
                ? "Finishes next end-day"
                : `${pending} end-days remaining`;
          } else {
            status = "Not yet built to L1";
          }
          return (
            <li key={slug}>
              {done ? "✓" : "○"} <strong>{label}</strong> — {status}
            </li>
          );
        })}
      </ul>
      {bothDone ? (
        <p className="harbor-help-howto__p" style={{ marginTop: "0.75rem" }}>
          Milestones met — if you&apos;re still in Age 1, promotion triggers on the next
          harbor update that applies building completion (for example after an end-day
          tick completes pending work).
        </p>
      ) : null}
    </>
  );
}

function LaterAgesNext({ currentId }: { currentId: StageId }) {
  const next = getStageDef((currentId + 1) as StageId);
  const themes = [next.ageQuestion, next.mainLesson].filter(Boolean);
  return (
    <p className="harbor-help-howto__p">
      The next stage is <strong>{next.title}</strong> ({next.era}). In this build,
      automatic advancement after Dock is not wired — keep developing your harbor and
      watch for updates.
      {themes.length > 0 ? (
        <>
          {" "}
          Themes ahead: {themes.join(" · ")}
        </>
      ) : null}
    </p>
  );
}
