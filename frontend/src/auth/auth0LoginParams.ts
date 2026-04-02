import type { AuthorizationParams, RedirectLoginOptions } from "@auth0/auth0-react";

import { safeAuthReturnTo } from "./safeAuthReturnTo";

const base = (): Pick<AuthorizationParams, "audience" | "scope"> => ({
  audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
  scope: "openid profile email",
});

/**
 * Normal Log in / Sign up — no `prompt` so SSO can reuse the last session quickly.
 * Do not add `prompt` to Auth0Provider defaults or getAccessTokenSilently.
 */
export function auth0DefaultLoginParams(
  extra?: Partial<AuthorizationParams>,
): AuthorizationParams {
  return {
    ...base(),
    ...extra,
  };
}

/**
 * Switch-user flow only — ask Google (via Auth0) for the account chooser.
 */
export function auth0AccountPickerLoginParams(
  extra?: Partial<AuthorizationParams>,
): AuthorizationParams {
  return {
    ...base(),
    prompt: "select_account",
    ...extra,
  };
}

/**
 * Merge into `loginWithRedirect(...)` so Auth0 returns the user to a safe in-app path
 * after Universal Login (via SDK default `onRedirectCallback` or our router-aware one).
 */
export function auth0LoginWithReturnTo(
  returnPath: string,
  extra?: RedirectLoginOptions,
): RedirectLoginOptions {
  const safe = safeAuthReturnTo(returnPath) ?? "/";
  return {
    ...extra,
    appState: {
      ...extra?.appState,
      returnTo: safe,
    },
  };
}
