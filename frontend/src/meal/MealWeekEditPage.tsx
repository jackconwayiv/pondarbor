import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createInstance, createMeal, fetchInstances, fetchMeals, patchInstanceGrid } from "./api";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import MealSlotGrid from "./MealSlotGrid";
import { resolveSlotLabels } from "./mealSlotLabels";
import { formatWeekStartShort } from "./mealPlanDates";
import {
  defaultPlanSlots,
  mergedPlanSlots,
  profileMealSlotsPerDay,
} from "./mealPlanSlots";
import { patchMealSlotsPerDay } from "./mealPlanSlotsChange";
import { MealPlanSlotControls } from "./MealPlanSlotControls";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { InstanceSlot, Meal, MealPlanInstance } from "./types";

function hasAnyMeals(slots: InstanceSlot[]): boolean {
  return slots.some((slot) => slot.meal_ids.length > 0);
}

function isValidWeekStartIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function MealWeekEditPage() {
  const [searchParams] = useSearchParams();
  const weekStart = searchParams.get("week") ?? "";
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    refreshSession,
    resyncSessionSilently,
    patchMyProfile,
  } = useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const slotsPerDay = profileMealSlotsPerDay(sessionUser?.profile);

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [i, ml] = await Promise.all([fetchInstances(t), fetchMeals(t)]);
    setInstances(i);
    setMeals(ml);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !isValidWeekStartIso(weekStart)) return;
    setHydrated(false);
    const timer = window.setTimeout(() => {
      void refresh()
        .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"))
        .finally(() => setHydrated(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, weekStart, refresh]);

  const instanceByWeek = useMemo(
    () => new Map(instances.map((inst) => [inst.week_start, inst])),
    [instances],
  );
  const existing = instanceByWeek.get(weekStart) ?? null;
  const slots = mergedPlanSlots(slotsPerDay, draftSlots.length ? draftSlots : (existing?.slots ?? []));

  useEffect(() => {
    if (existing) return;
    setDraftSlots((prev) => (prev.length > 0 ? prev : defaultPlanSlots(slotsPerDay)));
  }, [existing, slotsPerDay]);

  async function persistWeek(nextSlots: InstanceSlot[]) {
    setBusy(true);
    try {
      const tok = await getApiAccessToken();
      const created = await createInstance(tok, { week_start: weekStart });
      const updated = await patchInstanceGrid(tok, created.id, nextSlots);
      setInstances((prev) => [...prev.filter((x) => x.id !== updated.id), updated]);
      navigate(`/meal/plan/plans/${updated.id}`, { replace: true });
      setErr(null);
      void resyncSessionSilently().catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save week failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }
  if (!isValidWeekStartIso(weekStart)) {
    return (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Missing or invalid week. Use a date link from Weekly.
      </Text>
    );
  }
  if (!hydrated) {
    return <MealLoading />;
  }
  if (existing) {
    return <Navigate to={`/meal/plan/plans/${existing.id}`} replace />;
  }

  const slotLabels = resolveSlotLabels(slotsPerDay, sessionUser.profile.meal_slot_labels);

  return (
    <MealEditorBackdropDismiss dismissTo="/meal/plan/overview" disabled={busy}>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
        <Text fontSize={APP_TEXT_SIZES.helper}>
          <RouterLink to="/meal/plan/overview">
            <Text as="span" color="teal.solid" fontWeight="bold">
              ← Weekly overview
            </Text>
          </RouterLink>
        </Text>
        <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
          Unsaved weeks stay local until at least one meal is entered.
        </Text>

        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Stack gap="3">
              <HStack justify="space-between" align="center" flexWrap="wrap" w="100%">
                <Heading size="sm">Week of {formatWeekStartShort(weekStart)}</Heading>
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                  Unsaved week draft
                </Text>
              </HStack>

              <MealPlanSlotControls
                slotsPerDay={slotsPerDay}
                disabled={busy}
                onChange={async (next) => {
                  setBusy(true);
                  try {
                    await patchMealSlotsPerDay(
                      patchMyProfile,
                      next,
                      profileMealSlotsPerDay(sessionUser.profile),
                    );
                    setDraftSlots((prev) => mergedPlanSlots(next, prev.length ? prev : slots));
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : "Could not update meal rows");
                  } finally {
                    setBusy(false);
                  }
                }}
              />

              <MealSlotGrid
                slots={slots}
                slotsPerDay={slotsPerDay}
                weekStartsOn={weekStartsOn}
                weekStartIso={weekStart}
                slotLabels={slotLabels}
                meals={meals}
                disabled={busy}
                createMeal={async (body) => {
                  const tok = await getApiAccessToken();
                  return createMeal(tok, body);
                }}
                onMealCreated={(m) =>
                  setMeals((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
                }
                onCellChange={async (dayIndex, slotIndex, mealIds) => {
                  const nextSlots = slots.map((slot) =>
                    slot.day_index === dayIndex && slot.slot_index === slotIndex
                      ? { ...slot, meal_ids: mealIds }
                      : slot,
                  );
                  setDraftSlots(nextSlots);
                  if (!hasAnyMeals(nextSlots)) return;
                  await persistWeek(nextSlots);
                }}
                onApplySlotToAllDays={async (slotIndex, mealIds) => {
                  const nextSlots = slots.map((slot) =>
                    slot.slot_index === slotIndex ? { ...slot, meal_ids: mealIds.slice() } : slot,
                  );
                  setDraftSlots(nextSlots);
                  if (!hasAnyMeals(nextSlots)) return;
                  await persistWeek(nextSlots);
                }}
              />
            </Stack>
          </Card.Body>
        </Card.Root>

        {err ? (
          <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
            {err}
          </Text>
        ) : null}
      </Stack>
    </MealEditorBackdropDismiss>
  );
}
