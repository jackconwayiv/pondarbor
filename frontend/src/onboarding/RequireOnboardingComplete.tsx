import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import RouteLoadingFallback from "../RouteLoadingFallback";
import { useAppSession } from "../auth/AppSessionContext";
import { shouldWaitForOnboardingServerSync } from "./onboardingGateSync";
import { resolveOnboardingPath } from "./onboardingSteps";

export function RequireOnboardingComplete({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, sessionUser, sessionSyncedFromServer } =
    useAppSession();
  const location = useLocation();

  if (isLoading) {
    return <RouteLoadingFallback />;
  }

  if (
    shouldWaitForOnboardingServerSync(
      isAuthenticated,
      sessionUser,
      sessionSyncedFromServer,
    )
  ) {
    return <RouteLoadingFallback />;
  }

  if (!isAuthenticated || !sessionUser) {
    return <>{children}</>;
  }

  const onOnboarding = location.pathname.startsWith("/onboarding");
  const completed = sessionUser.profile.onboarding_completed === true;

  if (completed && onOnboarding) {
    return <Navigate to="/" replace />;
  }

  if (!completed && !onOnboarding) {
    return <Navigate to={resolveOnboardingPath(sessionUser.profile)} replace />;
  }

  return <>{children}</>;
}
