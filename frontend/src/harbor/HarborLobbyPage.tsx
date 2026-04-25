/**
 * Harbormaster lobby: one save slot — Continue, Delete (confirm), or Start.
 */

import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import {
  createHarborGame,
  deleteHarborGame,
  listHarborGames,
  type HarborGameSummary,
} from "./api";
import "./harborStyles.css";

function pickActiveGame(games: HarborGameSummary[]): HarborGameSummary | null {
  if (games.length === 0) return null;
  return [...games].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0]!;
}

export default function HarborLobbyPage() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, isLoading: sessionLoading, getApiAccessToken } =
    useAppSession();
  const navigate = useNavigate();
  const [games, setGames] = useState<HarborGameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** True after first click on Delete; only "Confirm delete" completes removal. */
  const [deleteArmed, setDeleteArmed] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

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
    () => (games == null ? null : pickActiveGame(games)),
    [games],
  );

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
        const row = await createHarborGame(token, "Harbor");
        navigate(`/harbor/play/${row.id}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start harbor.",
        );
      } finally {
        setBusy(false);
      }
    })();
  }, [getApiAccessToken, navigate]);

  if (sessionLoading) {
    return (
      <div className="harbor-route">
        <div className="harbor-route__inner">
          <div className="harbor-panel">
            <span className="harbor-panel__title">Loading…</span>
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
              Sign in to play Harbormaster.
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

  return (
    <div className="harbor-route">
      <div className="harbor-route__inner">
        <div className="harbor-panel">
          <div className="harbor-panel__header">
            <span className="harbor-panel__title">Harbormaster</span>
          </div>
          {error && (
            <p style={{ color: "var(--harbor-bad, #c44)", marginBottom: "0.5rem" }}>
              {error}
            </p>
          )}
          {games == null ? (
            <span className="harbor-panel__hint">Loading…</span>
          ) : activeGame == null ? (
            <div className="harbor-stack">
              <p className="harbor-panel__hint" style={{ margin: 0 }}>
                No save yet — start a new harbor.
              </p>
              <button
                type="button"
                className="harbor-button harbor-button--accent"
                disabled={busy}
                onClick={handleStart}
              >
                Start
              </button>
            </div>
          ) : (
            <div className="harbor-stack">
              <p className="harbor-panel__hint" style={{ margin: 0 }}>
                {activeGame.name} · last played{" "}
                {new Date(activeGame.updated_at).toLocaleString()}
              </p>
              <div className="harbor-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <Link
                  to={`/harbor/play/${activeGame.id}`}
                  className="harbor-button harbor-button--accent"
                  style={{ textDecoration: "none" }}
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
                  {deleteArmed ? "Confirm delete" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
