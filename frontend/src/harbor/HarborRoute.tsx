/**
 * Harbormaster play route (`/harbor/play/:gameId`).
 *
 * State machine: loading → idle → cinematic → newDay → idle (after end-day).
 */

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import {
  fetchHarborCatalog,
  fetchHarborGameState,
  normalizeHarborState,
  saveHarborGameState,
} from "./api";
import {
  computeAge1VoyagePromisedRewards,
  deriveCommandReserved,
} from "./engine/derive";
import {
  EngineError,
  acceptArrival,
  advanceDay,
  assignDoctrine,
  cancelQueuedAge1Departure,
  createDefaultHarborState,
  declineArrival,
  queueAge1Departure,
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
import ShipUpgradesPanel from "./ui/ShipUpgradesPanel";
import "./harborStyles.css";

type Phase = "loading" | "idle" | "cinematic" | "newDay" | "saving" | "error";

export default function HarborRoute() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, isLoading: sessionLoading, getApiAccessToken } =
    useAppSession();
  const { gameId: gameIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const gameId = gameIdParam ? Number.parseInt(gameIdParam, 10) : Number.NaN;

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
  const [departureCandidate, setDepartureCandidate] = useState<string | null>(
    null,
  );
  const [harborTab, setHarborTab] = useState<"traffic" | "build" | "upgrades">(
    "traffic",
  );
  const stateRef = useRef<HarborState | null>(null);
  stateRef.current = state;

  const initialStageId: StageId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get("stage") ?? "1", 10);
    if (!Number.isFinite(raw)) return 1;
    if (raw < 1 || raw > 12) return 1;
    return raw as StageId;
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !Number.isFinite(gameId)) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");
        const token = await getApiAccessToken();
        const cat = await fetchHarborCatalog(token);
        if (cancelled) return;
        const stateResp = await fetchHarborGameState(token, gameId);
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
  }, [isAuthenticated, getApiAccessToken, gameId, initialStageId]);

  useEffect(() => {
    setHarborTab("traffic");
  }, [gameId]);

  useEffect(() => {
    if (!catalog || !state) return;
    const panels = new Set(getStageDef(state.stageId).panels);
    const hasBuildings = panels.has("buildings");
    const hasUpgrades =
      state.stageId === 1 && (catalog.ship_upgrades?.length ?? 0) > 0;
    if (harborTab === "build" && !hasBuildings) setHarborTab("traffic");
    if (harborTab === "upgrades" && !hasUpgrades) setHarborTab("traffic");
  }, [catalog, state, harborTab]);

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
    (id: string) => apply((s, c) => acceptArrival(s, c, id)),
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
      apply((s, c) => reassignShipBerth(s, c, shipId, target)),
    [apply],
  );

  const handleRequestDeparture = useCallback((shipId: string) => {
    setDepartureCandidate(shipId);
  }, []);

  const handleCancelQueuedDeparture = useCallback(
    (shipId: string) => apply((s) => cancelQueuedAge1Departure(s, shipId)),
    [apply],
  );

  const handleEndDay = useCallback(async () => {
    if (!state || !catalog || !Number.isFinite(gameId)) return;
    const result = advanceDay(state, catalog);
    setDayResult(result);
    setState(result.state);
    setPhase("cinematic");
    setSaveStatus("saving");
    try {
      const token = await getApiAccessToken();
      await saveHarborGameState(token, gameId, result.state);
      setSaveStatus("saved");
      setLastSavedDay(result.state.day);
    } catch (e) {
      setSaveStatus("error");
      setTransient(
        e instanceof Error ? `Save failed: ${e.message}` : "Save failed.",
      );
    }
  }, [state, catalog, getApiAccessToken, gameId]);

  const onCinematicDone = useCallback(() => setPhase("newDay"), []);
  const onDaybreakDone = useCallback(() => {
    setPhase("idle");
    setDayResult(null);
  }, []);

  if (!Number.isFinite(gameId)) {
    return (
      <div className="harbor-route">
        <div className="harbor-route__inner">
          <div className="harbor-panel">
            <span className="harbor-panel__title">Invalid harbor</span>
            <p style={{ marginTop: "0.5rem" }}>
              <Link to="/harbor" className="harbor-lobby-link">
                ← Back to lobby
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

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
            <p style={{ marginTop: "0.5rem" }}>
              <Link to="/harbor">← Back to lobby</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const stage = getStageDef(state.stageId);
  const visiblePanels = new Set(stage.panels);
  const showBuildingsTab = visiblePanels.has("buildings");
  const showUpgradesTab =
    state.stageId === 1 && (catalog.ship_upgrades?.length ?? 0) > 0;
  const showHarborTabs = showBuildingsTab || showUpgradesTab;
  const cinematicActive = phase === "cinematic" || phase === "newDay";
  const reserved = deriveCommandReserved(state);
  const canEndDay =
    !cinematicActive && state.command >= reserved && state.command >= 0;
  const saveHint =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "error"
        ? "Save failed — changes kept locally"
        : lastSavedDay != null
          ? `Progress saves when you end the day · last saved after day ${lastSavedDay}`
          : "Progress saves when you end the day";

  const depShip = departureCandidate
    ? state.ships.find((s) => s.id === departureCandidate)
    : null;
  const depDef = depShip
    ? catalog.ships.find((s) => s.slug === depShip.defSlug)
    : null;
  const depYield =
    departureCandidate && depShip
      ? computeAge1VoyagePromisedRewards(state, catalog, departureCandidate)
      : {};
  const yieldHint = Object.entries(depYield)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k, v]) => {
      const sym =
        k === "food" ? "🐟" : k === "timber" ? "🪵" : k === "wealth" ? "🪙" : "";
      return `${sym} +${v} ${k}`;
    })
    .join(" · ");

  return (
    <div className="harbor-route">
      <div className="harbor-route__inner">
        <p style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
          <Link to="/harbor" style={{ color: "var(--harbor-info)" }}>
            ← Harbor lobby
          </Link>
        </p>
        <Hud
          state={state}
          stage={stage}
          onEndDay={() => void handleEndDay()}
          canEndDay={canEndDay}
          saveHint={saveHint}
        />

        {transient && (
          <div className="harbor-panel">
            <span className="harbor-chip harbor-chip--bad">{transient}</span>
          </div>
        )}

        {state.activeEvents.length > 0 && (
          <EventsPanel state={state} onResolve={handleResolveEvent} />
        )}

        {showHarborTabs ? (
          <div className="harbor-main-tabs" role="tablist" aria-label="Harbor view">
            <button
              type="button"
              role="tab"
              aria-selected={harborTab === "traffic"}
              className={`harbor-main-tabs__btn${harborTab === "traffic" ? " harbor-main-tabs__btn--active" : ""}`}
              onClick={() => setHarborTab("traffic")}
            >
              Harbor Traffic
            </button>
            {showBuildingsTab ? (
              <button
                type="button"
                role="tab"
                aria-label="Buildings"
                aria-selected={harborTab === "build"}
                className={`harbor-main-tabs__btn${harborTab === "build" ? " harbor-main-tabs__btn--active" : ""}`}
                onClick={() => setHarborTab("build")}
              >
                🏗️
              </button>
            ) : null}
            {showUpgradesTab ? (
              <button
                type="button"
                role="tab"
                aria-label="Ship upgrades"
                aria-selected={harborTab === "upgrades"}
                className={`harbor-main-tabs__btn${harborTab === "upgrades" ? " harbor-main-tabs__btn--active" : ""}`}
                onClick={() => setHarborTab("upgrades")}
              >
                🚢
              </button>
            ) : null}
          </div>
        ) : null}

        {(!showHarborTabs || harborTab === "traffic") && (
          <>
            <BerthBoard
              state={state}
              catalog={catalog}
              onReassign={handleReassign}
              onRequestDeparture={
                state.stageId === 1 ? handleRequestDeparture : undefined
              }
              onCancelQueuedDeparture={
                state.stageId === 1 ? handleCancelQueuedDeparture : undefined
              }
              readOnly={cinematicActive}
            />

            {visiblePanels.has("operations") && (
              <OperationsPanel
                state={state}
                catalog={catalog}
                onStart={handleStartOperation}
              />
            )}

            {visiblePanels.has("arrivals") && state.stageId > 1 && (
              <ArrivalsPanel
                state={state}
                onAccept={handleAcceptArrival}
                onDecline={handleDeclineArrival}
              />
            )}
          </>
        )}

        {showBuildingsTab && harborTab === "build" ? (
          <BuildingsPanel
            state={state}
            catalog={catalog}
            onUpgrade={handleUpgradeBuilding}
          />
        ) : null}

        {showUpgradesTab && harborTab === "upgrades" ? (
          <ShipUpgradesPanel state={state} catalog={catalog} onApply={apply} />
        ) : null}

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
      </div>

      {departureCandidate && depShip && (
        <div
          className="harbor-daybreak"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dep-title"
        >
          <div className="harbor-daybreak__card">
            <div id="dep-title" className="harbor-daybreak__title">
              Confirm departure
            </div>
            <div className="harbor-daybreak__hint">
              {depDef?.name ?? depShip.defSlug}: costs 1 command at end of day,
              spends {Math.max(1, depDef?.extra.voyage_nights ?? 1)} night
              {depDef?.extra.voyage_nights === 1 ? "" : "s"} at sea (returns next
              open day), yields promised cargo when berthed.
              {yieldHint ? (
                <>
                  <br />
                  <strong>Promised yield:</strong> {yieldHint}
                </>
              ) : null}
            </div>
            <div className="harbor-row" style={{ justifyContent: "center" }}>
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                onClick={() => {
                  apply((s, c) => queueAge1Departure(s, c, departureCandidate));
                  setDepartureCandidate(null);
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="harbor-button"
                onClick={() => setDepartureCandidate(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "cinematic" && <EndDayCinematic onDone={onCinematicDone} />}
      {phase === "newDay" && dayResult && (
        <DaybreakSequence
          day={state.day}
          stage={stage}
          newEvents={dayResult.newEvents as EventSnapshot[]}
          newArrivals={dayResult.newArrivals as ArrivalSnapshot[]}
          dailyReportLines={dayResult.dailyReportLines}
          businessReportLines={dayResult.businessReportLines}
          onDone={onDaybreakDone}
        />
      )}
    </div>
  );
}
