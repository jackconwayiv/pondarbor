import { Box, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
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

export function PantryRecipesDisabledHint() {
  return (
    <Box>
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        Turn on pantry tracking on the{" "}
        <RouterLink to="/meal/pantry/inventory">
          <Text as="span" color="teal.solid" fontWeight="bold">
            Inventory
          </Text>
        </RouterLink>{" "}
        tab to match recipes against what you have.
      </Text>
    </Box>
  );
}

export function PantryRecipesStatus({
  profilePantryOn,
  pantryEnabled,
  busy,
  loadErr,
  onRetry,
  children,
}: {
  profilePantryOn: boolean;
  pantryEnabled: boolean;
  busy: boolean;
  loadErr: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (!profilePantryOn) return <PantryRecipesDisabledHint />;

  if (!pantryEnabled && !busy) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
        Pantry is off on the server. Try enabling it on Inventory or refresh.
      </Text>
    );
  }

  if (loadErr) {
    return (
      <Stack gap="2" align="flex-start">
        <Text fontSize={APP_TEXT_SIZES.body} color="red.fg">
          {loadErr}
        </Text>
        <PondButton size="sm" colorPalette="lilypad" onClick={onRetry}>
          Retry
        </PondButton>
      </Stack>
    );
  }

  if (busy) return <MealLoading />;

  return <>{children}</>;
}
