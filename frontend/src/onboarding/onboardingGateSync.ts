import type { SessionUser } from "../auth/AppSessionContext";

export function profileOnboardingConfirmedInCache(
  sessionUser: SessionUser | null | undefined,
): boolean {
  return sessionUser?.profile.onboarding_completed === true;
}

/** Hold onboarding redirects until the server confirms status (unless cache already says complete). */
export function shouldWaitForOnboardingServerSync(
  isAuthenticated: boolean,
  sessionUser: SessionUser | null | undefined,
  sessionSyncedFromServer: boolean,
): boolean {
  if (!isAuthenticated || !sessionUser) return false;
  if (sessionSyncedFromServer) return false;
  if (profileOnboardingConfirmedInCache(sessionUser)) return false;
  return true;
}
