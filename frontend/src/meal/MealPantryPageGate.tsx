import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";

export function MealPantryPageGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, sessionUser, refreshSession } = useAppSession();

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) return <MealApprovalRequired />;

  return <>{children}</>;
}
