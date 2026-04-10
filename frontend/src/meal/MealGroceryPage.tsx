import {
  Card,
  Heading,
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
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { fetchInstances, generateGrocery } from "./api";
import { formatWeekStartShort } from "./mealPlanDates";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { GroceryList, MealPlanInstance } from "./types";

export default function MealGroceryPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [grocery, setGrocery] = useState<GroceryList | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [groceryErr, setGroceryErr] = useState<string | null>(null);

  const sortedInstances = useMemo(
    () => [...instances].sort((a, b) => a.week_start.localeCompare(b.week_start)),
    [instances],
  );

  const refreshInstances = useCallback(async () => {
    const t = await getApiAccessToken();
    setInstances(await fetchInstances(t));
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    const tid = window.setTimeout(() => {
      void refreshInstances().catch((e) =>
        setLoadErr(e instanceof Error ? e.message : "Load failed"),
      );
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, refreshInstances]);

  const loadGroceryForInstance = useCallback(
    async (instanceId: number) => {
      setGrocery(null);
      setGroceryErr(null);
      const t = await getApiAccessToken();
      const g = await generateGrocery(t, instanceId);
      setGrocery(g);
    },
    [getApiAccessToken],
  );

  /** Week id aligned to `sortedInstances` and user selection (no sync setState in effects). */
  const resolvedSelection = useMemo(() => {
    if (!sortedInstances.length) return "";
    if (selectedId && sortedInstances.some((i) => String(i.id) === selectedId)) {
      return selectedId;
    }
    return String(sortedInstances[0].id);
  }, [sortedInstances, selectedId]);

  useEffect(() => {
    if (resolvedSelection === "") return;
    const iid = Number(resolvedSelection);
    if (!Number.isFinite(iid)) return;
    const timer = window.setTimeout(() => {
      void loadGroceryForInstance(iid).catch((e) =>
        setGroceryErr(e instanceof Error ? e.message : "Could not load grocery list"),
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [resolvedSelection, loadGroceryForInstance]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  const selectedInstance =
    resolvedSelection !== ""
      ? sortedInstances.find((i) => String(i.id) === resolvedSelection)
      : undefined;

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Heading as="h2" size="md" fontWeight="bold">
        Grocery list
      </Heading>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Pick a planned week. The list is built from meal ingredients. Regenerate after you
        change the week grid on the week editor.
      </Text>

      {loadErr ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {loadErr}
        </Text>
      ) : null}

      {!sortedInstances.length ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
          No week plans yet. Create one under{" "}
          <RouterLink to="/meal/plans/today">
            <Text as="span" color="lilypad.solid" fontWeight="bold">
              Plans
            </Text>
          </RouterLink>
          .
        </Text>
      ) : (
        <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP}>
          <NativeSelectRoot size="sm" maxW="md">
            <NativeSelectField
              {...PANEL_FIELD_PROPS}
              value={resolvedSelection}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {sortedInstances.map((i) => (
                <option key={i.id} value={i.id}>
                  Week of {formatWeekStartShort(i.week_start)}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>

          {selectedInstance ? (
            <Text fontSize={APP_TEXT_SIZES.helper}>
              <RouterLink to={`/meal/plans/weeks/${selectedInstance.id}`}>
                <Text as="span" color="lilypad.solid" fontWeight="bold">
                  Edit week plan
                </Text>
              </RouterLink>{" "}
              <Text as="span" color="fg.muted">
                (grid & meals)
              </Text>
            </Text>
          ) : null}

          <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
              <Heading size="sm" mb="2" fontWeight="semibold">
                Ingredients
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" mb="2">
                Regenerate if you changed meal slots or meal ingredients since this list was built.
              </Text>
              <PondButton
                colorPalette="lilypad"
                onClick={() => {
                  if (resolvedSelection === "") return;
                  void loadGroceryForInstance(Number(resolvedSelection)).catch((e) =>
                    setGroceryErr(e instanceof Error ? e.message : "Generate failed"),
                  );
                }}
              >
                Generate / refresh grocery list
              </PondButton>
              {groceryErr ? (
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  fontWeight="medium"
                  color="nautical.solid"
                  role="alert"
                  mt="2"
                >
                  {groceryErr}
                </Text>
              ) : null}
              {grocery?.items?.length ? (
                <Stack as="ul" gap="1" mt="3" pl="4" fontSize={APP_TEXT_SIZES.body}>
                  {grocery.items.map((it) => (
                    <li key={it.id}>{it.display_text}</li>
                  ))}
                </Stack>
              ) : grocery ? (
                <Text fontSize={APP_TEXT_SIZES.helper} mt="2" color="fg.muted">
                  No ingredient lines (add ingredients to meals in this week).
                </Text>
              ) : null}
            </Card.Body>
          </Card.Root>
        </Stack>
      )}
    </Stack>
  );
}
