/**
 * Harbormaster game route.
 *
 * Owns the load → play → save loop. State machine:
 *   loading → idle → cinematic → newDay → idle (after end-day)
 * The engine in `engine/rules.ts` is pure; this component is the only
 * place that calls `Math.random` (via `advanceDay`) and IO (save/load).
 */

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import {
  fetchHarborCatalog,
  fetchHarborState,
  normalizeHarborState,
  saveHarborState,
} from "./api";
import {
  EngineError,
  acceptArrival,
  advanceDay,
  assignDoctrine,
  createDefaultHarborState,
  declineArrival,
  reassignShipBerth,
  resolveEvent,
  startOperation,
  togglePolicy,
  upgradeBuilding,
  type DayResult,
} from "./engine/rules";
import type {
  ArrivalSnapshot,
  EventSnapshot,
  HarborCatalog,
  HarborState,
  StageId,
} from "./engine/types";
import { getStageDef } from "./stages";
import ArrivalsPanel from "./ui/ArrivalsPanel";
import BerthBoard from "./ui/BerthBoard";
import BuildingsPanel from "./ui/BuildingsPanel";
import DaybreakSequence from "./ui/DaybreakSequence";
import DoctrinePanel from "./ui/DoctrinePanel";
import EndDayCinematic from "./ui/EndDayCinematic";
import EventsPanel from "./ui/EventsPanel";
import Hud from "./ui/Hud";
import LogPanel from "./ui/LogPanel";
import OperationsPanel from "./ui/OperationsPanel";
import PoliciesPanel from "./ui/PoliciesPanel";
import "./harborStyles.css";

type Phase = "loading" | "idle" | "cinematic" | "newDay" | "saving" | "error";

export default function HarborRoute() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, isLoading: sessionLoading, getApiAccessToken } =
    useAppSession();
  const [searchParams] = useSearchParams();

  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [transient, setTransient] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<HarborCatalog | null>(null);
  const [state, setState] = useState<HarborState | null>(null);
  const [dayResult, setDayResult] = useState<DayResult | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedDay, setLastSavedDay] = useState<number | null>(null);
  const stateRef = useRef<HarborState | null>(null);
  stateRef.current = state;

  const initialStageId: StageId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get("stage") ?? "1", 10);
    if (!Number.isFinite(raw)) return 1;
    if (raw < 1 || raw > 12) return 1;
    return raw as StageId;
  }, [searchParams]);

  // Load catalog + state on mount.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");
        const token = await getApiAccessToken();
        const cat = await fetchHarborCatalog(token);
        if (cancelled) return;
        const stateResp = await fetchHarborState(token);
        if (cancelled) return;
        const normalized = stateResp.state
          ? normalizeHarborState(stateResp.state, cat, initialStageId)
          : createDefaultHarborState(initialStageId, cat);
        setCatalog(cat);
        setState(normalized);
        setPhase("idle");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load harbor.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getApiAccessToken, initialStageId]);

  /** Apply a synchronous engine transition; clears transient toast. */
  const apply = useCallback(
    (mutate: (s: HarborState, c: HarborCatalog) => HarborState) => {
      setError(null);
      setTransient(null);
      setState((prev) => {
        if (!prev || !catalog) return prev;
        try {
          return mutate(prev, catalog);
        } catch (e) {
          if (e instanceof EngineError) {
            setTransient(e.message);
          } else {
            setTransient(e instanceof Error ? e.message : "Action failed.");
          }
          return prev;
        }
      });
    },
    [catalog],
  );

  const handleAcceptArrival = useCallback(
    (id: string) =>
      apply((s, c) => acceptArrival(s, c, id)),
    [apply],
  );
  const handleDeclineArrival = useCallback(
    (id: string) => apply((s) => declineArrival(s, id)),
    [apply],
  );
  const handleResolveEvent = useCallback(
    (id: string) => apply((s) => resolveEvent(s, id)),
    [apply],
  );
  const handleStartOperation = useCallback(
    (slug: string, shipId: string | null) =>
      apply((s, c) => startOperation(s, c, slug, shipId)),
    [apply],
  );
  const handleUpgradeBuilding = useCallback(
    (slug: string) => apply((s, c) => upgradeBuilding(s, c, slug)),
    [apply],
  );
  const handleTogglePolicy = useCallback(
    (slug: string) => apply((s, c) => togglePolicy(s, c, slug)),
    [apply],
  );
  const handleChooseDoctrine = useCallback(
    (slug: string) => apply((s, c) => assignDoctrine(s, c, slug)),
    [apply],
  );
  const handleReassign = useCallback(
    (shipId: string, target: number | null) =>
      apply((s) => reassignShipBerth(s, shipId, target)),
    [apply],
  );

  const handleEndDay = useCallback(async () => {
    if (!state || !catalog) return;
    const result = advanceDay(state, catalog);
    setDayResult(result);
    setState(result.state);
    setPhase("cinematic");
    setSaveStatus("saving");
    try {
      const token = await getApiAccessToken();
      await saveHarborState(token, result.state);
      setSaveStatus("saved");
      setLastSavedDay(result.state.day);
    } catch (e) {
      setSaveStatus("error");
      setTransient(
        e instanceof Error ? `Save failed: ${e.message}` : "Save failed.",
      );
    }
  }, [state, catalog, getApiAccessToken]);

  const onCinematicDone = useCallback(() => setPhase("newDay"), []);
  const onDaybreakDone = useCallback(() => {
    setPhase("idle");
    setDayResult(null);
  }, []);

  if (sessionLoading || phase === "loading") {
    return (
      <div className="harbor-route">
        <div className="harbor-route__inner">
          <div className="harbor-panel">
            <span className="harbor-panel__title">Loading harbor…</span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="harbor-route">
        <div className="harbor-route__inner">
          <div className="harbor-panel">
            <div className="harbor-panel__header">
              <span className="harbor-panel__title">Harbormaster</span>
            </div>
            <p style={{ marginBottom: "0.75rem" }}>
              Sign in to take command of your harbor.
            </p>
            <button
              type="button"
              className="harbor-button harbor-button--accent"
              onClick={() =>
                void loginWithRedirect({
                  authorizationParams: auth0LoginAuthorizationParams(),
                })
              }
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error" || !state || !catalog) {
    return (
      <div className="harbor-route">
        <div className="harbor-route__inner">
          <div className="harbor-panel">
            <span className="harbor-panel__title">Could not load Harbormaster</span>
            <p style={{ color: "var(--harbor-text-dim)", marginTop: "0.5rem" }}>
              {error ?? "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stage = getStageDef(state.stageId);
  const visiblePanels = new Set(stage.panels);
  const cinematicActive = phase === "cinematic" || phase === "newDay";

  return (
    <div className="harbor-route">
      <div className="harbor-route__inner">
        <Hud state={state} stage={stage} catalog={catalog} />

        {transient && (
          <div className="harbor-panel">
            <span className="harbor-chip harbor-chip--bad">{transient}</span>
          </div>
        )}

        {state.activeEvents.length > 0 && (
          <EventsPanel state={state} onResolve={handleResolveEvent} />
        )}

        <BerthBoard
          state={state}
          stage={stage}
          catalog={catalog}
          onReassign={handleReassign}
          readOnly={cinematicActive}
        />

        {visiblePanels.has("operations") && (
          <OperationsPanel
            state={state}
            catalog={catalog}
            onStart={handleStartOperation}
          />
        )}

        {visiblePanels.has("arrivals") && (
          <ArrivalsPanel
            state={state}
            onAccept={handleAcceptArrival}
            onDecline={handleDeclineArrival}
          />
        )}

        {visiblePanels.has("buildings") && (
          <BuildingsPanel
            state={state}
            catalog={catalog}
            onUpgrade={handleUpgradeBuilding}
          />
        )}

        {visiblePanels.has("policies") && (
          <PoliciesPanel
            state={state}
            catalog={catalog}
            onToggle={handleTogglePolicy}
          />
        )}

        {visiblePanels.has("doctrine") && (
          <DoctrinePanel
            state={state}
            stage={stage}
            catalog={catalog}
            onChoose={handleChooseDoctrine}
          />
        )}

        <LogPanel state={state} />

        <div className="harbor-end-day">
          <div>
            <button
              type="button"
              className="harbor-end-day__button"
              onClick={() => void handleEndDay()}
              disabled={cinematicActive}
            >
              End day {state.day} →
            </button>
            <span className="harbor-end-day__hint">
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "error"
                  ? "Save failed — changes kept locally"
                  : lastSavedDay != null
                    ? `Progress saves when you end the day · last saved after day ${lastSavedDay}`
                    : "Progress saves when you end the day"}
            </span>
          </div>
        </div>
      </div>

      {phase === "cinematic" && <EndDayCinematic onDone={onCinematicDone} />}
      {phase === "newDay" && dayResult && (
        <DaybreakSequence
          day={state.day}
          stage={stage}
          newEvents={dayResult.newEvents as EventSnapshot[]}
          newArrivals={dayResult.newArrivals as ArrivalSnapshot[]}
          onDone={onDaybreakDone}
        />
      )}
    </div>
  );
}
