import { Box, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
} from "../theme/typography";
import { createMeal } from "./api";
import { useMealData } from "./MealDataContext";
import { mealLabel } from "./mealLabels";
import { MealPlanSlotCell } from "./MealPlanSlotCell";
import { commitPlanSlot } from "./mealPlanSlotCommit";
import { MealPlanWeekStrip } from "./MealPlanWeekStrip";
import { resolveSlotLabels } from "./mealSlotLabels";
import {
  addDays,
  formatLongCalendarDate,
  instanceCoveringDate,
  localDateIso,
  parseLocalDate,
  pythonWeekday,
  startOfWeek,
} from "./mealPlanDates";
import { profileMealSlotsPerDay } from "./mealPlanSlots";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealSlotPickerDialog } from "./MealSlotPickerDialog";
import type { InstanceSlot } from "./types";

function slotMealIds(slots: InstanceSlot[], dayIndex: number, slotIndex: number): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
}

function isValidDateIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function MealPlanPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateParam = searchParams.get("date");
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
    instancesRef,
    setInstances,
    upsertMeal,
    refreshInstances,
    onGridCommitted,
  } = useMealData();
  const [err, setErr] = useState<string | null>(null);
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [pickerState, setPickerState] = useState<{
    slotIndex: number;
    intent: "assign" | "edit";
  } | null>(null);

  const selectedDateIso =
    dateParam && isValidDateIso(dateParam) ? dateParam : localDateIso();

  const changeDateByDays = useCallback(
    (delta: number) => {
      const next = localDateIso(addDays(parseLocalDate(selectedDateIso), delta));
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set("date", next);
          return p;
        },
        { replace: true },
      );
    },
    [selectedDateIso, setSearchParams],
  );

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const selectedDate = useMemo(() => parseLocalDate(selectedDateIso), [selectedDateIso]);
  const todayIso = localDateIso();
  const isToday = selectedDateIso === todayIso;
  const selectedWeekStart = useMemo(
    () => localDateIso(startOfWeek(selectedDate, weekStartsOn)),
    [selectedDate, weekStartsOn],
  );
  const covering = instanceCoveringDate(instances, selectedDate);
  const dayIdx =
    covering != null
      ? (pythonWeekday(selectedDate) - weekStartsOn + 7) % 7
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
          aria-label="Previous day"
          onClick={() => changeDateByDays(-1)}
        >
          ←
        </PondButton>
        <Heading as="h2" size="md" textAlign="center" flex="1" minW="min(100%, 12rem)">
          {isToday ? (
            <>
              Today
              <Text as="span" display="block" fontSize={APP_TEXT_SIZES.meta} fontWeight="normal" color="fg.muted">
                {dateHeading}
              </Text>
            </>
          ) : (
            dateHeading
          )}
        </Heading>
        <PondButton
          size="sm"
          variant="outline"
          colorPalette="sky"
          aria-label="Next day"
          onClick={() => changeDateByDays(1)}
        >
          →
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
            <HStack key={slotIndex} align="center" gap="2" w="100%">
              <Text
                fontSize={APP_TEXT_SIZES.meta}
                color="fg.muted"
                fontWeight="medium"
                flexShrink={0}
                minW="4.5rem"
              >
                {slotName}
              </Text>
              <Box flex="1" minW="0">
              <MealPlanSlotCell
                variant={isEmpty ? "emptyInput" : "scheduled"}
                aria-label={
                  isEmpty ? `Add meal for ${slotName}` : `View ${slotName}: ${mealIds.length} meal(s)`
                }
                onClick={() => {
                  if (isEmpty) {
                    setPickerState({ slotIndex, intent: "assign" });
                  } else {
                    navigate(
                      `/meal/plan/slot?date=${encodeURIComponent(selectedDateIso)}&slot=${slotIndex}`,
                    );
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (isEmpty) {
                      setPickerState({ slotIndex, intent: "assign" });
                    } else {
                      navigate(
                        `/meal/plan/slot?date=${encodeURIComponent(selectedDateIso)}&slot=${slotIndex}`,
                      );
                    }
                  }
                }}
              >
                {!isEmpty
                  ? mealIds.map((mealId) => {
                      const meal = mealsById.get(mealId);
                      const label = meal ? mealLabel(meal) : `Meal #${mealId}`;
                      return (
                        <Text
                          key={mealId}
                          fontSize={APP_TEXT_SIZES.body}
                          fontWeight="bold"
                          lineHeight="short"
                          wordBreak="break-word"
                        >
                          {label}
                        </Text>
                      );
                    })
                  : undefined}
              </MealPlanSlotCell>
              </Box>
              {!isEmpty ? (
                <PondButton
                  size="sm"
                  variant="solid"
                  colorPalette="lilypad"
                  borderRadius="md"
                  flexShrink={0}
                  minW="10"
                  h="10"
                  px="0"
                  fontWeight="bold"
                  fontSize="xl"
                  lineHeight="1"
                  aria-label={`Add another meal to ${slotName}`}
                  onClick={() => setPickerState({ slotIndex, intent: "edit" })}
                >
                  +
                </PondButton>
              ) : null}
              {pickerState?.slotIndex === slotIndex ? (
                <MealSlotPickerDialog
                  open
                  intent={pickerState.intent}
                  onOpenChange={(open) => {
                    if (!open) setPickerState(null);
                  }}
                  dayLabel={dayLabel}
                  slotDisplayName={slotName}
                  mealIds={mealIds}
                  meals={meals}
                  createMeal={async (body) => {
                    const tok = await getApiAccessToken();
                    return createMeal(tok, body);
                  }}
                  onMealCreated={(m) => upsertMeal(m)}
                  onCommit={async (selected) => {
                    try {
                      await commitPlanSlot(
                        {
                          selectedDateIso,
                          selectedWeekStart,
                          weekStartsOn,
                          slotIndex,
                          instancesRef,
                          setInstances,
                          setDraftSlots,
                          getApiAccessToken,
                          resyncSessionSilently,
                          refreshInstances,
                          onGridCommitted,
                        },
                        selected,
                      );
                      setErr(null);
                      if (pickerState.intent === "assign") {
                        setPickerState(null);
                      }
                    } catch (e) {
                      setErr(
                        e instanceof Error ? e.message : `Could not update ${slotName}`,
                      );
                      throw e;
                    }
                  }}
                />
              ) : null}
            </HStack>
          );
        })}
      </Stack>

      <MealPlanWeekStrip
        weekStartIso={weekStartIso}
        slots={weekStripSlots}
        slotsPerDay={slotsPerDay}
        weekStartsOn={weekStartsOn}
        selectedDayIndex={dayIdx}
      />
    </Stack>
  );
}
