import { Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchInstances, fetchMeals } from "./api";
import { mealLabel } from "./mealLabels";
import {
  dayIndexInInstance,
  formatLongCalendarDate,
  formatWeekStartShort,
  instanceCoveringDate,
} from "./mealPlanDates";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { InstanceSlot, Meal, MealPlanInstance } from "./types";

function slotMealIds(slots: InstanceSlot[], dayIndex: number, slotIndex: number): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
}

export default function MealTodayPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [err, setErr] = useState<string | null>(null);

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

  const today = new Date();
  const covering = instanceCoveringDate(instances, today);
  const dayIdx = covering ? dayIndexInInstance(covering, today) : null;

  const slotsToday: { slotIndex: number; mealId: number }[] = (() => {
    if (covering == null || dayIdx == null) return [];
    const spd =
      covering.slots.length > 0
        ? Math.max(...covering.slots.map((s) => s.slot_index)) + 1
        : 0;
    const out: { slotIndex: number; mealId: number }[] = [];
    for (let s = 0; s < spd; s++) {
      for (const mid of slotMealIds(covering.slots, dayIdx, s)) {
        out.push({ slotIndex: s, mealId: mid });
      }
    }
    return out;
  })();

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  const dateHeading = formatLongCalendarDate(today);

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="3" w="100%">
        <Heading as="h2" size="md" fontWeight="bold" flex="1" minW="min(100%, 12rem)">
          {dateHeading}
        </Heading>
        {covering ? (
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color="fg.muted"
            textAlign="right"
            flexShrink={0}
            maxW="100%"
          >
            Week of {formatWeekStartShort(covering.week_start)}
            {" · "}
            <RouterLink to={`/meal/plans/weeks/${covering.id}`}>
              <Text as="span" color="lilypad.solid" fontWeight="bold">
                Edit this week
              </Text>
            </RouterLink>
          </Text>
        ) : null}
      </HStack>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Meals shown here come from the week plan that covers today&apos;s date.
      </Text>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      {covering == null || slotsToday.length === 0 ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
          No meals planned for today
        </Text>
      ) : (
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Stack gap="0">
              {slotsToday.map(({ slotIndex, mealId }, i) => {
                const meal = mealsById.get(mealId);
                const hasBlurb = Boolean(meal?.blurb?.trim());
                return (
                  <Stack
                    key={`${slotIndex}-${mealId}`}
                    gap="2"
                    pt={i > 0 ? 4 : 0}
                    pb="1"
                    borderTopWidth={i > 0 ? "1px" : 0}
                    borderTopColor="border"
                  >
                    {meal ? (
                      <Stack gap="2">
                        <HStack
                          align="center"
                          flexWrap="wrap"
                          gap="2"
                          rowGap="2"
                          w="100%"
                        >
                          <Text
                            fontWeight="semibold"
                            fontSize={APP_TEXT_SIZES.body}
                            flex="1"
                            minW="min(100%, 8rem)"
                          >
                            {mealLabel(meal)}
                          </Text>
                        </HStack>
                        {hasBlurb ? (
                          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" whiteSpace="pre-wrap">
                            {meal.blurb.trim()}
                          </Text>
                        ) : (
                          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                            This meal has no notes.
                          </Text>
                        )}
                      </Stack>
                    ) : (
                      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                        Meal #{mealId} (not found)
                      </Text>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Card.Body>
        </Card.Root>
      )}
    </Stack>
  );
}
