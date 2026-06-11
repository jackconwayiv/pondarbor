import { Box, Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createInstance, createMeal, deleteInstance, patchInstanceGrid } from "./api";
import { useMealData } from "./MealDataContext";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import { MealGroceryListDialog } from "./MealGroceryListDialog";
import MealSlotGrid from "./MealSlotGrid";
import { resolveSlotLabels } from "./mealSlotLabels";
import { addDaysIso, formatWeekStartShort } from "./mealPlanDates";
import {
  defaultPlanSlots,
  mergedPlanSlots,
  profileMealSlotsPerDay,
} from "./mealPlanSlots";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { InstanceSlot, MealPlanInstance } from "./types";

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
  } = useAppSession();
  const {
    meals,
    instances,
    ready,
    patchInstance,
    removeInstance,
    upsertMeal,
    onGridCommitted,
  } = useMealData();
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [savedInst, setSavedInst] = useState<MealPlanInstance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [groceryOpen, setGroceryOpen] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const slotsPerDay = profileMealSlotsPerDay(sessionUser?.profile);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !isValidWeekStartIso(weekStart)) return;
    setConfirmDelete(false);
  }, [sessionUser?.user.is_approved, weekStart]);

  const instanceByWeek = useMemo(
    () => new Map(instances.map((inst) => [inst.week_start, inst])),
    [instances],
  );

  useEffect(() => {
    const inst = instanceByWeek.get(weekStart) ?? null;
    setSavedInst(inst);
    if (!inst) {
      setDraftSlots((prev) => (prev.length > 0 ? prev : defaultPlanSlots(slotsPerDay)));
    } else {
      setDraftSlots([]);
    }
  }, [weekStart, instanceByWeek, slotsPerDay]);

  const slots = savedInst
    ? mergedPlanSlots(slotsPerDay, savedInst.slots)
    : mergedPlanSlots(slotsPerDay, draftSlots);

  const weekTitle = `Week of ${formatWeekStartShort(weekStart)}`;

  async function persistNewWeek(nextSlots: InstanceSlot[]) {
    setBusy(true);
    try {
      const tok = await getApiAccessToken();
      const created = await createInstance(tok, { week_start: weekStart });
      const updated = await patchInstanceGrid(tok, created.id, nextSlots);
      patchInstance(updated);
      setSavedInst(updated);
      setDraftSlots([]);
      setErr(null);
      void resyncSessionSilently().catch(() => {});
      onGridCommitted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save week failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function patchSavedCell(dayIndex: number, slotIndex: number, mealIds: number[]) {
    if (!savedInst) return;
    setBusy(true);
    try {
      const tok = await getApiAccessToken();
      const next = await patchInstanceGrid(tok, savedInst.id, [
        { day_index: dayIndex, slot_index: slotIndex, meal_ids: mealIds },
      ]);
      setSavedInst(next);
      patchInstance(next);
      setErr(null);
      setConfirmDelete(false);
      void resyncSessionSilently().catch(() => {});
      onGridCommitted();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Update failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  function goWeek(deltaDays: number) {
    navigate(`/meal/plan/plans/new?week=${encodeURIComponent(addDaysIso(weekStart, deltaDays))}`, {
      replace: true,
    });
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
        Missing or invalid week. Open the plan from This week on your daily plan.
      </Text>
    );
  }
  if (!ready) {
    return <MealLoading />;
  }

  const slotLabels = resolveSlotLabels(slotsPerDay, sessionUser.profile.meal_slot_labels);
  const controlsDisabled = busy || deleteBusy;

  return (
    <MealEditorBackdropDismiss dismissTo="/meal/plan" disabled={controlsDisabled}>
      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
        <Text fontSize={APP_TEXT_SIZES.helper}>
          <RouterLink to="/meal/plan">
            <Text as="span" color="teal.solid" fontWeight="bold">
              ← Plan
            </Text>
          </RouterLink>
        </Text>

        <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
          <PondButton
            size="sm"
            variant="outline"
            colorPalette="sky"
            disabled={controlsDisabled}
            onClick={() => goWeek(-7)}
          >
            ← Previous week
          </PondButton>
          <Heading size="sm" textAlign="center" flex="1" minW="min(100%, 10rem)">
            {weekTitle}
          </Heading>
          <PondButton
            size="sm"
            variant="outline"
            colorPalette="sky"
            disabled={controlsDisabled}
            onClick={() => goWeek(7)}
          >
            Next week →
          </PondButton>
        </HStack>

        {!savedInst ? (
          <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
            Unsaved weeks stay local until at least one meal is entered.
          </Text>
        ) : null}

        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body
            {...PANEL_ENTRY_CARD_BODY_PROPS}
            onPointerDownCapture={(event) => {
              if (!confirmDelete) return;
              const target = event.target as Node | null;
              if (!target) return;
              if (confirmDeleteButtonRef.current?.contains(target)) return;
              setConfirmDelete(false);
            }}
          >
            <Stack gap="3">
              {savedInst ? (
                <HStack justify="flex-end" gap="2" flexWrap="wrap" w="100%">
                  <PondButton
                    colorPalette="sky"
                    variant="outline"
                    disabled={controlsDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      setGroceryOpen(true);
                    }}
                  >
                    Grocery list
                  </PondButton>
                  <PondButton
                    ref={confirmDeleteButtonRef}
                    colorPalette="nautical"
                    loading={deleteBusy}
                    disabled={controlsDisabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!confirmDelete) {
                        setConfirmDelete(true);
                        return;
                      }
                      void (async () => {
                        setDeleteBusy(true);
                        try {
                          const tok = await getApiAccessToken();
                          await deleteInstance(tok, savedInst.id);
                          removeInstance(savedInst.id);
                          setSavedInst(null);
                          setDraftSlots(defaultPlanSlots(slotsPerDay));
                          setErr(null);
                          navigate("/meal/plan");
                        } catch (e) {
                          setErr(e instanceof Error ? e.message : "Delete failed");
                        } finally {
                          setDeleteBusy(false);
                        }
                      })();
                    }}
                  >
                    {confirmDelete ? "Confirm Delete" : "Delete week"}
                  </PondButton>
                </HStack>
              ) : null}

              <MealSlotGrid
                slots={slots}
                slotsPerDay={slotsPerDay}
                weekStartsOn={weekStartsOn}
                weekStartIso={weekStart}
                slotLabels={slotLabels}
                meals={meals}
                disabled={controlsDisabled}
                createMeal={async (body) => {
                  const tok = await getApiAccessToken();
                  return createMeal(tok, body);
                }}
                onMealCreated={(m) => upsertMeal(m)}
                onCellChange={async (dayIndex, slotIndex, mealIds) => {
                  if (savedInst) {
                    await patchSavedCell(dayIndex, slotIndex, mealIds);
                    return;
                  }
                  const nextSlots = slots.map((slot) =>
                    slot.day_index === dayIndex && slot.slot_index === slotIndex
                      ? { ...slot, meal_ids: mealIds }
                      : slot,
                  );
                  setDraftSlots(nextSlots);
                  if (!hasAnyMeals(nextSlots)) return;
                  await persistNewWeek(nextSlots);
                }}
                onApplySlotToAllDays={async (slotIndex, mealIds) => {
                  if (savedInst) {
                    setBusy(true);
                    try {
                      const tok = await getApiAccessToken();
                      const payload = Array.from({ length: 7 }, (_, day_index) => ({
                        day_index,
                        slot_index: slotIndex,
                        meal_ids: mealIds,
                      }));
                      const next = await patchInstanceGrid(tok, savedInst.id, payload);
                      setSavedInst(next);
                      patchInstance(next);
                      setErr(null);
                      void resyncSessionSilently().catch(() => {});
                      onGridCommitted();
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Update failed");
                      throw e;
                    } finally {
                      setBusy(false);
                    }
                    return;
                  }
                  const nextSlots = slots.map((slot) =>
                    slot.slot_index === slotIndex ? { ...slot, meal_ids: mealIds.slice() } : slot,
                  );
                  setDraftSlots(nextSlots);
                  if (!hasAnyMeals(nextSlots)) return;
                  await persistNewWeek(nextSlots);
                }}
              />
            </Stack>
          </Card.Body>
        </Card.Root>

        {err ? (
          <Box>
            <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
              {err}
            </Text>
          </Box>
        ) : null}

        {savedInst ? (
          <MealGroceryListDialog
            open={groceryOpen}
            onOpenChange={setGroceryOpen}
            instanceId={savedInst.id}
            weekLabel={weekTitle}
            getApiAccessToken={getApiAccessToken}
          />
        ) : null}
      </Stack>
    </MealEditorBackdropDismiss>
  );
}
