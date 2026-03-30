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

function isConsentRequiredError(err: unknown): boolean {
  return getErrorMessage(err).includes("Consent required");
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
    getAccessTokenWithPopup,
    logout: auth0Logout,
  } = useAuth0();

  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  const hasInitialized = useRef(false);
  const lastAuth0Sub = useRef<string | null>(null);

  const bootstrapSession = useCallback(async () => {
    if (!isAuthenticated || !auth0User) return;

    setIsBootstrapping(true);
    setBootstrapError(null);

    try {
      const token = await (async (): Promise<string> => {
        try {
          return await getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
              scope: "openid profile email",
            },
          });
        } catch (err: unknown) {
          if (isConsentRequiredError(err)) {
            const popupToken = await getAccessTokenWithPopup({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
                scope: "openid profile email",
              },
            });

            if (!popupToken) {
              throw new Error("No access token returned from popup auth.");
            }

            return popupToken;
          }

          throw err;
        }
      })();

      const response = await fetch(
        `${apiBase()}/api/v1/users/sync-profile/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
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
    getAccessTokenWithPopup,
    isAuthenticated,
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
      if (isConsentRequiredError(err)) {
        const popupToken = await getAccessTokenWithPopup({
          authorizationParams: {
            audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
            scope: "openid profile email",
          },
        });
        if (!popupToken) {
          throw new Error("No access token returned from popup auth.");
        }
        return popupToken;
      }
      throw err;
    }
  }, [getAccessTokenSilently, getAccessTokenWithPopup]);

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
        credentials: "include",
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

  const logout = useCallback(() => {
    setSessionUser(null);
    setAccessToken(null);
    setBootstrapError(null);
    hasInitialized.current = false;
    lastAuth0Sub.current = null;
    clearCachedSession();

    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }, [auth0Logout]);

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
      refreshSession,
      updateProfileLocally,
      patchMyProfile,
      logout,
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
      refreshSession,
      updateProfileLocally,
      patchMyProfile,
      logout,
    ],
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}
