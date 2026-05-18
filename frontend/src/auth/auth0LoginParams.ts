import type { AuthorizationParams, RedirectLoginOptions } from "@auth0/auth0-react";

import { auth0ApiAudience, auth0SlackConnectionName as slackConnection } from "./publicConfig";
import { safeAuthReturnTo } from "./safeAuthReturnTo";

const base = (): Pick<AuthorizationParams, "audience" | "scope"> => ({
  audience: auth0ApiAudience(),
  scope: "openid profile email",
});

/** Auth0 social connection name for Slack (Authentication → Social → Slack). */
export function auth0SlackConnectionName(): string | undefined {
  return slackConnection();
}

/**
 * Slack "Sign in with Slack" (OIDC) via Auth0. Must request `openid` or Auth0 will not
 * issue an id_token; the React SDK will then not mark the user as authenticated after redirect.
 * (Legacy Slack connections that only use `identity.*` cannot use this — keep those on a
 * separate connection / Auth0 config.)
 */
function slackOidcAuthorizationParams(extra: Partial<AuthorizationParams>): AuthorizationParams {
  return { ...base(), ...extra };
}

/** Log in with Slack via Auth0 (returns null if `VITE_AUTH0_SLACK_CONNECTION` is unset). */
export function auth0SlackLoginAuthorizationParams(): AuthorizationParams | null {
  const connection = auth0SlackConnectionName();
  if (!connection) return null;
  return slackOidcAuthorizationParams({ connection });
}

/** Sign up with Slack via Auth0 (returns null if connection is unset). */
export function auth0SlackSignupAuthorizationParams(): AuthorizationParams | null {
  const connection = auth0SlackConnectionName();
  if (!connection) return null;
  return slackOidcAuthorizationParams({ connection, screen_hint: "signup" });
}

/**
 * Normal Log in — no `prompt` so SSO can reuse the last session quickly.
 * Do not add `prompt` to Auth0Provider defaults or getAccessTokenSilently.
 */
export function auth0LoginAuthorizationParams(
  extra?: Partial<AuthorizationParams>,
): AuthorizationParams {
  return {
    ...base(),
    ...extra,
  };
}

/** Sign up flow on Universal Login. */
export function auth0SignupAuthorizationParams(
  extra?: Partial<AuthorizationParams>,
): AuthorizationParams {
  return auth0LoginAuthorizationParams({
    ...extra,
    screen_hint: "signup",
  });
}

/**
 * Switch-user flow only — ask the IdP account chooser.
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
