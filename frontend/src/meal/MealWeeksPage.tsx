import { Card, HStack, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchInstances, fetchMeals, fetchTemplates } from "./api";
import { MealReadonlyGrid } from "./MealReadonlyGrid";
import { addDaysIso, formatWeekStartShort, localDateIso, startOfWeek } from "./mealPlanDates";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Meal, MealPlanInstance, MealPlanTemplate } from "./types";

type BrowseNav =
  | { mode: "future"; pairOffset: number }
  | { mode: "past"; chunkIndex: number };

function slotsPerDayForInstance(
  inst: MealPlanInstance,
  templates: MealPlanTemplate[],
): number {
  const tpl =
    inst.source_template != null ? templates.find((t) => t.id === inst.source_template) : undefined;
  if (tpl) return tpl.slots_per_day;
  const maxS = inst.slots.reduce((acc, s) => Math.max(acc, s.slot_index + 1), 1);
  return Math.max(1, maxS);
}

export default function MealWeeksPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [nav, setNav] = useState<BrowseNav>({ mode: "future", pairOffset: 0 });
  const [err, setErr] = useState<string | null>(null);
  const lastFuturePairOffset = useRef(0);

  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const currentWeekStart = useMemo(
    () => localDateIso(startOfWeek(new Date(), weekStartsOn)),
    [weekStartsOn],
  );

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [i, tpl, ml] = await Promise.all([fetchInstances(t), fetchTemplates(t), fetchMeals(t)]);
    setInstances(i);
    setTemplates(tpl);
    setMeals(ml);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    const tid = window.setTimeout(() => {
      void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, refresh]);

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);
  const instanceByWeek = useMemo(
    () => new Map(instances.map((inst) => [inst.week_start, inst])),
    [instances],
  );

  const pastInstancesDesc = useMemo(() => {
    return instances
      .filter((i) => i.week_start < currentWeekStart)
      .sort((a, b) => b.week_start.localeCompare(a.week_start));
  }, [instances, currentWeekStart]);

  const pastChunks = useMemo(() => {
    const chunks: MealPlanInstance[][] = [];
    for (let i = 0; i < pastInstancesDesc.length; i += 2) {
      chunks.push(pastInstancesDesc.slice(i, i + 2));
    }
    return chunks;
  }, [pastInstancesDesc]);

  useEffect(() => {
    if (nav.mode === "future") {
      lastFuturePairOffset.current = nav.pairOffset;
    }
  }, [nav]);

  useEffect(() => {
    if (nav.mode !== "past") return;
    const chunkIndex = nav.chunkIndex;
    if (pastChunks.length === 0) {
      setNav({ mode: "future", pairOffset: lastFuturePairOffset.current });
      return;
    }
    if (chunkIndex >= pastChunks.length) {
      setNav({ mode: "past", chunkIndex: pastChunks.length - 1 });
    }
  }, [nav, pastChunks.length]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  const defaultSlotsPerDay = Math.max(templates[0]?.slots_per_day ?? 3, 1);

  const canGoEarlier =
    nav.mode === "future"
      ? nav.pairOffset > 0 || pastChunks.length > 0
      : nav.chunkIndex < pastChunks.length - 1;

  const canGoLater =
    nav.mode === "future"
      ? nav.pairOffset < 2
      : true;

  function goEarlier() {
    if (!canGoEarlier) return;
    if (nav.mode === "future") {
      if (nav.pairOffset > 0) {
        setNav({ mode: "future", pairOffset: nav.pairOffset - 1 });
        return;
      }
      if (pastChunks.length > 0) {
        setNav({ mode: "past", chunkIndex: 0 });
      }
      return;
    }
    setNav({ mode: "past", chunkIndex: nav.chunkIndex + 1 });
  }

  function goLater() {
    if (!canGoLater) return;
    if (nav.mode === "past") {
      if (nav.chunkIndex > 0) {
        setNav({ mode: "past", chunkIndex: nav.chunkIndex - 1 });
        return;
      }
      setNav({ mode: "future", pairOffset: lastFuturePairOffset.current });
      return;
    }
    setNav({ mode: "future", pairOffset: Math.min(2, nav.pairOffset + 1) });
  }

  const browseLabel =
    nav.mode === "past"
      ? `Saved weeks (older) · page ${nav.chunkIndex + 1} of ${pastChunks.length || 1}`
      : `This week and next · up to 3 weeks ahead`;

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Tap a week to edit. Past weeks appear only when you have saved plans for them.
      </Text>
      <HStack gap="2" flexWrap="wrap" align="center">
        <PondButton colorPalette="sky" variant="outline" disabled={!canGoEarlier} onClick={goEarlier}>
          ← Earlier
        </PondButton>
        <PondButton colorPalette="sky" variant="outline" disabled={!canGoLater} onClick={goLater}>
          Later →
        </PondButton>
        <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
          {browseLabel}
        </Text>
      </HStack>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      {nav.mode === "past" ? (
        <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
          {(pastChunks[nav.chunkIndex] ?? []).map((inst) => (
            <RouterLink
              key={inst.id}
              to={`/meal/plan/plans/${inst.id}`}
              aria-label={`Edit week of ${formatWeekStartShort(inst.week_start)}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              <Card.Root
                {...PANEL_ENTRY_CARD_PROPS}
                p="0"
                overflow="hidden"
                {...MEAL_NAV_LINK_CARD_PROPS}
              >
                <MealReadonlyGrid
                  embeddedInParentCard
                  slots={inst.slots}
                  slotsPerDay={slotsPerDayForInstance(inst, templates)}
                  weekStartsOn={weekStartsOn}
                  mealsById={mealsById}
                  headerMode="dates"
                  weekStartIso={inst.week_start}
                />
              </Card.Root>
            </RouterLink>
          ))}
        </Stack>
      ) : (
        <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
          {[0, 1].map((delta) => {
            const weekStart = addDaysIso(currentWeekStart, (nav.pairOffset + delta) * 7);
            const inst = instanceByWeek.get(weekStart) ?? null;
            const slotsPerDay = inst
              ? slotsPerDayForInstance(inst, templates)
              : defaultSlotsPerDay;
            const slots = inst?.slots ?? [];
            const to = inst
              ? `/meal/plan/plans/${inst.id}`
              : `/meal/plan/plans/new?week=${encodeURIComponent(weekStart)}`;
            return (
              <RouterLink
                key={weekStart}
                to={to}
                aria-label={
                  inst
                    ? `Edit week of ${formatWeekStartShort(weekStart)}`
                    : `Plan week of ${formatWeekStartShort(weekStart)}`
                }
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <Card.Root
                  {...PANEL_ENTRY_CARD_PROPS}
                  p="0"
                  overflow="hidden"
                  {...MEAL_NAV_LINK_CARD_PROPS}
                >
                  <MealReadonlyGrid
                    embeddedInParentCard
                    slots={slots}
                    slotsPerDay={slotsPerDay}
                    weekStartsOn={weekStartsOn}
                    mealsById={mealsById}
                    headerMode="dates"
                    weekStartIso={weekStart}
                  />
                </Card.Root>
              </RouterLink>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
