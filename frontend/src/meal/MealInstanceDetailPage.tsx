import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { createMeal, deleteInstance, fetchInstance, fetchMeals, patchInstanceGrid } from "./api";
import { formatWeekStartShort } from "./mealPlanDates";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import MealSlotGrid from "./MealSlotGrid";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Meal, MealPlanInstance } from "./types";

export default function MealInstanceDetailPage() {
  const { id } = useParams();
  const iid = id ? Number(id) : Number.NaN;
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [inst, setInst] = useState<MealPlanInstance | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    const t = await getApiAccessToken();
    const [instance, ml] = await Promise.all([fetchInstance(t, iid), fetchMeals(t)]);
    setInst(instance);
    setMeals(ml);
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
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        Invalid week plan.
      </Text>
    );
  }
  if (!inst) {
    return err ? (
      <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
        {err}
      </Text>
    ) : (
      <MealLoading />
    );
  }

  const slotsPerDay =
    inst.slots.length > 0 ? Math.max(...inst.slots.map((s) => s.slot_index)) + 1 : 3;
  const weekStartsOn = sessionUser.profile.meal_week_starts_on ?? 0;
  const weekTitle = `Week of ${formatWeekStartShort(inst.week_start)}`;

  return (
    <MealEditorBackdropDismiss dismissTo="/meal/plan/plans" disabled={saveBusy || deleteBusy}>
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to="/meal/plan/plans">
          <Text as="span" color="lilypad.solid" fontWeight="bold">
            ← Weekly overview
          </Text>
        </RouterLink>
      </Text>
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
          <HStack
            justify="space-between"
            align="flex-start"
            flexWrap="wrap"
            gap="3"
            mb="2"
            w="100%"
          >
            <Heading size="sm" fontWeight="semibold" flex="1" minW="min(100%, 12rem)">
              {weekTitle}
            </Heading>
            <HStack gap="2" flexShrink={0}>
              <PondButton
                colorPalette="lilypad"
                loading={saveBusy}
                disabled={saveBusy || deleteBusy}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(false);
                  void (async () => {
                    setSaveBusy(true);
                    try {
                      const tok = await getApiAccessToken();
                      const payload = inst.slots.map((s) => ({
                        day_index: s.day_index,
                        slot_index: s.slot_index,
                        meal_ids: s.meal_ids,
                      }));
                      const next = await patchInstanceGrid(tok, inst.id, payload);
                      setInst(next);
                      setErr(null);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Save failed");
                    } finally {
                      setSaveBusy(false);
                    }
                  })();
                }}
              >
                Save
              </PondButton>
              <PondButton
                ref={confirmDeleteButtonRef}
                colorPalette="nautical"
                loading={deleteBusy}
                disabled={deleteBusy || saveBusy}
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
                      await deleteInstance(tok, inst.id);
                      navigate("/meal/plan/plans");
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Delete failed");
                    } finally {
                      setDeleteBusy(false);
                    }
                  })();
                }}
              >
                {confirmDelete ? "Confirm Delete" : "Delete"}
              </PondButton>
            </HStack>
          </HStack>

          <MealSlotGrid
            slots={inst.slots}
            slotsPerDay={slotsPerDay}
            weekStartsOn={weekStartsOn}
            meals={meals}
            disabled={saveBusy || deleteBusy}
            createMeal={async (body) => {
              const tok = await getApiAccessToken();
              return createMeal(tok, body);
            }}
            onMealCreated={(m) =>
              setMeals((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
            }
            onCellChange={async (dayIndex, slotIndex, mealIds) => {
              try {
                const tok = await getApiAccessToken();
                const next = await patchInstanceGrid(tok, inst.id, [
                  { day_index: dayIndex, slot_index: slotIndex, meal_ids: mealIds },
                ]);
                setInst(next);
                setErr(null);
                setConfirmDelete(false);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Update failed");
                throw e;
              }
            }}
          />
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
