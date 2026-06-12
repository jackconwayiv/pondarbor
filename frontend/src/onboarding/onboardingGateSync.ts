import type { SessionUser } from "../auth/AppSessionContext";

/** Hold onboarding redirects until POST /users/bootstrap/ (or equivalent) has run. */
export function shouldWaitForOnboardingServerSync(
  isAuthenticated: boolean,
  sessionUser: SessionUser | null | undefined,
  sessionSyncedFromServer: boolean,
): boolean {
  return isAuthenticated && !!sessionUser && !sessionSyncedFromServer;
}
