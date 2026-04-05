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
  auth0AccountPickerLoginParams,
  auth0DefaultLoginParams,
  auth0LoginWithReturnTo,
} from "./auth0LoginParams";

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
  return auth0DefaultLoginParams(
    needsConsent ? { prompt: "consent" } : undefined,
  );
}

function loadCachedSession(): {
  sessionUser: SessionUser;
  accessToken: string | null;
} | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      sessionUser: SessionUser;
      accessToken: string | null;
    };
  } catch {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function saveCachedSession(
  sessionUser: SessionUser,
  accessToken: string | null,
) {
  sessionStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      sessionUser,
      accessToken,
    }),
  );
}

function clearCachedSession() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
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
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const hasInitialized = useRef(false);
  const lastAuth0Sub = useRef<string | null>(null);
  const pickAccountHandledRef = useRef(false);
  /** True while local logout runs — Auth0 can still report authenticated until the client clears, which would otherwise retrigger bootstrap and consent redirects. */
  const isLoggingOutRef = useRef(false);

  const bootstrapSession = useCallback(async () => {
    if (!isAuthenticated || !auth0User || isLoggingOutRef.current) return;

    setIsBootstrapping(true);
    setBootstrapError(null);

    try {
      let token: string;
      try {
        token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
            scope: "openid profile email",
          },
        });
      } catch (err: unknown) {
        if (shouldRecoverTokenWithRedirect(err)) {
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

      const response = await fetch(
        `${apiBase()}/api/v1/users/sync-profile/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          // Avoid sending Django session cookies: SessionAuthentication + POST can trigger CSRF 403.
          credentials: "omit",
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Sync failed (${response.status}): ${text}`);
      }

      const data = (await response.json()) as SessionUser;

      setAccessToken(token);
      setSessionUser(data);
      saveCachedSession(data, token);
      hasInitialized.current = true;
      lastAuth0Sub.current = auth0User.sub ?? null;
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
          audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
          scope: "openid profile email",
        },
      });
    } catch (err: unknown) {
      if (shouldRecoverTokenWithRedirect(err)) {
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

        saveCachedSession(next, accessToken);
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
      setSessionUser(data);
      saveCachedSession(data, token);
    },
    [getApiAccessToken],
  );

  const clearLocalSession = useCallback(() => {
    setSessionUser(null);
    setAccessToken(null);
    setBootstrapError(null);
    hasInitialized.current = false;
    lastAuth0Sub.current = null;
    clearCachedSession();
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
    const returnTo = new URL(window.location.origin);
    returnTo.pathname = "/";
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
      isAuthenticated,
      isLoading: auth0Loading || isBootstrapping || sessionPending,
      error: bootstrapError,
      getApiAccessToken,
      refreshSession,
      updateProfileLocally,
      patchMyProfile,
      logout,
      switchUser,
    }),
    [
      sessionUser,
      auth0User,
      accessToken,
      isAuthenticated,
      auth0Loading,
      isBootstrapping,
      sessionPending,
      bootstrapError,
      getApiAccessToken,
      refreshSession,
      updateProfileLocally,
      patchMyProfile,
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
