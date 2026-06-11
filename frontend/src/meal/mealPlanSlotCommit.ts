import {
  createInstance,
  fetchInstances,
  patchInstanceGrid,
} from "./api";
import {
  dayIndexInInstance,
  instanceCoveringDate,
  parseLocalDate,
  pythonWeekday,
} from "./mealPlanDates";
import type { InstanceSlot, MealPlanInstance } from "./types";

export type CommitPlanSlotContext = {
  selectedDateIso: string;
  selectedWeekStart: string;
  weekStartsOn: number;
  slotIndex: number;
  instancesRef: { current: MealPlanInstance[] };
  setInstances: (next: MealPlanInstance[]) => void;
  setDraftSlots: (updater: (prev: InstanceSlot[]) => InstanceSlot[]) => void;
  getApiAccessToken: () => Promise<string>;
  resyncSessionSilently: () => Promise<void>;
  refreshInstances?: () => Promise<MealPlanInstance[]>;
  onGridCommitted?: () => void;
};

function mergePatchedInstance(
  prev: MealPlanInstance[],
  patched: MealPlanInstance,
): MealPlanInstance[] {
  const mapped = prev.map((x) => (x.id === patched.id ? patched : x));
  return mapped.some((x) => x.id === patched.id) ? mapped : [...mapped, patched];
}

/** Assign or clear meals for one plan slot on a calendar day. */
export async function commitPlanSlot(
  ctx: CommitPlanSlotContext,
  selected: number[],
): Promise<void> {
  const tok = await ctx.getApiAccessToken();
  const selectedDate = parseLocalDate(ctx.selectedDateIso);
  const dayIdxFallback = (pythonWeekday(selectedDate) - ctx.weekStartsOn + 7) % 7;

  const applyPatch = (patched: MealPlanInstance) => {
    const merged = mergePatchedInstance(ctx.instancesRef.current, patched);
    ctx.instancesRef.current = merged;
    ctx.setInstances(merged);
  };

  let cov = instanceCoveringDate(ctx.instancesRef.current, selectedDate);
  let slotDayIdx =
    cov != null
      ? (dayIndexInInstance(cov, selectedDate) ?? dayIdxFallback)
      : dayIdxFallback;

  if (cov) {
    const next = await patchInstanceGrid(tok, cov.id, [
      { day_index: slotDayIdx, slot_index: ctx.slotIndex, meal_ids: selected },
    ]);
    applyPatch(next);
    void ctx.resyncSessionSilently().catch(() => {});
    ctx.onGridCommitted?.();
    return;
  }

  if (selected.length === 0) {
    const fresh = await (ctx.refreshInstances?.() ?? fetchInstances(tok));
    cov = instanceCoveringDate(fresh, selectedDate);
    if (cov) {
      ctx.instancesRef.current = fresh;
      ctx.setInstances(fresh);
      slotDayIdx = dayIndexInInstance(cov, selectedDate) ?? dayIdxFallback;
      const next = await patchInstanceGrid(tok, cov.id, [
        { day_index: slotDayIdx, slot_index: ctx.slotIndex, meal_ids: selected },
      ]);
      applyPatch(next);
      void ctx.resyncSessionSilently().catch(() => {});
      ctx.onGridCommitted?.();
      return;
    }
    ctx.setDraftSlots((prev) =>
      prev.map((slot) =>
        slot.slot_index === ctx.slotIndex ? { ...slot, meal_ids: selected } : slot,
      ),
    );
    return;
  }

  const fresh = await (ctx.refreshInstances?.() ?? fetchInstances(tok));
  cov = instanceCoveringDate(fresh, selectedDate);
  if (cov) {
    ctx.instancesRef.current = fresh;
    ctx.setInstances(fresh);
    slotDayIdx = dayIndexInInstance(cov, selectedDate) ?? dayIdxFallback;
    const next = await patchInstanceGrid(tok, cov.id, [
      { day_index: slotDayIdx, slot_index: ctx.slotIndex, meal_ids: selected },
    ]);
    applyPatch(next);
    void ctx.resyncSessionSilently().catch(() => {});
    ctx.onGridCommitted?.();
    return;
  }

  ctx.setDraftSlots((prev) =>
    prev.map((slot) =>
      slot.slot_index === ctx.slotIndex ? { ...slot, meal_ids: selected } : slot,
    ),
  );

  const created = await createInstance(tok, { week_start: ctx.selectedWeekStart });
  const updated = await patchInstanceGrid(tok, created.id, [
    { day_index: slotDayIdx, slot_index: ctx.slotIndex, meal_ids: selected },
  ]);
  const merged = mergePatchedInstance(
    [...ctx.instancesRef.current.filter((x) => x.id !== updated.id)],
    updated,
  );
  ctx.instancesRef.current = merged;
  ctx.setInstances(merged);
  void ctx.resyncSessionSilently().catch(() => {});
  ctx.onGridCommitted?.();
}
