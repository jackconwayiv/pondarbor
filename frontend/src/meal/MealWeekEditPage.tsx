import { Card, Heading, HStack, NativeSelectField, NativeSelectRoot, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import {
  createInstance,
  createMeal,
  createTemplate,
  fetchInstances,
  fetchMeals,
  fetchTemplates,
  patchInstanceGrid,
  patchTemplateGrid,
} from "./api";
import { MealEditorBackdropDismiss } from "./MealEditorBackdropDismiss";
import MealSlotGrid from "./MealSlotGrid";
import { resolveSlotLabels } from "./mealSlotLabels";
import { formatWeekStartShort } from "./mealPlanDates";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { InstanceSlot, Meal, MealPlanInstance, MealPlanTemplate } from "./types";

function defaultSlots(slotsPerDay: number): InstanceSlot[] {
  const out: InstanceSlot[] = [];
  for (let d = 0; d < 7; d++) {
    for (let s = 0; s < slotsPerDay; s++) {
      out.push({ day_index: d, slot_index: s, meal_ids: [] });
    }
  }
  return out;
}

function hasAnyMeals(slots: InstanceSlot[]): boolean {
  return slots.some((slot) => slot.meal_ids.length > 0);
}

function mergedSlots(slotsPerDay: number, source: InstanceSlot[]): InstanceSlot[] {
  const out = defaultSlots(slotsPerDay);
  for (const row of source) {
    const idx = out.findIndex((x) => x.day_index === row.day_index && x.slot_index === row.slot_index);
    if (idx >= 0) out[idx] = { ...out[idx], meal_ids: row.meal_ids.slice() };
  }
  return out;
}

function isValidWeekStartIso(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function MealWeekEditPage() {
  const [searchParams] = useSearchParams();
  const weekStart = searchParams.get("week") ?? "";
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [draftSlots, setDraftSlots] = useState<InstanceSlot[]>([]);
  const [applyTemplateId, setApplyTemplateId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** When editing a draft, template apply may change slot count; keep in sync with grid. */
  const [draftSlotsPerDay, setDraftSlotsPerDay] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const weekStartsOn = sessionUser?.profile.meal_week_starts_on ?? 0;

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const [i, tpl, ml] = await Promise.all([fetchInstances(t), fetchTemplates(t), fetchMeals(t)]);
    setInstances(i);
    setTemplates(tpl);
    setMeals(ml);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved || !isValidWeekStartIso(weekStart)) return;
    setHydrated(false);
    const timer = window.setTimeout(() => {
      void refresh()
        .catch((e) => setErr(e instanceof Error ? e.message : "Load failed"))
        .finally(() => setHydrated(true));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionUser?.user.is_approved, weekStart, refresh]);

  const instanceByWeek = useMemo(
    () => new Map(instances.map((inst) => [inst.week_start, inst])),
    [instances],
  );
  const existing = instanceByWeek.get(weekStart) ?? null;
  const firstTemplateId = templates[0]?.id ?? null;

  function slotsPerDayForInstance(inst: MealPlanInstance): number {
    const tpl =
      inst.source_template != null ? templates.find((t) => t.id === inst.source_template) : undefined;
    if (tpl) return tpl.slots_per_day;
    const maxS = inst.slots.reduce((acc, s) => Math.max(acc, s.slot_index + 1), 1);
    return Math.max(1, maxS);
  }

  const defaultSlotsPerDay = Math.max(templates[0]?.slots_per_day ?? 3, 1);
  const slotsPerDay = existing
    ? slotsPerDayForInstance(existing)
    : draftSlotsPerDay ?? defaultSlotsPerDay;
  const slots = mergedSlots(slotsPerDay, draftSlots.length ? draftSlots : (existing?.slots ?? []));

  useEffect(() => {
    if (existing) return;
    setDraftSlots((prev) => {
      if (prev.length > 0) return prev;
      return defaultSlots(slotsPerDay);
    });
  }, [existing, slotsPerDay]);

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
        Missing or invalid week. Use a date link from Weekly.
      </Text>
    );
  }
  if (!hydrated) {
    return <MealLoading />;
  }
  if (existing) {
    return <Navigate to={`/meal/plan/plans/${existing.id}`} replace />;
  }

  const slotLabels = resolveSlotLabels(slotsPerDay, sessionUser.profile.meal_slot_labels);

  return (
    <MealEditorBackdropDismiss dismissTo="/meal/plan/plans" disabled={busy}>
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper}>
        <RouterLink to="/meal/plan/plans">
          <Text as="span" color="lilypad.solid" fontWeight="bold">
            ← Weekly overview
          </Text>
        </RouterLink>
      </Text>
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Unsaved weeks stay local until at least one meal is entered.
      </Text>

      <Card.Root {...PANEL_ENTRY_CARD_PROPS} p="0">
        <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS}>
          <Stack gap="3">
            <HStack justify="space-between" align="center" flexWrap="wrap" w="100%">
              <Heading size="sm" fontWeight="semibold">
                Week of {formatWeekStartShort(weekStart)}
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                Unsaved week draft
              </Text>
            </HStack>

            <HStack gap="2" flexWrap="wrap" align="flex-end">
              <NativeSelectRoot size="sm" minW="12rem">
                <NativeSelectField
                  {...PANEL_FIELD_PROPS}
                  value={applyTemplateId}
                  onChange={(e) => setApplyTemplateId(e.target.value)}
                >
                  <option value="">Template for import</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
              <PondButton
                colorPalette="lilypad"
                variant="outline"
                disabled={!applyTemplateId || busy}
                onClick={() => {
                  const chosenTemplate = templates.find((t) => t.id === Number(applyTemplateId));
                  if (!chosenTemplate) return;
                  const hasData = hasAnyMeals(slots);
                  let mode: "overwrite" | "preserve" = "overwrite";
                  if (hasData) {
                    const choice = window.prompt(
                      "This week already has data. Type overwrite or preserve.",
                      "preserve",
                    );
                    if (choice !== "overwrite" && choice !== "preserve") return;
                    mode = choice;
                  }
                  const nextSlots = mergedSlots(chosenTemplate.slots_per_day, slots);
                  const tplSlots = mergedSlots(chosenTemplate.slots_per_day, chosenTemplate.slots);
                  const merged = nextSlots.map((cell) => {
                    const src = tplSlots.find(
                      (x) => x.day_index === cell.day_index && x.slot_index === cell.slot_index,
                    );
                    if (!src) return cell;
                    if (mode === "overwrite") return { ...cell, meal_ids: src.meal_ids.slice() };
                    if (cell.meal_ids.length > 0) return cell;
                    return { ...cell, meal_ids: src.meal_ids.slice() };
                  });
                  setDraftSlotsPerDay(chosenTemplate.slots_per_day);
                  setDraftSlots(merged);
                }}
              >
                Apply Template
              </PondButton>
              <PondButton
                colorPalette="sky"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    const name = window.prompt("Template name", `Week of ${formatWeekStartShort(weekStart)}`);
                    if (!name?.trim()) return;
                    try {
                      setBusy(true);
                      const tok = await getApiAccessToken();
                      const created = await createTemplate(tok, { name: name.trim(), slots_per_day: slotsPerDay });
                      await patchTemplateGrid(tok, created.id, slots);
                      await refresh();
                      setErr(null);
                    } catch (e) {
                      setErr(e instanceof Error ? e.message : "Template export failed");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Export as Template
              </PondButton>
            </HStack>

            <MealSlotGrid
              slots={slots}
              slotsPerDay={slotsPerDay}
              weekStartsOn={weekStartsOn}
              weekStartIso={weekStart}
              slotLabels={slotLabels}
              meals={meals}
              disabled={busy}
              createMeal={async (body) => {
                const tok = await getApiAccessToken();
                return createMeal(tok, body);
              }}
              onMealCreated={(m) =>
                setMeals((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
              }
              onCellChange={async (dayIndex, slotIndex, mealIds) => {
                const nextSlots = slots.map((slot) =>
                  slot.day_index === dayIndex && slot.slot_index === slotIndex
                    ? { ...slot, meal_ids: mealIds }
                    : slot,
                );
                setDraftSlots(nextSlots);
                if (!hasAnyMeals(nextSlots)) return;
                try {
                  setBusy(true);
                  const tok = await getApiAccessToken();
                  const templateId = Number(applyTemplateId) || firstTemplateId;
                  if (!templateId) {
                    setErr("Create at least one template before saving week plans.");
                    throw new Error("No template");
                  }
                  const created = await createInstance(tok, { template_id: templateId, week_start: weekStart });
                  const updated = await patchInstanceGrid(tok, created.id, nextSlots);
                  setInstances((prev) => [...prev.filter((x) => x.id !== updated.id), updated]);
                  navigate(`/meal/plan/plans/${updated.id}`, { replace: true });
                  setErr(null);
                  void refreshSession().catch(() => {});
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Save week failed");
                  throw e;
                } finally {
                  setBusy(false);
                }
              }}
              onApplySlotToAllDays={async (slotIndex, mealIds) => {
                const nextSlots = slots.map((slot) =>
                  slot.slot_index === slotIndex ? { ...slot, meal_ids: mealIds.slice() } : slot,
                );
                setDraftSlots(nextSlots);
                if (!hasAnyMeals(nextSlots)) return;
                try {
                  setBusy(true);
                  const tok = await getApiAccessToken();
                  const templateId = Number(applyTemplateId) || firstTemplateId;
                  if (!templateId) {
                    setErr("Create at least one template before saving week plans.");
                    throw new Error("No template");
                  }
                  const created = await createInstance(tok, { template_id: templateId, week_start: weekStart });
                  const updated = await patchInstanceGrid(tok, created.id, nextSlots);
                  setInstances((prev) => [...prev.filter((x) => x.id !== updated.id), updated]);
                  navigate(`/meal/plan/plans/${updated.id}`, { replace: true });
                  setErr(null);
                  void refreshSession().catch(() => {});
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Save week failed");
                  throw e;
                } finally {
                  setBusy(false);
                }
              }}
            />
          </Stack>
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
