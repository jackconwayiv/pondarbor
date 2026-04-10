import {
  Card,
  Heading,
  HStack,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { createInstance, fetchInstances, fetchMeals, fetchTemplates } from "./api";
import { formatWeekStartShort } from "./mealPlanDates";
import { MealReadonlyGrid } from "./MealReadonlyGrid";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Meal, MealPlanInstance, MealPlanTemplate } from "./types";

function slotsPerDayForInstance(
  inst: MealPlanInstance,
  templates: MealPlanTemplate[],
): number {
  const tpl =
    inst.source_template != null
      ? templates.find((t) => t.id === inst.source_template)
      : undefined;
  if (tpl) return tpl.slots_per_day;
  let maxS = 0;
  for (const s of inst.slots) {
    if (s.slot_index + 1 > maxS) maxS = s.slot_index + 1;
  }
  return Math.max(1, maxS || 1);
}

export default function MealWeeksPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);
  const [showAddWeek, setShowAddWeek] = useState(false);

  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);

  const sortedInstances = useMemo(
    () => [...instances].sort((a, b) => a.week_start.localeCompare(b.week_start)),
    [instances],
  );

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [i, tpl, ml] = await Promise.all([
      fetchInstances(t),
      fetchTemplates(t),
      fetchMeals(t),
    ]);
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

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Start from a template to create a calendar week, then open a week to edit meals in the grid.
      </Text>
      <PondButton
        colorPalette="sky"
        variant="outline"
        alignSelf="flex-start"
        onClick={() => setShowAddWeek((v) => !v)}
      >
        {showAddWeek ? "Hide" : "Add a Week"}
      </PondButton>

      {showAddWeek ? (
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Heading size="sm" mb="2" fontWeight="semibold">
              New week from template
            </Heading>
            <HStack gap="2" align="flex-end" flexWrap="wrap" w="100%">
              <NativeSelectRoot size="sm" flex="1" minW="min(100%, 12rem)">
                <NativeSelectField
                  {...PANEL_FIELD_PROPS}
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Select template</option>
                  {templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
              <Input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                flex="0 1 auto"
                w={{ base: "100%", sm: "auto" }}
                minW={{ base: "100%", sm: "10rem" }}
                {...PANEL_FIELD_PROPS}
              />
              <PondButton
                colorPalette="lilypad"
                flexShrink={0}
                disabled={!templateId}
                onClick={() => {
                  void (async () => {
                    try {
                      const t = await getApiAccessToken();
                      await createInstance(t, {
                        template_id: Number(templateId),
                        week_start: weekStart,
                      });
                      await refresh();
                      setErr(null);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Create failed");
                    }
                  })();
                }}
              >
                Create week plan
              </PondButton>
            </HStack>
          </Card.Body>
        </Card.Root>
      ) : null}

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
        {sortedInstances.map((i) => (
          <RouterLink
            key={i.id}
            to={`/meal/plans/weeks/${i.id}`}
            aria-label={`Edit meal plan for week of ${formatWeekStartShort(i.week_start)}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" {...MEAL_NAV_LINK_CARD_PROPS}>
              <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                <MealReadonlyGrid
                  slots={i.slots}
                  slotsPerDay={slotsPerDayForInstance(i, templates)}
                  weekStartsOn={weekStartsOn}
                  mealsById={mealsById}
                  headerMode="dates"
                  weekStartIso={i.week_start}
                />
              </Card.Body>
            </Card.Root>
          </RouterLink>
        ))}
      </Stack>
    </Stack>
  );
}
