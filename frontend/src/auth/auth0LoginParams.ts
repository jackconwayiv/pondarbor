import type { AuthorizationParams } from "@auth0/auth0-react";

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
