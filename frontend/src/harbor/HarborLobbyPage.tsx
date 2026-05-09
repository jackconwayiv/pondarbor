/**
 * Harbormaster lobby: one save slot — Continue, Delete, or Start.
 */

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import {
  createHarborGame,
  deleteHarborGame,
  fetchHarborCatalog,
  fetchHarborGameState,
  listHarborGames,
  normalizeHarborState,
  pickActiveHarborGame,
  type HarborGameSummary,
} from "./api";
import { getStageDef, hydrateStageUnlocksFromCatalog } from "./stages";
import "./harborStyles.css";

export default function HarborLobbyPage() {
  const { loginWithRedirect } = useAuth0();
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    getApiAccessToken,
    sessionUser,
  } = useAppSession();
  const navigate = useNavigate();
  const [games, setGames] = useState<HarborGameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** True after first click on Delete; only "Confirm delete" completes removal. */
  const [deleteArmed, setDeleteArmed] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const [newHarborName, setNewHarborName] = useState("");
  const [resumeLine, setResumeLine] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getApiAccessToken();
    const body = await listHarborGames(token);
    setGames(body.games);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load harbors."),
    );
  }, [isAuthenticated, refresh]);

  const activeGame = useMemo(
    () => (games == null ? null : pickActiveHarborGame(games)),
    [games],
  );

  useEffect(() => {
    if (!activeGame || !isAuthenticated) {
      setResumeLine(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const token = await getApiAccessToken();
        const cat = await fetchHarborCatalog(token);
        hydrateStageUnlocksFromCatalog(cat.stage_unlocks);
        const resp = await fetchHarborGameState(token, activeGame.id);
        if (cancelled) return;
        const st = resp.state
          ? normalizeHarborState(resp.state, cat, 1)
          : null;
        if (!st) {
          setResumeLine(activeGame.name);
          return;
        }
        const sd = getStageDef(st.stageId);
        setResumeLine(
          `${activeGame.name} · Age ${st.stageId} (${sd.title}) · Day ${st.day} · Population ${Math.round(st.metrics.population ?? 0)}`,
        );
      } catch {
        if (!cancelled) setResumeLine(activeGame.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeGame, isAuthenticated, getApiAccessToken]);

  useEffect(() => {
    if (!deleteArmed) return;
    const onPointerDown = (event: PointerEvent) => {
      const t = event.target as Node | null;
      if (!t) return;
      if (confirmDeleteButtonRef.current?.contains(t)) return;
      setDeleteArmed(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [deleteArmed]);

  useEffect(() => {
    setDeleteArmed(false);
  }, [activeGame?.id]);

  const handleStart = useCallback(() => {
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        const token = await getApiAccessToken();
        const name = (newHarborName.trim() || "Harbor").slice(0, 15);
        await createHarborGame(token, name);
        navigate("/harbor/play");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start harbor.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [getApiAccessToken, navigate, newHarborName]);

  if (sessionLoading) {
    return (
      <div className="harbor-route harbor-route--lobby">
        <div className="harbor-route__inner harbor-route__inner--lobby">
          <LobbyHero />
          <div className="harbor-panel harbor-lobby__panel">
            <span className="harbor-panel__hint harbor-lobby__loading">
              Loading your office…
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="harbor-route harbor-route--lobby">
        <div className="harbor-route__inner harbor-route__inner--lobby">
          <LobbyHero />
          <div className="harbor-panel harbor-lobby__panel">
            <h2 className="harbor-lobby__section-title">Welcome</h2>
            <p className="harbor-lobby-intro harbor-lobby-intro--standalone">
              Sign in to manage your docks, fleets, and a growing harbor —
              pick up wherever you left off.
            </p>
            <div className="harbor-lobby__actions harbor-lobby__actions--solo">
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
      </div>
    );
  }

  return (
    <div className="harbor-route harbor-route--lobby">
      <div className="harbor-route__inner harbor-route__inner--lobby">
        <LobbyHero />
        {sessionUser?.user?.is_staff ? (
          <p className="harbor-lobby__staff">
            <Link to="/harbor/staff" className="harbor-lobby__staff-link">
              Catalog editor
            </Link>
          </p>
        ) : null}
        <div className="harbor-panel harbor-lobby__panel">
          {error ? (
            <p className="harbor-lobby__error" role="alert">
              {error}
            </p>
          ) : null}
          {games == null ? (
            <span className="harbor-panel__hint harbor-lobby__loading">
              Fetching your save…
            </span>
          ) : activeGame == null ? (
            <div className="harbor-lobby__body harbor-stack harbor-stack--loose">
              <h2 className="harbor-lobby__section-title harbor-lobby__section-title--muted">
                New Harbormaster
              </h2>
              <p className="harbor-lobby-intro">
                Harbormaster is a turn-based harbor building game — you steer
                traffic to and from your berths, send ships for cargo and wealth,
                and expand with buildings as ages unfold.
              </p>
              <div className="harbor-lobby__divider" aria-hidden />
              <p className="harbor-lobby-intro harbor-lobby-intro--cta">
                Name your harbor below, then step into your office.
              </p>
              <label className="harbor-lobby-label">
                Harbor name
                <input
                  type="text"
                  className="harbor-lobby-input"
                  maxLength={15}
                  value={newHarborName}
                  placeholder="e.g. Saltmere Bay"
                  onChange={(e) => setNewHarborName(e.target.value)}
                  disabled={busy}
                  autoComplete="off"
                />
              </label>
              <div className="harbor-lobby__actions">
                <button
                  type="button"
                  className="harbor-button harbor-button--accent"
                  disabled={busy}
                  onClick={handleStart}
                >
                  Start Harbor
                </button>
              </div>
            </div>
          ) : (
            <div className="harbor-lobby__body harbor-stack harbor-stack--loose">
              <h2 className="harbor-lobby__section-title">Welcome back</h2>
              <p className="harbor-lobby-intro harbor-lobby-intro--muted">
                Your office is waiting. Continue your run or start fresh.
              </p>
              <div className="harbor-lobby__resume" role="region" aria-label="Saved game">
                <p className="harbor-lobby__resume-line">
                  {resumeLine ??
                    `${activeGame.name} · last played ${new Date(activeGame.updated_at).toLocaleString()}`}
                </p>
              </div>
              <div className="harbor-lobby__actions">
                <Link
                  to="/harbor/play"
                  className="harbor-button harbor-button--accent harbor-lobby__continue"
                  onClick={() => setDeleteArmed(false)}
                >
                  Continue
                </Link>
                <button
                  ref={confirmDeleteButtonRef}
                  type="button"
                  className="harbor-button harbor-button--ghost"
                  disabled={busy}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!deleteArmed) {
                      setDeleteArmed(true);
                      return;
                    }
                    void (async () => {
                      setBusy(true);
                      setError(null);
                      try {
                        const token = await getApiAccessToken();
                        await deleteHarborGame(token, activeGame.id);
                        setDeleteArmed(false);
                        await refresh();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Delete failed.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    })();
                  }}
                >
                  {deleteArmed ? "Confirm delete" : "Delete save"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LobbyHero() {
  return (
    <header className="harbor-lobby__hero">
      <p className="harbor-lobby__eyebrow">Calm waters · big choices</p>
      <h1 className="harbor-lobby__title">⚓ Harbormaster</h1>
      <p className="harbor-lobby__tagline">
        Take command of trade, berth by berth — at your pace, whenever you drop
        anchor.
      </p>
    </header>
  );
}
