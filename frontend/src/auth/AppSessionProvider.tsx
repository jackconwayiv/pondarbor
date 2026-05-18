import { useAuth0 } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppSessionContext,
  type AppSessionContextValue,
  type Profile,
  type SessionUser,
  type ProfilePatch,
} from "./AppSessionContext";
import {
  fetchBootstrapSession,
  fetchApprovedCheck,
  mapApiBootstrapInbox,
  type BootstrapInboxSnapshot,
} from "../users/api";

import {
  auth0AccountPickerLoginParams,
  auth0LoginAuthorizationParams,
  auth0LoginWithReturnTo,
} from "./auth0LoginParams";
import { auth0ApiAudience } from "./publicConfig";

type AppSessionProviderProps = {
  children: ReactNode;
};

const SESSION_STORAGE_KEY = "pondarbor.app-session";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

function getOAuthErrorCode(err: unknown): string | null {
  if (
    err &&
    typeof err === "object" &&
    "error" in err &&
    typeof (err as { error: unknown }).error === "string"
  ) {
    return (err as { error: string }).error;
  }
  return null;
}

/**
 * Silent token fetch failed in a way that should be resolved with a full-page
 * Auth0 redirect — never popups (blocked `window.open`, consent, login required, etc.).
 */
function shouldRecoverTokenWithRedirect(err: unknown): boolean {
  const msg = getErrorMessage(err);
  if (msg.includes("Consent required")) return true;
  if (/loginWithPopup|window\.open returned\s*`null`|popup_open/i.test(msg)) {
    return true;
  }
  const code = getOAuthErrorCode(err);
  if (
    code === "login_required" ||
    code === "consent_required" ||
    code === "popup_open"
  ) {
    return true;
  }
  return false;
}

function authorizationParamsForTokenRecovery(err: unknown) {
  const msg = getErrorMessage(err);
  const code = getOAuthErrorCode(err);
  const needsConsent =
    msg.includes("Consent required") || code === "consent_required";
  return auth0LoginAuthorizationParams(
    needsConsent ? { prompt: "consent" } : undefined,
  );
}

type StoredAppSession = {
  sessionUser: SessionUser;
  accessToken: string | null;
  bootstrapInbox?: BootstrapInboxSnapshot;
  bootstrapInboxFetchedAt?: number;
};

/** Persists across mobile tab/process churn better than `sessionStorage` alone (Auth0 already uses `localstorage`). */
function readRawCachedSession(): string | null {
  try {
    const fromLocal = localStorage.getItem(SESSION_STORAGE_KEY);
    if (fromLocal) return fromLocal;
    const fromSession = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (fromSession) {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, fromSession);
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        /* ignore quota / private mode */
      }
      return fromSession;
    }
    return null;
  } catch {
    return null;
  }
}

function loadCachedSession(): StoredAppSession | null {
  const raw = readRawCachedSession();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAppSession>;
    if (!parsed.sessionUser) return null;
    return {
      sessionUser: parsed.sessionUser,
      accessToken: parsed.accessToken ?? null,
      bootstrapInbox: parsed.bootstrapInbox,
      bootstrapInboxFetchedAt: parsed.bootstrapInboxFetchedAt,
    };
  } catch {
    clearCachedSession();
    return null;
  }
}

function saveCachedSession(data: StoredAppSession) {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function clearCachedSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function AppSessionProvider({ children }: AppSessionProviderProps) {
  const {
    isLoading: auth0Loading,
    isAuthenticated,
    user: auth0User,
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout,
  } = useAuth0();

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [bootstrapInboxSnapshot, setBootstrapInboxSnapshot] =
    useState<BootstrapInboxSnapshot | null>(null);
  const [bootstrapInboxFetchedAt, setBootstrapInboxFetchedAt] = useState<
    number | null
  >(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const hasInitialized = useRef(false);
  const lastAuth0Sub = useRef<string | null>(null);
  const pickAccountHandledRef = useRef(false);
  /** True while local logout runs — Auth0 can still report authenticated until the client clears, which would otherwise retrigger bootstrap and consent redirects. */
  const isLoggingOutRef = useRef(false);
  /**
   * After social / OIDC login, `getAccessTokenSilently` can fail with consent_required while
   * we still trigger one full `loginWithRedirect` recovery. Without a cap, that can loop forever.
   */
  const tokenRecoveryRedirectCountRef = useRef(0);

  const bootstrapSession = useCallback(async () => {
    if (!isAuthenticated || !auth0User || isLoggingOutRef.current) return;

    setIsBootstrapping(true);
    setBootstrapError(null);

    try {
      let token: string;
      try {
        token = await getAccessTokenSilently({
          authorizationParams: {
            audience: auth0ApiAudience(),
          },
        });
      } catch (err: unknown) {
        if (shouldRecoverTokenWithRedirect(err)) {
          if (tokenRecoveryRedirectCountRef.current >= 1) {
            setIsBootstrapping(false);
            setBootstrapError(
              "Could not get an API access token after sign-in. In Auth0, open your SPA application and authorize the custom API (audience) for this app, or add the required scopes. Then try logging in again.",
            );
            return;
          }
          tokenRecoveryRedirectCountRef.current += 1;
          setIsBootstrapping(false);
          const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
          void loginWithRedirect(
            auth0LoginWithReturnTo(returnPath, {
              authorizationParams: authorizationParamsForTokenRecovery(err),
            }),
          );
          return;
        }
        throw err;
      }

      const body = await fetchBootstrapSession(token);
      const data = body.session as SessionUser;
      const inboxMapped = mapApiBootstrapInbox(body.inbox);
      const fetchedAt = Date.now();

      setAccessToken(token);
      setSessionUser(data);
      setBootstrapInboxSnapshot(inboxMapped);
      setBootstrapInboxFetchedAt(fetchedAt);
      saveCachedSession({
        sessionUser: data,
        accessToken: token,
        bootstrapInbox: inboxMapped,
        bootstrapInboxFetchedAt: fetchedAt,
      });
      hasInitialized.current = true;
      lastAuth0Sub.current = auth0User.sub ?? null;
      tokenRecoveryRedirectCountRef.current = 0;
    } catch (err: unknown) {
      setBootstrapError(getErrorMessage(err));
      hasInitialized.current = false;
    } finally {
      setIsBootstrapping(false);
    }
  }, [
    auth0User,
    getAccessTokenSilently,
    isAuthenticated,
    loginWithRedirect,
  ]);

  const getApiAccessToken = useCallback(async () => {
    // PATCH endpoints expect a Bearer token for the custom Auth0 auth backend.
    // Avoid relying on the cached `accessToken` state, which can be null/stale.
    try {
      return await getAccessTokenSilently({
        authorizationParams: {
          audience: auth0ApiAudience(),
        },
      });
    } catch (err: unknown) {
      if (shouldRecoverTokenWithRedirect(err)) {
        if (tokenRecoveryRedirectCountRef.current >= 1) {
          throw new Error(
            "Could not refresh API access token. Check Auth0: SPA application has the custom API audience authorized, and any required API scopes are granted for this app.",
          );
        }
        tokenRecoveryRedirectCountRef.current += 1;
        const returnPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        await loginWithRedirect(
          auth0LoginWithReturnTo(returnPath, {
            authorizationParams: authorizationParamsForTokenRecovery(err),
          }),
        );
        return await new Promise<string>(() => {});
      }
      throw err;
    }
  }, [getAccessTokenSilently, loginWithRedirect]);

  useEffect(() => {
    if (auth0Loading) return;
    if (isAuthenticated) {
      pickAccountHandledRef.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("reauth") !== "pick_account") return;
    if (pickAccountHandledRef.current) return;
    pickAccountHandledRef.current = true;
    params.delete("reauth");
    const q = params.toString();
    const path = `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", path);
    void loginWithRedirect({
      authorizationParams: auth0AccountPickerLoginParams(),
    });
  }, [auth0Loading, isAuthenticated, loginWithRedirect]);

  useEffect(() => {
    if (auth0Loading) return;

    if (!isAuthenticated) {
      setSessionUser(null);
      setAccessToken(null);
      setBootstrapInboxSnapshot(null);
      setBootstrapInboxFetchedAt(null);
      setBootstrapError(null);
      hasInitialized.current = false;
      lastAuth0Sub.current = null;
      clearCachedSession();
      return;
    }

    const currentSub = auth0User?.sub ?? null;
    if (
      lastAuth0Sub.current &&
      currentSub &&
      lastAuth0Sub.current !== currentSub
    ) {
      setSessionUser(null);
      setAccessToken(null);
      setBootstrapInboxSnapshot(null);
      setBootstrapInboxFetchedAt(null);
      setBootstrapError(null);
      hasInitialized.current = false;
      clearCachedSession();
    }

    // Recover stale state: ref says initialized but React has no session (e.g. cache cleared).
    if (hasInitialized.current && !sessionUser && !bootstrapError) {
      hasInitialized.current = false;
      clearCachedSession();
    }

    if (hasInitialized.current) return;

    const cached = loadCachedSession();
    if (cached) {
      setSessionUser(cached.sessionUser);
      setAccessToken(cached.accessToken);
      setBootstrapInboxSnapshot(cached.bootstrapInbox ?? null);
      setBootstrapInboxFetchedAt(cached.bootstrapInboxFetchedAt ?? null);
      hasInitialized.current = true;
      lastAuth0Sub.current = currentSub;
      return;
    }

    // After a failed sync, bootstrapError is set; do not hammer the API every effect run.
    if (bootstrapError) return;

    if (isLoggingOutRef.current) return;

    void bootstrapSession();
  }, [auth0Loading, isAuthenticated, auth0User, bootstrapSession, sessionUser, bootstrapError]);

  const refreshSession = useCallback(async () => {
    hasInitialized.current = false;
    clearCachedSession();
    await bootstrapSession();
  }, [bootstrapSession]);

  const resyncSessionSilently = useCallback(async () => {
    if (!isAuthenticated || !auth0User || isLoggingOutRef.current) return;
    setBootstrapError(null);
    try {
      let token: string;
      try {
        token = await getAccessTokenSilently({
          authorizationParams: {
            audience: auth0ApiAudience(),
          },
        });
      } catch (err: unknown) {
        if (shouldRecoverTokenWithRedirect(err)) {
          return;
        }
        throw err;
      }

      const response = await fetch(
        `${apiBase()}/api/v1/users/sync-profile/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "omit",
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Sync failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as SessionUser;
      const prev = loadCachedSession();
      setAccessToken(token);
      setSessionUser(data);
      saveCachedSession({
        sessionUser: data,
        accessToken: token,
        bootstrapInbox: prev?.bootstrapInbox,
        bootstrapInboxFetchedAt: prev?.bootstrapInboxFetchedAt,
      });
    } catch {
      /* silent: avoid global loading; caller can log if needed */
    }
  }, [auth0User, getAccessTokenSilently, isAuthenticated]);

  const sessionUserRef = useRef<SessionUser | null>(null);
  useEffect(() => {
    sessionUserRef.current = sessionUser;
  }, [sessionUser]);

  const approvalCheckInFlightRef = useRef(false);

  const isPendingApproval =
    isAuthenticated && !!sessionUser && sessionUser.user.account_status === "pending";

  useEffect(() => {
    if (!isPendingApproval) return;

    const runApprovalCheck = async (): Promise<void> => {
      if (approvalCheckInFlightRef.current) return;
      approvalCheckInFlightRef.current = true;

      try {
        if (document.visibilityState !== "visible") return;
        const current = sessionUserRef.current;
        if (!current) return;
        if (current.user.account_status !== "pending") return;

        const token = await getApiAccessToken();
        const approved = await fetchApprovedCheck(token);
        if (!approved) return;

        // First try to refresh without global loading. If the session
        // still looks pending, fall back to full re-bootstrap.
        await resyncSessionSilently();
        const cached = loadCachedSession();
        if (!cached?.sessionUser.user.is_approved) {
          await refreshSession();
        }
      } catch {
        /* silent: pending users should not see errors while waiting */
      } finally {
        approvalCheckInFlightRef.current = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void runApprovalCheck();
    };

    // Run once on load/focus so the user doesn't need a manual reload.
    void runApprovalCheck();
    document.addEventListener("visibilitychange", onVisibilityChange);

    // Poll periodically while pending (captures approvals that happen while the tab is open).
    const intervalId = window.setInterval(() => {
      void runApprovalCheck();
    }, 45_000);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    isPendingApproval,
    getApiAccessToken,
    refreshSession,
    resyncSessionSilently,
  ]);

  const updateProfileLocally = useCallback(
    (patch: Partial<Profile>) => {
      setSessionUser((current) => {
        if (!current) return current;

        const next: SessionUser = {
          ...current,
          profile: {
            ...current.profile,
            ...patch,
          },
        };

        const prev = loadCachedSession();
        saveCachedSession({
          sessionUser: next,
          accessToken,
          bootstrapInbox: prev?.bootstrapInbox,
          bootstrapInboxFetchedAt: prev?.bootstrapInboxFetchedAt,
        });
        return next;
      });
    },
    [accessToken],
  );

  const patchMyProfile = useCallback(
    async (patch: ProfilePatch) => {
      const base = apiBase();
      // Always fetch a fresh token for the PATCH request.
      const token = await getApiAccessToken();
      setAccessToken(token);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(`${base}/api/v1/users/me/profile/`, {
        method: "PATCH",
        headers,
        credentials: "omit",
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Profile update failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as SessionUser;
      const prev = loadCachedSession();
      setSessionUser(data);
      saveCachedSession({
        sessionUser: data,
        accessToken: token,
        bootstrapInbox: prev?.bootstrapInbox,
        bootstrapInboxFetchedAt: prev?.bootstrapInboxFetchedAt,
      });
    },
    [getApiAccessToken],
  );

  const patchAchievementVisibility = useCallback(
    async (slug: string, visibleToFriends: boolean) => {
      const base = apiBase();
      const token = await getApiAccessToken();
      setAccessToken(token);

      const response = await fetch(
        `${base}/api/v1/users/me/achievements/${encodeURIComponent(slug)}/`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify({ visible_to_friends: visibleToFriends }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Achievement visibility update failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as SessionUser;
      const prev = loadCachedSession();
      setSessionUser(data);
      saveCachedSession({
        sessionUser: data,
        accessToken: token,
        bootstrapInbox: prev?.bootstrapInbox,
        bootstrapInboxFetchedAt: prev?.bootstrapInboxFetchedAt,
      });
    },
    [getApiAccessToken],
  );

  const clearLocalSession = useCallback(() => {
    setSessionUser(null);
    setAccessToken(null);
    setBootstrapInboxSnapshot(null);
    setBootstrapInboxFetchedAt(null);
    setBootstrapError(null);
    hasInitialized.current = false;
    lastAuth0Sub.current = null;
    clearCachedSession();
    tokenRecoveryRedirectCountRef.current = 0;
  }, []);

  const logout = useCallback(async () => {
    isLoggingOutRef.current = true;
    clearLocalSession();
    try {
      // Do not redirect to Auth0 `/v2/logout`: that ends the Auth0 SSO session and
      // forces Universal Login again. Local-only logout keeps Google/IdP + Auth0
      // sessions so the next `loginWithRedirect` can resume SSO.
      await auth0Logout({ openUrl: false });
    } finally {
      isLoggingOutRef.current = false;
    }
  }, [auth0Logout, clearLocalSession]);

  const switchUser = useCallback(() => {
    clearLocalSession();
    const returnTo = new URL("/", window.location.href);
    returnTo.searchParams.set("reauth", "pick_account");
    auth0Logout({
      logoutParams: {
        returnTo: returnTo.toString(),
      },
    });
  }, [auth0Logout, clearLocalSession]);

  const sessionPending =
    isAuthenticated &&
    !!auth0User &&
    !sessionUser &&
    !bootstrapError;

  const value: AppSessionContextValue = useMemo(
    () => ({
      sessionUser,
      auth0User: auth0User ?? null,
      accessToken,
      bootstrapInboxSnapshot,
      bootstrapInboxFetchedAt,
      isAuthenticated,
      isLoading: auth0Loading || isBootstrapping || sessionPending,
      error: bootstrapError,
      getApiAccessToken,
      refreshSession,
      resyncSessionSilently,
      updateProfileLocally,
      patchMyProfile,
      patchAchievementVisibility,
      logout,
      switchUser,
    }),
    [
      sessionUser,
      auth0User,
      accessToken,
      bootstrapInboxSnapshot,
      bootstrapInboxFetchedAt,
      isAuthenticated,
      auth0Loading,
      isBootstrapping,
      sessionPending,
      bootstrapError,
      getApiAccessToken,
      refreshSession,
      resyncSessionSilently,
      updateProfileLocally,
      patchMyProfile,
      patchAchievementVisibility,
      logout,
      switchUser,
    ],
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}
