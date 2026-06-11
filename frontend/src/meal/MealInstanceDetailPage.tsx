import { Box, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import { APP_TEXT_SIZES, PANEL_ENTRY_CARD_PROPS } from "../theme/typography";
import { fetchInstance } from "./api";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { MealPlanInstance } from "./types";

/** Legacy `/meal/plan/plans/:id` → week editor by `week_start`. */
export default function MealInstanceDetailPage() {
  const { id } = useParams();
  const iid = id ? Number(id) : Number.NaN;
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [inst, setInst] = useState<MealPlanInstance | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = await getApiAccessToken();
    const instance = await fetchInstance(t, iid);
    setInst(instance);
  }, [getApiAccessToken, iid]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !Number.isFinite(iid)) return;
    const timer = window.setTimeout(() => {
      void load().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, iid, load]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }
  if (!Number.isFinite(iid)) {
    return (
      <Box {...PANEL_ENTRY_CARD_PROPS} w="100%">
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="medium"
          color="nautical.solid"
          role="alert"
        >
          Invalid week plan.
        </Text>
      </Box>
    );
  }
  if (!inst) {
    return err ? (
      <Box {...PANEL_ENTRY_CARD_PROPS} w="100%">
        <Text
          fontSize={APP_TEXT_SIZES.helper}
          fontWeight="medium"
          color="nautical.solid"
          role="alert"
        >
          {err}
        </Text>
      </Box>
    ) : (
      <MealLoading />
    );
  }

  return (
    <Navigate
      to={`/meal/plan/plans/new?week=${encodeURIComponent(inst.week_start)}`}
      replace
    />
  );
}
