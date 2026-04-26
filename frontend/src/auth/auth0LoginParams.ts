import type { AuthorizationParams, RedirectLoginOptions } from "@auth0/auth0-react";

import { safeAuthReturnTo } from "./safeAuthReturnTo";

const base = (): Pick<AuthorizationParams, "audience" | "scope"> => ({
  audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
  scope: "openid profile email",
});

/** Auth0 social connection name for Slack (Authentication → Social → Slack). */
export function auth0SlackConnectionName(): string | undefined {
  const raw = import.meta.env.VITE_AUTH0_SLACK_CONNECTION;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t || undefined;
}

function slackOnlyAuthorizationParams(extra: Partial<AuthorizationParams>): AuthorizationParams {
  const audienceRaw = import.meta.env.VITE_AUTH0_API_AUDIENCE;
  const audience =
    typeof audienceRaw === "string" && audienceRaw.trim() ? audienceRaw.trim() : undefined;
  // Do not pass `scope: "openid profile email"` with `connection: slack` — Auth0 + legacy
  // Slack identity scopes treat OIDC scopes differently and Slack may reject the authorize URL.
  const params: AuthorizationParams = { ...extra };
  if (audience) params.audience = audience;
  return params;
}

/** Log in with Slack via Auth0 (returns null if `VITE_AUTH0_SLACK_CONNECTION` is unset). */
export function auth0SlackLoginAuthorizationParams(): AuthorizationParams | null {
  const connection = auth0SlackConnectionName();
  if (!connection) return null;
  return slackOnlyAuthorizationParams({ connection });
}

/** Sign up with Slack via Auth0 (returns null if connection is unset). */
export function auth0SlackSignupAuthorizationParams(): AuthorizationParams | null {
  const connection = auth0SlackConnectionName();
  if (!connection) return null;
  return slackOnlyAuthorizationParams({ connection, screen_hint: "signup" });
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
