import { Card, Heading, HStack, Input, NativeSelectField, NativeSelectRoot, Stack, Text } from "@chakra-ui/react";
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
import { createTemplate, fetchMeals, fetchTemplates } from "./api";
import { MealReadonlyGrid } from "./MealReadonlyGrid";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { Meal, MealPlanTemplate } from "./types";

export default function MealTemplatesPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [rows, setRows] = useState<MealPlanTemplate[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [name, setName] = useState("");
  const [slotsPerDay, setSlotsPerDay] = useState(3);
  const [err, setErr] = useState<string | null>(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;
  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [tpl, ml] = await Promise.all([fetchTemplates(t), fetchMeals(t)]);
    setRows(tpl);
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
        Reusable week grids. Use one when you add a new week under Weeks.
      </Text>
      <PondButton
        colorPalette="sky"
        variant="outline"
        alignSelf="flex-start"
        onClick={() => setShowAddTemplate((v) => !v)}
      >
        {showAddTemplate ? "Hide" : "Add a Template"}
      </PondButton>

      {showAddTemplate ? (
        <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
          <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
            <Heading size="sm" mb="2" fontWeight="semibold">
              New template
            </Heading>
            <HStack gap="2" align="flex-end" flexWrap="wrap" w="100%">
              <Input
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                flex="1"
                minW="min(100%, 10rem)"
                {...PANEL_FIELD_PROPS}
              />
              <NativeSelectRoot size="sm" w={{ base: "100%", sm: "9rem" }} flexShrink={0}>
                <NativeSelectField
                  {...PANEL_FIELD_PROPS}
                  value={String(slotsPerDay)}
                  onChange={(e) => setSlotsPerDay(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} meal{n === 1 ? "" : "s"} / day
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
              <PondButton
                colorPalette="lilypad"
                flexShrink={0}
                disabled={!name.trim()}
                onClick={() => {
                  void (async () => {
                    try {
                      const t = await getApiAccessToken();
                      await createTemplate(t, { name: name.trim(), slots_per_day: slotsPerDay });
                      setName("");
                      setShowAddTemplate(false);
                      await refresh();
                      setErr(null);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Save failed");
                    }
                  })();
                }}
              >
                Create template
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
        {rows.map((t) => (
          <RouterLink
            key={t.id}
            to={`/meal/plan/templates/${t.id}`}
            aria-label={`Edit template ${t.name}`}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0" {...MEAL_NAV_LINK_CARD_PROPS}>
              <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
                <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} mb="2" lineClamp={2}>
                  {t.name}
                </Text>
                <MealReadonlyGrid
                  slots={t.slots}
                  slotsPerDay={t.slots_per_day}
                  weekStartsOn={weekStartsOn}
                  mealsById={mealsById}
                  headerMode="weekdays"
                />
              </Card.Body>
            </Card.Root>
          </RouterLink>
        ))}
      </Stack>
    </Stack>
  );
}
