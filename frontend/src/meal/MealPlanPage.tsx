import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
} from "../theme/typography";
import {
  createInstance,
  createMeal,
  fetchInstances,
  fetchMeals,
  patchInstanceGrid,
} from "./api";
import { mealLabel } from "./mealLabels";
import { MealPlanSlotControls } from "./MealPlanSlotControls";
import { MealPlanWeekStrip } from "./MealPlanWeekStrip";
import { resolveSlotLabels } from "./mealSlotLabels";
import {
  addDays,
  dayIndexInInstance,
  formatLongCalendarDate,
  instanceCoveringDate,
  localDateIso,
  parseLocalDate,
  pythonWeekday,
  startOfWeek,
} from "./mealPlanDates";
import { profileMealSlotsPerDay } from "./mealPlanSlots";
import { patchMealSlotsPerDay } from "./mealPlanSlotsChange";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealSlotPickerDialog } from "./MealSlotPickerDialog";
import type { InstanceSlot, Meal, MealPlanInstance } from "./types";

function slotMealIds(slots: InstanceSlot[], dayIndex: number, slotIndex: number): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
}

export default function MealPlanPage() {
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
  const [err, setErr] = useState<string | null>(null);
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const [slotRowsBusy, setSlotRowsBusy] = useState(false);
  const [selectedDateIso, setSelectedDateIso] = useState(() => localDateIso());
  const instancesRef = useRef<MealPlanInstance[]>([]);
  instancesRef.current = instances;

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [i, m] = await Promise.all([fetchInstances(t), fetchMeals(t)]);
    setInstances(i);
    setMeals(m);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    const tid = window.setTimeout(() => {
      void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, refresh]);

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const selectedDate = useMemo(() => parseLocalDate(selectedDateIso), [selectedDateIso]);
  const selectedWeekStart = useMemo(
    () => localDateIso(startOfWeek(selectedDate, weekStartsOn)),
    [selectedDate, weekStartsOn],
  );
  const covering = instanceCoveringDate(instances, selectedDate);
  const dayIdx =
    covering != null
      ? (dayIndexInInstance(covering, selectedDate) ??
        (pythonWeekday(selectedDate) - weekStartsOn + 7) % 7)
      : (pythonWeekday(selectedDate) - weekStartsOn + 7) % 7;
  const defaultSlotsPerDay = profileMealSlotsPerDay(sessionUser?.profile);

  useEffect(() => {
    if (covering) return;
    if (draftSlots.length > 0) return;
    const next: InstanceSlot[] = [];
    for (let s = 0; s < defaultSlotsPerDay; s++) {
      next.push({ day_index: dayIdx, slot_index: s, meal_ids: [] });
    }
    setDraftSlots(next);
  }, [covering, dayIdx, defaultSlotsPerDay, draftSlots.length]);

  const slotsPerDay = covering ? profileMealSlotsPerDay(sessionUser?.profile) : defaultSlotsPerDay;
  const slotLabels = resolveSlotLabels(slotsPerDay, sessionUser?.profile.meal_slot_labels);
  const daySlots = Array.from({ length: slotsPerDay }, (_, slotIndex) => {
    const source = covering?.slots ?? draftSlots;
    return { slotIndex, mealIds: slotMealIds(source, dayIdx, slotIndex) };
  });

  const weekStripSlots = covering?.slots ?? [];
  const weekStartIso = covering?.week_start ?? selectedWeekStart;

  const selectDayInWeek = useCallback(
    (dayIndex: number) => {
      const [y, m, d] = weekStartIso.split("-").map(Number);
      setSelectedDateIso(localDateIso(new Date(y, m - 1, d + dayIndex)));
    },
    [weekStartIso],
  );

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  const dateHeading = formatLongCalendarDate(selectedDate);
  const dayLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long" });

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <HStack justify="space-between" align="center" flexWrap="wrap" gap="2">
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="sky"
          onClick={() => setSelectedDateIso(localDateIso(addDays(selectedDate, -1)))}
        >
          ← Previous day
        </PondButton>
        <Heading as="h2" size="md" textAlign="center" flex="1" minW="min(100%, 12rem)">
          {dateHeading}
        </Heading>
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="sky"
          onClick={() => setSelectedDateIso(localDateIso(addDays(selectedDate, 1)))}
        >
          Next day →
        </PondButton>
      </HStack>

      <HStack gap="2" flexWrap="wrap" align="center">
        <MealPlanSlotControls
          slotsPerDay={slotsPerDay}
          disabled={slotRowsBusy}
          onChange={async (next) => {
            setSlotRowsBusy(true);
            try {
              await patchMealSlotsPerDay(
                patchMyProfile,
                next,
                profileMealSlotsPerDay(sessionUser.profile),
              );
              const tok = await getApiAccessToken();
              setInstances(await fetchInstances(tok));
              setErr(null);
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not update meal rows");
            } finally {
              setSlotRowsBusy(false);
            }
          }}
        />
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="lilypad"
          onClick={() => navigate("/meal/plan/overview")}
        >
          Overview
        </PondButton>
      </HStack>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <Stack gap="2">
        {daySlots.map(({ slotIndex, mealIds }) => {
          const slotName = slotLabels[slotIndex] ?? `Slot ${slotIndex + 1}`;
          const isEmpty = mealIds.length === 0;
          return (
            <Box key={slotIndex}>
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="1">
                {slotName}
              </Text>
              <Box
                role="button"
                tabIndex={0}
                minH="12"
                px="2"
                py="2"
                borderRadius="md"
                borderWidth="1px"
                borderColor="border"
                bg={isEmpty ? "gray.200" : undefined}
                cursor="pointer"
                onClick={() => setActiveSlotIndex(slotIndex)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveSlotIndex(slotIndex);
                  }
                }}
              >
                {isEmpty ? (
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                    Tap to assign a meal
                  </Text>
                ) : (
                  <Stack gap="1">
                    {mealIds.map((mealId) => {
                      const meal = mealsById.get(mealId);
                      const label = meal ? mealLabel(meal) : `Meal #${mealId}`;
                      return (
                        <Text
                          key={mealId}
                          fontSize={APP_TEXT_SIZES.body}
                          fontWeight="semibold"
                          lineHeight="short"
                          wordBreak="break-word"
                        >
                          {label}
                        </Text>
                      );
                    })}
                  </Stack>
                )}
              </Box>
              {activeSlotIndex === slotIndex ? (
                <MealSlotPickerDialog
                  open
                  intent={isEmpty ? "assign" : "edit"}
                  onOpenChange={(open) => {
                    if (!open) setActiveSlotIndex(null);
                  }}
                  dayLabel={dayLabel}
                  slotDisplayName={slotName}
                  mealIds={mealIds}
                  meals={meals}
                  createMeal={async (body) => {
                    const tok = await getApiAccessToken();
                    return createMeal(tok, body);
                  }}
                  onMealCreated={(m) =>
                    setMeals((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
                  }
                  onCommit={async (selected) => {
                    try {
                      const tok = await getApiAccessToken();
                      const dayIdxFallback =
                        (pythonWeekday(selectedDate) - weekStartsOn + 7) % 7;

                      const mergePatchedInstance = (patched: MealPlanInstance) => {
                        const prev = instancesRef.current;
                        const mapped = prev.map((x) => (x.id === patched.id ? patched : x));
                        const merged = mapped.some((x) => x.id === patched.id)
                          ? mapped
                          : [...mapped, patched];
                        instancesRef.current = merged;
                        setInstances(merged);
                      };

                      let cov = instanceCoveringDate(instancesRef.current, selectedDate);
                      let slotDayIdx =
                        cov != null
                          ? (dayIndexInInstance(cov, selectedDate) ?? dayIdxFallback)
                          : dayIdxFallback;

                      if (cov) {
                        const next = await patchInstanceGrid(tok, cov.id, [
                          { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                        ]);
                        mergePatchedInstance(next);
                        setErr(null);
                        void resyncSessionSilently().catch(() => {});
                        return;
                      }

                      if (selected.length === 0) {
                        const fresh = await fetchInstances(tok);
                        cov = instanceCoveringDate(fresh, selectedDate);
                        if (cov) {
                          instancesRef.current = fresh;
                          setInstances(fresh);
                          slotDayIdx = dayIndexInInstance(cov, selectedDate) ?? dayIdxFallback;
                          const next = await patchInstanceGrid(tok, cov.id, [
                            { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                          ]);
                          mergePatchedInstance(next);
                          setErr(null);
                          void resyncSessionSilently().catch(() => {});
                          return;
                        }
                        setDraftSlots((prev) =>
                          prev.map((slot) =>
                            slot.slot_index === slotIndex
                              ? { ...slot, meal_ids: selected }
                              : slot,
                          ),
                        );
                        setErr(null);
                        return;
                      }

                      const fresh = await fetchInstances(tok);
                      cov = instanceCoveringDate(fresh, selectedDate);
                      if (cov) {
                        instancesRef.current = fresh;
                        setInstances(fresh);
                        slotDayIdx = dayIndexInInstance(cov, selectedDate) ?? dayIdxFallback;
                        const next = await patchInstanceGrid(tok, cov.id, [
                          { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                        ]);
                        mergePatchedInstance(next);
                        setErr(null);
                        void resyncSessionSilently().catch(() => {});
                        return;
                      }

                      setDraftSlots((prev) =>
                        prev.map((slot) =>
                          slot.slot_index === slotIndex ? { ...slot, meal_ids: selected } : slot,
                        ),
                      );

                      const created = await createInstance(tok, {
                        week_start: selectedWeekStart,
                      });
                      const updated = await patchInstanceGrid(tok, created.id, [
                        { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                      ]);
                      const merged = [
                        ...instancesRef.current.filter((x) => x.id !== updated.id),
                        updated,
                      ];
                      instancesRef.current = merged;
                      setInstances(merged);
                      setErr(null);
                      void resyncSessionSilently().catch(() => {});
                    } catch (e) {
                      setErr(
                        e instanceof Error
                          ? e.message
                          : `Could not update ${slotName}`,
                      );
                      throw e;
                    }
                  }}
                />
              ) : null}
            </Box>
          );
        })}
      </Stack>

      <MealPlanWeekStrip
        weekStartIso={weekStartIso}
        slots={weekStripSlots}
        slotsPerDay={slotsPerDay}
        weekStartsOn={weekStartsOn}
        mealsById={mealsById}
        selectedDayIndex={dayIdx}
        onSelectDay={selectDayInWeek}
      />
    </Stack>
  );
}
