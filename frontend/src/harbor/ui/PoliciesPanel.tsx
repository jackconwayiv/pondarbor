import { useMemo } from "react";

import {
  eligiblePolicyDefs,
  groupPoliciesByExclusiveGroup,
  policyByGroup,
} from "../engine/derive";
import type { HarborCatalog, HarborState } from "../engine/types";

type Props = {
  state: HarborState;
  catalog: HarborCatalog;
  onToggle: (slug: string) => void;
};

function fmtMap(map: Record<string, number | undefined>): string {
  const entries = Object.entries(map).filter(([, v]) => typeof v === "number" && v !== 0);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${v! > 0 ? "+" : ""}${v} ${k}`).join(", ");
}

export default function PoliciesPanel({ state, catalog, onToggle }: Props) {
  const eligible = useMemo(
    () => eligiblePolicyDefs(state, catalog),
    [state, catalog],
  );
  const groups = groupPoliciesByExclusiveGroup(eligible);
  const activeByGroup = policyByGroup(state, catalog);

  if (eligible.length === 0) return null;

  return (
    <section className="harbor-panel">
      <div className="harbor-panel__header">
        <span className="harbor-panel__title">Enact a harbor policy</span>
        <span className="harbor-panel__hint">
          {state.activePolicies.length} active
        </span>
      </div>
      {[...groups.entries()].map(([groupName, defs]) => {
        const activeSlug = activeByGroup.get(groupName);
        return (
          <div key={groupName} className="harbor-stack" style={{ marginBottom: "0.6rem" }}>
            <div className="harbor-panel__hint">Group: {groupName}</div>
            {defs.map((def) => {
              const isActive = activeSlug === def.slug;
              const cost = def.extra.command_cost_to_toggle ?? 0;
              return (
                <article key={def.slug} className="harbor-card">
                  <div className="harbor-card__title">{def.name}</div>
                  {def.description && (
                    <div className="harbor-card__desc">{def.description}</div>
                  )}
                  <div className="harbor-card__row">
                    {def.extra.per_day_metric_effects &&
                      Object.keys(def.extra.per_day_metric_effects).length > 0 && (
                        <span className="harbor-chip harbor-chip--info">
                          /day: {fmtMap(def.extra.per_day_metric_effects)}
                        </span>
                      )}
                    {cost > 0 && <span className="harbor-chip">{cost} ⚓</span>}
                    {isActive && (
                      <span className="harbor-chip harbor-chip--good">Active</span>
                    )}
                  </div>
                  <div className="harbor-actions">
                    <button
                      type="button"
                      className={`harbor-button ${isActive ? "" : "harbor-button--accent"}`}
                      disabled={state.command < cost}
                      onClick={() => onToggle(def.slug)}
                    >
                      {isActive ? "Lift" : "Enact"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
