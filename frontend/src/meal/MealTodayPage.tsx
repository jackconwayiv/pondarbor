import { Box, Card, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import {
  createInstance,
  createMeal,
  fetchInstances,
  fetchMeals,
  fetchTemplates,
  patchInstanceGrid,
} from "./api";
import { mealLabel } from "./mealLabels";
import { resolveSlotLabels } from "./mealSlotLabels";
import {
  dayIndexInInstance,
  formatLongCalendarDate,
  instanceCoveringDate,
  localDateIso,
  pythonWeekday,
  startOfWeek,
} from "./mealPlanDates";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import { MealSlotPickerDialog } from "./MealSlotPickerDialog";
import type { InstanceSlot, Meal, MealPlanInstance, MealPlanTemplate } from "./types";

function slotMealIds(slots: InstanceSlot[], dayIndex: number, slotIndex: number): number[] {
  const row = slots.find((x) => x.day_index === dayIndex && x.slot_index === slotIndex);
  return row?.meal_ids ?? [];
}

export default function MealTodayPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const instancesRef = useRef<MealPlanInstance[]>([]);
  instancesRef.current = instances;

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [i, m, tpl] = await Promise.all([fetchInstances(t), fetchMeals(t), fetchTemplates(t)]);
    setInstances(i);
    setMeals(m);
    setTemplates(tpl);
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

  const today = new Date();
  const todayWeekStart = localDateIso(startOfWeek(today, weekStartsOn));
  const covering = instanceCoveringDate(instances, today);
  const dayIdx =
    covering != null
      ? (dayIndexInInstance(covering, today) ?? (pythonWeekday(today) - weekStartsOn + 7) % 7)
      : (pythonWeekday(today) - weekStartsOn + 7) % 7;
  const defaultSlotsPerDay = Math.max(1, templates[0]?.slots_per_day ?? 3);

  useEffect(() => {
    if (covering) return;
    if (draftSlots.length > 0) return;
    const next: InstanceSlot[] = [];
    for (let s = 0; s < defaultSlotsPerDay; s++) {
      next.push({ day_index: dayIdx, slot_index: s, meal_ids: [] });
    }
    setDraftSlots(next);
  }, [covering, dayIdx, defaultSlotsPerDay, draftSlots.length]);

  const slotsPerDay = covering
    ? Math.max(1, ...covering.slots.map((s) => s.slot_index + 1))
    : defaultSlotsPerDay;
  const slotLabels = resolveSlotLabels(slotsPerDay, sessionUser?.profile.meal_slot_labels);
  const todaySlots = Array.from({ length: slotsPerDay }, (_, slotIndex) => {
    const source = covering?.slots ?? draftSlots;
    return { slotIndex, mealIds: slotMealIds(source, dayIdx, slotIndex) };
  });

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
      <Heading as="h2" size="md" fontWeight="bold" w="100%">
        {dateHeading}
      </Heading>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Meals shown here come from the week plan that covers today&apos;s date.
      </Text>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <Stack gap="2">
        {todaySlots.map(({ slotIndex, mealIds }) => (
          <Card.Root
            key={slotIndex}
            {...PANEL_ENTRY_CARD_PROPS}
            p="0"
            cursor="pointer"
            onClick={() => setActiveSlotIndex(slotIndex)}
          >
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
              <Stack gap="2">
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                  {slotLabels[slotIndex] ?? `Slot ${slotIndex + 1}`}
                </Text>
                {mealIds.length === 0 ? (
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
                    Click to add a meal
                  </Text>
                ) : (
                  <HStack w="100%" align="flex-start" gap="2">
                    {mealIds.map((mealId) => {
                      const meal = mealsById.get(mealId);
                      const label = meal ? mealLabel(meal) : `Meal #${mealId}`;
                      return (
                        <Box
                          key={mealId}
                          flex="1"
                          minW="0"
                          fontSize={APP_TEXT_SIZES.body}
                          lineHeight="short"
                          wordBreak="break-word"
                          textAlign="center"
                        >
                          {meal ? (
                            <RouterLink
                              to={`/meal/plan/meals/${meal.id}?tab=ingredients`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ textDecoration: "none", color: "inherit" }}
                            >
                              <Text as="span" color="teal.solid" fontWeight="semibold">
                                {label}
                              </Text>
                            </RouterLink>
                          ) : (
                            <Text as="span" color="fg.muted">
                              {label}
                            </Text>
                          )}
                        </Box>
                      );
                    })}
                  </HStack>
                )}
                {activeSlotIndex === slotIndex ? (
                  <MealSlotPickerDialog
                    open
                    onOpenChange={(open) => {
                      if (!open) setActiveSlotIndex(null);
                    }}
                    dayLabel={today.toLocaleDateString(undefined, { weekday: "long" })}
                    slotDisplayName={slotLabels[slotIndex] ?? `Slot ${slotIndex + 1}`}
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
                        const dayIdxFallback = (pythonWeekday(today) - weekStartsOn + 7) % 7;

                        const mergePatchedInstance = (patched: MealPlanInstance) => {
                          const prev = instancesRef.current;
                          const mapped = prev.map((x) => (x.id === patched.id ? patched : x));
                          const merged = mapped.some((x) => x.id === patched.id)
                            ? mapped
                            : [...mapped, patched];
                          instancesRef.current = merged;
                          setInstances(merged);
                        };

                        let cov = instanceCoveringDate(instancesRef.current, today);
                        let slotDayIdx =
                          cov != null
                            ? (dayIndexInInstance(cov, today) ?? dayIdxFallback)
                            : dayIdxFallback;

                        if (cov) {
                          const next = await patchInstanceGrid(tok, cov.id, [
                            { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                          ]);
                          mergePatchedInstance(next);
                          setErr(null);
                          void refreshSession().catch(() => {});
                          return;
                        }

                        if (selected.length === 0) {
                          const fresh = await fetchInstances(tok);
                          cov = instanceCoveringDate(fresh, today);
                          if (cov) {
                            instancesRef.current = fresh;
                            setInstances(fresh);
                            slotDayIdx = dayIndexInInstance(cov, today) ?? dayIdxFallback;
                            const next = await patchInstanceGrid(tok, cov.id, [
                              { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                            ]);
                            mergePatchedInstance(next);
                            setErr(null);
                            void refreshSession().catch(() => {});
                            return;
                          }
                          setDraftSlots((prev) =>
                            prev.map((slot) =>
                              slot.slot_index === slotIndex ? { ...slot, meal_ids: selected } : slot,
                            ),
                          );
                          setErr(null);
                          return;
                        }

                        const fresh = await fetchInstances(tok);
                        cov = instanceCoveringDate(fresh, today);
                        if (cov) {
                          instancesRef.current = fresh;
                          setInstances(fresh);
                          slotDayIdx = dayIndexInInstance(cov, today) ?? dayIdxFallback;
                          const next = await patchInstanceGrid(tok, cov.id, [
                            { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                          ]);
                          mergePatchedInstance(next);
                          setErr(null);
                          void refreshSession().catch(() => {});
                          return;
                        }

                        setDraftSlots((prev) =>
                          prev.map((slot) =>
                            slot.slot_index === slotIndex ? { ...slot, meal_ids: selected } : slot,
                          ),
                        );

                        const defaultTemplateId = templates[0]?.id;
                        if (!defaultTemplateId) {
                          throw new Error("Create at least one template before saving today's plan.");
                        }
                        const created = await createInstance(tok, {
                          template_id: defaultTemplateId,
                          week_start: todayWeekStart,
                        });
                        const updated = await patchInstanceGrid(tok, created.id, [
                          { day_index: slotDayIdx, slot_index: slotIndex, meal_ids: selected },
                        ]);
                        const merged = [...instancesRef.current.filter((x) => x.id !== updated.id), updated];
                        instancesRef.current = merged;
                        setInstances(merged);
                        setErr(null);
                        void refreshSession().catch(() => {});
                      } catch (e) {
                        setErr(
                          e instanceof Error
                            ? e.message
                            : `Could not update ${slotLabels[slotIndex] ?? `slot ${slotIndex + 1}`}`,
                        );
                        throw e;
                      }
                    }}
                  />
                ) : null}
              </Stack>
            </Card.Body>
          </Card.Root>
        ))}
      </Stack>
    </Stack>
  );
}
