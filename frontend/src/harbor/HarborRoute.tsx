/**
 * Harbormaster play route (`/harbor/play`).
 *
 * State machine: loading → idle → cinematic → newDay → idle (after end-day).
 */

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import {
  fetchHarborCatalog,
  fetchHarborGameState,
  listHarborGames,
  normalizeHarborState,
  pickActiveHarborGame,
  saveHarborGameState,
} from "./api";
import {
  deriveEffectiveBerthCap,
  deriveTotalCommandReserved,
} from "./engine/derive";
import {
  EngineError,
  acceptArrival,
  advanceDay,
  assignDoctrine,
  cancelQueuedAge1Departure,
  createDefaultHarborState,
  declineArrival,
  dismissMorningReport,
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
  ShipDefExtra,
  StageId,
} from "./engine/types";
import { getStageDef, hydrateStageUnlocksFromCatalog } from "./stages";
import ArrivalsPanel from "./ui/ArrivalsPanel";
import BerthBoard from "./ui/BerthBoard";
import BuildingsPanel from "./ui/BuildingsPanel";
import DaybreakSequence from "./ui/DaybreakSequence";
import DoctrinePanel from "./ui/DoctrinePanel";
import EndDayCinematic from "./ui/EndDayCinematic";
import EventsPanel from "./ui/EventsPanel";
import Hud from "./ui/Hud";
import HarborAtAGlancePanel from "./ui/HarborAtAGlancePanel";
import LogPanel from "./ui/LogPanel";
import ObjectivesPanel from "./ui/ObjectivesPanel";
import OperationsPanel from "./ui/OperationsPanel";
import PoliciesPanel from "./ui/PoliciesPanel";
import ShipUpgradesPanel from "./ui/ShipUpgradesPanel";
import "./harborStyles.css";

type Phase = "loading" | "idle" | "cinematic" | "newDay" | "saving" | "error";

function catalogShowsShipwrightTab(
  catalog: HarborCatalog,
  stageId: StageId,
): boolean {
  if (stageId !== 1) return false;
  if ((catalog.ship_upgrades?.length ?? 0) > 0) return true;
  return catalog.ships.some(
    (s) =>
      s.enabled &&
      s.stage_min <= stageId &&
      (s.stage_max == null || s.stage_max >= stageId) &&
      (s.extra as ShipDefExtra).shipwright_purchase != null,
  );
}

export default function HarborRoute() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, isLoading: sessionLoading, getApiAccessToken } =
    useAppSession();
  const [searchParams] = useSearchParams();
  /** Resolved after listing saves — same “active” rule as the lobby. */
  const [gameId, setGameId] = useState<number | null>(null);
  const [harborGameName, setHarborGameName] = useState("");
  const [noHarborSave, setNoHarborSave] = useState(false);

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
  const [endDayConfirmOpen, setEndDayConfirmOpen] = useState(false);
  const [harborTab, setHarborTab] = useState<
    "traffic" | "build" | "upgrades" | "objectives" | "log" | "help"
  >("traffic");
  const briefingResumeRef = useRef(false);
  const stateRef = useRef<HarborState | null>(null);
  stateRef.current = state;

  const initialStageId: StageId = useMemo(() => {
    const raw = Number.parseInt(searchParams.get("stage") ?? "1", 10);
    if (!Number.isFinite(raw)) return 1;
    if (raw < 1 || raw > 12) return 1;
    return raw as StageId;
  }, [searchParams]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("loading");
        setNoHarborSave(false);
        setGameId(null);
        setHarborGameName("");
        setError(null);
        const token = await getApiAccessToken();
        const cat = await fetchHarborCatalog(token);
        hydrateStageUnlocksFromCatalog(cat.stage_unlocks);
        if (cancelled) return;
        const { games } = await listHarborGames(token);
        if (cancelled) return;
        const active = pickActiveHarborGame(games);
        if (!active) {
          setNoHarborSave(true);
          setPhase("idle");
          return;
        }
        setGameId(active.id);
        setHarborGameName(active.name);
        const stateResp = await fetchHarborGameState(token, active.id);
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

  useEffect(() => {
    setHarborTab("traffic");
    briefingResumeRef.current = false;
  }, [gameId]);

  useEffect(() => {
    if (!isAuthenticated) setGameId(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!state || !catalog || phase !== "idle") return;
    if (briefingResumeRef.current) return;
    const pm = state.pendingMorningReport;
    if (!pm || pm.gameDay !== state.day) return;
    briefingResumeRef.current = true;
    setDayResult({
      state,
      newEvents: pm.newEvents,
      newArrivals: pm.newArrivals,
      resolvedOperations: [],
      dailyReportLines: pm.dailyReportLines,
      businessReportLines: pm.businessReportLines,
    });
    setPhase("newDay");
  }, [state, catalog, phase]);

  useEffect(() => {
    if (!catalog || !state) return;
    const panels = new Set(getStageDef(state.stageId).panels);
    const hasBuildings = panels.has("buildings");
    const hasUpgrades = catalogShowsShipwrightTab(catalog, state.stageId);
    if (harborTab === "build" && !hasBuildings) setHarborTab("traffic");
    if (harborTab === "upgrades" && !hasUpgrades) setHarborTab("traffic");
  }, [catalog, state, harborTab]);

  const affordableBuildings = useMemo(() => {
    if (!catalog || !state) return 0;
    const panels = new Set(getStageDef(state.stageId).panels);
    if (!panels.has("buildings")) return 0;
    let n = 0;
    for (const def of catalog.buildings) {
      if (
        !def.enabled ||
        def.stage_min > state.stageId ||
        (def.stage_max != null && def.stage_max < state.stageId)
      ) {
        continue;
      }
      const owned = state.buildings.find((b) => b.slug === def.slug);
      const level = owned?.level ?? 0;
      const maxLevel =
        def.extra.max_level ?? def.extra.level_costs?.length ?? 1;
      if (level >= maxLevel) continue;
      const nextCost = def.extra.level_costs?.[level] ?? {};
      const insufficient = Object.entries(nextCost).some(
        ([k, v]) => (state.resources as Record<string, number>)[k] < (v as number),
      );
      if (!insufficient && state.command >= 1) n += 1;
    }
    return n;
  }, [catalog, state]);

  const affordableUpgrades = useMemo(() => {
    if (!catalog || !state || state.stageId !== 1) return 0;
    let n = 0;
    const upgrades = catalog.ship_upgrades ?? [];
    for (const up of upgrades) {
      const cost = up.extra.cost ?? {};
      const insufficient = Object.entries(cost).some(
        ([k, v]) => (state.resources as Record<string, number>)[k] < (v as number),
      );
      const shipOk = state.ships.some(
        (s) =>
          (s.status === "mooring" || s.status === "berthed") &&
          !(s.attachments ?? []).includes(up.slug),
      );
      if (!insufficient && state.command >= 1 && shipOk) n += 1;
    }
    const cap = deriveEffectiveBerthCap(state, catalog);
    const slotsUsed =
      state.ships.length + (state.pendingHullOrders ?? []).length;
    const berthOk = slotsUsed < cap;
    for (const def of catalog.ships) {
      if (
        !def.enabled ||
        def.stage_min > state.stageId ||
        (def.stage_max != null && def.stage_max < state.stageId)
      ) {
        continue;
      }
      const purchase = (def.extra as ShipDefExtra).shipwright_purchase;
      if (!purchase) continue;
      const cost = purchase.cost ?? {};
      const insufficient = Object.entries(cost).some(
        ([k, v]) => (state.resources as Record<string, number>)[k] < (v as number),
      );
      const cmdCost = Math.max(0, Math.floor(purchase.command ?? 1));
      if (!insufficient && state.command >= cmdCost && berthOk) n += 1;
    }
    return n;
  }, [catalog, state]);

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

  const handleQueueDeparture = useCallback(
    (shipId: string) => apply((s, c) => queueAge1Departure(s, c, shipId)),
    [apply],
  );

  const handleCancelQueuedDeparture = useCallback(
    (shipId: string) => apply((s) => cancelQueuedAge1Departure(s, shipId)),
    [apply],
  );

  const performEndDay = useCallback(async () => {
    if (!state || !catalog || gameId === null) return;
    setEndDayConfirmOpen(false);
    setHarborTab("traffic");
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

  const handleEndDayClick = useCallback(() => {
    if (!state || !catalog || gameId === null) return;
    const reserved = deriveTotalCommandReserved(state);
    const unspent = state.command - reserved;
    if (unspent > 0) {
      setEndDayConfirmOpen(true);
      return;
    }
    void performEndDay();
  }, [state, catalog, gameId, performEndDay]);

  useEffect(() => {
    if (!endDayConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEndDayConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [endDayConfirmOpen]);

  const onCinematicDone = useCallback(() => setPhase("newDay"), []);
  const onDaybreakDone = useCallback(() => {
    setState((prev) => (prev ? dismissMorningReport(prev) : prev));
    setPhase("idle");
    setDayResult(null);
    setHarborTab("traffic");
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

  if (isAuthenticated && noHarborSave) {
    return (
      <div className="harbor-route">
        <div className="harbor-route__inner">
          <div className="harbor-panel">
            <span className="harbor-panel__title">No harbor yet</span>
            <p style={{ marginTop: "0.5rem", color: "var(--harbor-text-dim)" }}>
              Start from your harbormaster&apos;s office first.
            </p>
            <p style={{ marginTop: "0.75rem" }}>
              <Link to="/harbor" className="harbor-lobby-link">
                ← Office (lobby)
              </Link>
            </p>
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
  const showUpgradesTab = catalogShowsShipwrightTab(catalog, state.stageId);
  const cinematicActive = phase === "cinematic" || phase === "newDay";
  const reserved = deriveTotalCommandReserved(state);
  const unspentCommand = Math.max(0, state.command - reserved);
  const canEndDay =
    !cinematicActive && state.command >= reserved && state.command >= 0;
  const saveHint =
    saveStatus === "saving"
      ? "Saving…"
      : saveStatus === "error"
        ? "Save failed — changes kept locally"
        : "";

  return (
    <div className="harbor-route">
      <div className="harbor-route__inner">
        <Hud
          state={state}
          stage={stage}
          catalog={catalog}
          harborName={harborGameName.trim() || "Harbor"}
          onEndDay={() => void handleEndDayClick()}
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

        <div className="harbor-main-tabs" role="tablist" aria-label="Harbor view">
            <button
              type="button"
              role="tab"
              aria-label="Harbor traffic"
              aria-selected={harborTab === "traffic"}
              className={`harbor-main-tabs__btn${harborTab === "traffic" ? " harbor-main-tabs__btn--active" : ""}`}
              onClick={() => setHarborTab("traffic")}
            >
              ⚓
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
                {affordableBuildings > 0 ? ` (${affordableBuildings})` : ""}
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
                {affordableUpgrades > 0 ? ` (${affordableUpgrades})` : ""}
              </button>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-label="Objectives"
              aria-selected={harborTab === "objectives"}
              className={`harbor-main-tabs__btn${harborTab === "objectives" ? " harbor-main-tabs__btn--active" : ""}`}
              onClick={() => setHarborTab("objectives")}
            >
              🎯
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Harbor log"
              aria-selected={harborTab === "log"}
              className={`harbor-main-tabs__btn${harborTab === "log" ? " harbor-main-tabs__btn--active" : ""}`}
              onClick={() => setHarborTab("log")}
            >
              📜
            </button>
            <button
              type="button"
              role="tab"
              aria-label="How to Play"
              aria-selected={harborTab === "help"}
              className={`harbor-main-tabs__btn${harborTab === "help" ? " harbor-main-tabs__btn--active" : ""}`}
              onClick={() => setHarborTab("help")}
            >
              ❓
            </button>
          </div>

        {harborTab === "traffic" && (
          <>
            <BerthBoard
              state={state}
              catalog={catalog}
              onReassign={handleReassign}
              onQueueDeparture={
                state.stageId === 1 ? handleQueueDeparture : undefined
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

        {harborTab === "objectives" ? (
          <ObjectivesPanel state={state} catalog={catalog} stage={stage} />
        ) : null}

        {harborTab === "log" ? <LogPanel state={state} /> : null}

        {harborTab === "help" ? <HarborAtAGlancePanel /> : null}

        {harborTab !== "log" &&
          harborTab !== "help" &&
          harborTab !== "objectives" &&
          visiblePanels.has("policies") && (
          <PoliciesPanel
            state={state}
            catalog={catalog}
            onToggle={handleTogglePolicy}
          />
        )}

        {harborTab !== "log" &&
          harborTab !== "help" &&
          harborTab !== "objectives" &&
          visiblePanels.has("doctrine") && (
          <DoctrinePanel
            state={state}
            stage={stage}
            catalog={catalog}
            onChoose={handleChooseDoctrine}
          />
        )}
      </div>

      {endDayConfirmOpen ? (
        <div
          className="harbor-end-confirm"
          role="presentation"
          onClick={() => setEndDayConfirmOpen(false)}
        >
          <div
            className="harbor-end-confirm__card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="harbor-end-confirm-title"
          >
            <p id="harbor-end-confirm-title" className="harbor-end-confirm__title">
              End the day?
            </p>
            <p className="harbor-end-confirm__body">
              You still have{" "}
              <strong>
                {unspentCommand} command (⚓)
              </strong>{" "}
              that has not yet been spent on harbor activities. Would you like to
              end the day anyway?
            </p>
            <div className="harbor-end-confirm__actions">
              <button
                type="button"
                className="harbor-button harbor-button--ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setEndDayConfirmOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                onClick={(e) => {
                  e.stopPropagation();
                  void performEndDay();
                }}
              >
                End Day
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {phase === "cinematic" && <EndDayCinematic onDone={onCinematicDone} />}
      {phase === "newDay" && dayResult && (
        <DaybreakSequence
          day={state.day}
          stage={stage}
          newEvents={dayResult.newEvents as EventSnapshot[]}
          newArrivals={dayResult.newArrivals as ArrivalSnapshot[]}
          dailyReportLines={dayResult.dailyReportLines}
          businessReportLines={dayResult.businessReportLines}
          gameSaved={saveStatus === "saved" && lastSavedDay === state.day}
          dayOneTips={
            state.day === 1
              ? [
                  "Drag ships between mooring, arrivals, and berths — in Age 1, most moves cost no anchors.",
                  "Out to sea holds your queue, voyages, laden returns (LADEN), and sometimes a new empty hull waiting for a berth — that is not on voyage; drag it to a berth when you have room.",
                  "Cargo banks on end-day only after one full day tied up; each unload that fires spends one anchor.",
                  "Buildings and upgrades spend an anchor when you commission them.",
                ]
              : undefined
          }
          onDone={onDaybreakDone}
        />
      )}
    </div>
  );
}
