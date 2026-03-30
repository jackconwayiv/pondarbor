import type { AuthorizationParams } from "@auth0/auth0-react";

/**
 * Params for interactive login only (loginWithRedirect).
 * Do not add `prompt` to Auth0Provider defaults or getAccessTokenSilently — that breaks silent renewal.
 */
export function auth0InteractiveLoginParams(
  extra?: Partial<AuthorizationParams>,
): AuthorizationParams {
  return {
    audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
    scope: "openid profile email",
    // Ask Google (via Auth0) to show the account chooser when multiple sessions exist.
    prompt: "select_account",
    ...extra,
  };
}
