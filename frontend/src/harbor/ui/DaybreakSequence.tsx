/**
 * After the cinematic, surface "what changed overnight" in three beats:
 *   1. New Day card (always shown).
 *   2. Each new event presented one at a time.
 *   3. Each new arrival presented one at a time.
 * Player taps "Continue" to advance; the parent calls `onDone()` when finished.
 */

import { useState } from "react";

import type {
  ArrivalSnapshot,
  EventSnapshot,
  StageDef,
} from "../engine/types";

type Props = {
  day: number;
  stage: StageDef;
  newEvents: EventSnapshot[];
  newArrivals: ArrivalSnapshot[];
  dailyReportLines?: string[];
  businessReportLines?: string[];
  onDone: () => void;
};

type Step =
  | { kind: "newDay" }
  | { kind: "event"; event: EventSnapshot; index: number; total: number }
  | { kind: "arrival"; arrival: ArrivalSnapshot; index: number; total: number };

function buildSteps(
  newEvents: EventSnapshot[],
  newArrivals: ArrivalSnapshot[],
): Step[] {
  const steps: Step[] = [{ kind: "newDay" }];
  newEvents.forEach((event, i) =>
    steps.push({ kind: "event", event, index: i, total: newEvents.length }),
  );
  newArrivals.forEach((arrival, i) =>
    steps.push({
      kind: "arrival",
      arrival,
      index: i,
      total: newArrivals.length,
    }),
  );
  return steps;
}

export default function DaybreakSequence({
  day,
  stage,
  newEvents,
  newArrivals,
  dailyReportLines = [],
  businessReportLines = [],
  onDone,
}: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const steps = buildSteps(newEvents, newArrivals);
  const step = steps[stepIdx];

  function next() {
    if (stepIdx >= steps.length - 1) {
      onDone();
    } else {
      setStepIdx((v) => v + 1);
    }
  }

  if (!step) {
    return null;
  }

  let title = "";
  let body = "";
  let hint = "";
  if (step.kind === "newDay") {
    title = `Day ${day} dawns over the ${stage.title}.`;
    body = (stage.coreTension ?? "").trim();
    hint = (stage.ageQuestion ?? "").trim() || "Tap to continue";
  } else if (step.kind === "event") {
    title = step.event.name;
    body = step.event.description;
    hint = `New event ${step.index + 1} of ${step.total}`;
  } else {
    title = step.arrival.name;
    body = step.arrival.description;
    hint = `New arrival ${step.index + 1} of ${step.total}`;
  }

  return (
    <div
      className="harbor-daybreak"
      onClick={next}
      role="presentation"
    >
      <div className="harbor-daybreak__card">
        <div className="harbor-daybreak__day">{hint}</div>
        <div className="harbor-daybreak__title">{title}</div>
        {body && <div className="harbor-daybreak__hint">{body}</div>}
        {step.kind === "newDay" && dailyReportLines.length > 0 && (
          <div
            className="harbor-daybreak__hint"
            style={{ textAlign: "left", marginTop: "0.5rem" }}
          >
            <strong>Daily report</strong>
            <ul style={{ margin: "0.35rem 0 0 1rem", padding: 0 }}>
              {dailyReportLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        {step.kind === "newDay" && businessReportLines.length > 0 && (
          <div
            className="harbor-daybreak__hint"
            style={{ textAlign: "left", marginTop: "0.5rem" }}
          >
            <strong>Business report</strong>
            <ul style={{ margin: "0.35rem 0 0 1rem", padding: 0 }}>
              {businessReportLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="button"
          className="harbor-button harbor-button--accent harbor-daybreak__continue"
          onClick={(e) => {
            e.stopPropagation();
            next();
          }}
        >
          {stepIdx >= steps.length - 1 ? "Begin" : "Continue"}
        </button>
      </div>
    </div>
  );
}
