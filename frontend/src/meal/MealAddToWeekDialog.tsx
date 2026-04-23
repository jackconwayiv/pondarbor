import { Box, NativeSelectField, NativeSelectRoot, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { createInstance, fetchInstances, fetchTemplates, patchInstanceGrid } from "./api";
import {
  addDaysIso,
  localDateIso,
  parseLocalDate,
  startOfLocalDay,
  startOfWeek,
} from "./mealPlanDates";
import { resolveSlotLabels } from "./mealSlotLabels";
import type { MealPlanInstance, MealPlanTemplate } from "./types";

/** e.g. "Monday 4/13" (weekday + M/D, no leading zeros on month/day). */
function formatDayPickerLabel(iso: string): string {
  const d = parseLocalDate(iso);
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${weekday} ${mo}/${day}`;
}

/** Today through 14 days later (15 calendar days). */
function upcomingDayOptions(): { iso: string; label: string }[] {
  const todayIso = localDateIso();
  return Array.from({ length: 15 }, (_, i) => {
    const iso = addDaysIso(todayIso, i);
    return { iso, label: formatDayPickerLabel(iso) };
  });
}

export type MealAddToWeekDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealId: number;
  mealTitle: string;
  weekStartsOn: number;
  mealSlotLabels: Record<string, string[]> | null | undefined;
  getApiAccessToken: () => Promise<string>;
  onPlanUpdated?: () => void;
  /** Called after a successful add so the parent can show an inline notice on the meal card. */
  onAddSuccess?: (message: string) => void;
};

export function MealAddToWeekDialog({
  open,
  onOpenChange,
  mealId,
  mealTitle,
  weekStartsOn,
  mealSlotLabels,
  getApiAccessToken,
  onPlanUpdated,
  onAddSuccess,
}: MealAddToWeekDialogProps) {
  const [instances, setInstances] = useState<MealPlanInstance[]>([]);
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState("");
  const [templateId, setTemplateId] = useState<number | "">("");
  const [mealSlotIndex, setMealSlotIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const dayOptions = useMemo(() => upcomingDayOptions(), []);

  const weekStartIso = useMemo(() => {
    if (!selectedDayIso) return "";
    return localDateIso(startOfWeek(parseLocalDate(selectedDayIso), weekStartsOn));
  }, [selectedDayIso, weekStartsOn]);

  const dayIndex = useMemo(() => {
    if (!selectedDayIso || !weekStartIso) return 0;
    const ws = startOfLocalDay(parseLocalDate(weekStartIso)).getTime();
    const d = startOfLocalDay(parseLocalDate(selectedDayIso)).getTime();
    return Math.round((d - ws) / 86400000);
  }, [selectedDayIso, weekStartIso]);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const t = await getApiAccessToken();
      const [instList, tplList] = await Promise.all([fetchInstances(t), fetchTemplates(t)]);
      setInstances(instList);
      setTemplates(tplList);
      setTemplateId((prev) => (prev === "" && tplList.length ? tplList[0].id : prev));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Load failed");
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open || !dayOptions.length) return;
    setSelectedDayIso((prev) =>
      prev && dayOptions.some((o) => o.iso === prev) ? prev : dayOptions[0].iso,
    );
  }, [open, dayOptions]);

  useEffect(() => {
    if (open) setActionErr(null);
  }, [open]);

  const chosenInstance = instances.find((i) => i.week_start === weekStartIso);
  const slotsPerDay = chosenInstance
    ? Math.max(1, ...chosenInstance.slots.map((s) => s.slot_index + 1))
    : templates.find((x) => x.id === templateId)?.slots_per_day ?? 3;

  const slotLabels = resolveSlotLabels(slotsPerDay, mealSlotLabels);

  useEffect(() => {
    setMealSlotIndex((s) => Math.min(s, Math.max(0, slotsPerDay - 1)));
  }, [slotsPerDay]);

  async function resolveInstance(): Promise<MealPlanInstance> {
    const existing = instances.find((i) => i.week_start === weekStartIso);
    if (existing) return existing;
    const tid = Number(templateId);
    if (!tid) {
      throw new Error("Create at least one template before saving week plans.");
    }
    const t = await getApiAccessToken();
    try {
      return await createInstance(t, { template_id: tid, week_start: weekStartIso });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("already have a plan") || msg.includes("week")) {
        const instList = await fetchInstances(await getApiAccessToken());
        setInstances(instList);
        const again = instList.find((i) => i.week_start === weekStartIso);
        if (again) return again;
      }
      throw e;
    }
  }

  async function handleAdd() {
    setBusy(true);
    setActionErr(null);
    const dayLabel = selectedDayIso ? formatDayPickerLabel(selectedDayIso) : "";
    try {
      const inst = await resolveInstance();
      const slot = inst.slots.find(
        (s) => s.day_index === dayIndex && s.slot_index === mealSlotIndex,
      );
      const mealIds = [...(slot?.meal_ids ?? [])];
      if (!mealIds.includes(mealId)) {
        mealIds.push(mealId);
      }
      const t = await getApiAccessToken();
      const updated = await patchInstanceGrid(t, inst.id, [
        { day_index: dayIndex, slot_index: mealSlotIndex, meal_ids: mealIds },
      ]);
      setInstances((prev) => [...prev.filter((x) => x.id !== updated.id), updated]);
      onPlanUpdated?.();
      const successMessage = dayLabel ? `Meal added to ${dayLabel}` : "Meal added";
      onAddSuccess?.(successMessage);
      onOpenChange(false);
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Could not add meal");
    } finally {
      setBusy(false);
    }
  }

  const noTemplates = templates.length === 0;
  const titleSafe = mealTitle.trim() || "this meal";

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add to meal plan"
      description={`Place “${titleSafe}” in a meal on the day you choose below.`}
      size="md"
    >
      <Stack gap="3">
        {loadErr || actionErr ? (
          <Box
            w="100%"
            borderWidth="1px"
            borderColor="nautical.solid"
            borderRadius="md"
            p="2"
            role="alert"
          >
            <Stack gap="1">
              {loadErr ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium">
                  {loadErr}
                </Text>
              ) : null}
              {actionErr ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" fontWeight="medium">
                  {actionErr}
                </Text>
              ) : null}
            </Stack>
          </Box>
        ) : null}
        {noTemplates ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Create at least one template before saving week plans.
          </Text>
        ) : (
          <>
            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.helper}>Day</Text>
              <NativeSelectRoot maxW="100%" disabled={busy}>
                <NativeSelectField
                  value={selectedDayIso}
                  onChange={(e) => setSelectedDayIso(e.target.value)}
                >
                  {dayOptions.map((o) => (
                    <option key={o.iso} value={o.iso}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Stack>
            {!chosenInstance ? (
              <Stack gap="1">
                <Text fontSize={APP_TEXT_SIZES.helper}>Template (for new week)</Text>
                <NativeSelectRoot maxW="100%" disabled={busy}>
                  <NativeSelectField
                    value={templateId === "" ? "" : String(templateId)}
                    onChange={(e) => setTemplateId(Number(e.target.value))}
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </NativeSelectField>
                </NativeSelectRoot>
              </Stack>
            ) : null}
            <Stack gap="1">
              <Text fontSize={APP_TEXT_SIZES.helper}>Meal</Text>
              <NativeSelectRoot maxW="100%" disabled={busy}>
                <NativeSelectField
                  value={String(mealSlotIndex)}
                  onChange={(e) => setMealSlotIndex(Number(e.target.value))}
                >
                  {slotLabels.map((label, s) => (
                    <option key={s} value={String(s)}>
                      {label}
                    </option>
                  ))}
                </NativeSelectField>
              </NativeSelectRoot>
            </Stack>
          </>
        )}
        <PondButton
          colorPalette="teal"
          loading={busy}
          disabled={busy || noTemplates || !selectedDayIso}
          onClick={() => void handleAdd()}
        >
          Add to meal
        </PondButton>
      </Stack>
    </AppModal>
  );
}
