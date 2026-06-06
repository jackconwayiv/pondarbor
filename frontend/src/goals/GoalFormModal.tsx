import {
  Box,
  Field,
  HStack,
  Input,
  RadioGroup,
  Stack,
  Switch,
  Tabs,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AppModal } from "../components/AppModal";
import { CLOSET_MODAL_TAB_LIST_PROPS } from "../closet/closetModalTabs";
import PondButton from "../PondButton";
import { APP_SHELL_TAB_TRIGGER_PROPS } from "../theme/appShellTabs";
import {
  checkInGoal,
  createCheckpoint,
  createGoal,
  deleteCheckpoint,
  deleteGoal,
  fetchGoal,
  patchCheckpoint,
  patchGoal,
  undoGoal,
} from "./api";
import type { FrequencyKind, Goal, GoalKind, GoalStatus } from "./types";
import {
  isCompletedGoalLocked,
  isGoalModalStatsOnly,
  goalHoldProgressDisabled,
  goalStatsGoldButtonLabel,
  showMarkGoalCompleteButton,
} from "./goalCardLabels";
import { mergeGoalIfNewer } from "./goalMerge";
import {
  CHECKPOINT_TITLE_MAX,
  clampFrequencyCount,
  GOAL_DESCRIPTION_MAX,
  GOAL_TITLE_MAX,
} from "./goalFormLimits";
import {
  GOAL_KIND_CHORE_LABEL,
  GOAL_KIND_CONTINUOUS_LABEL,
  GOAL_KIND_ONE_TIME_LABEL,
} from "./goalCopy";
import { GoalFrequencyCountInput } from "./GoalFrequencyCountInput";
import { GoalIntervalMonthsInput } from "./GoalIntervalMonthsInput";
import { GoalMonthDayPicker } from "./GoalMonthDayPicker";
import { GoalWeekdayPicker } from "./GoalWeekdayPicker";
import { isTimesPerFrequency } from "./optimisticGoalUpdate";
import { GOAL_ADD_MILESTONE_BUTTON_PROPS, GOALS_THEME } from "./theme";

import "./goalsAddGoalButton.css";
import { GoalStatsModalLayout } from "./GoalStatsModalLayout";

type GoalFormModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  mode: "add" | "edit";
  accessToken: string | null;
  onSaved: () => void;
  /** Background refresh without the list loading state (inline modal actions). */
  onRefresh?: () => void;
  /** Keeps edit modal in sync after inline actions (pause, undo, check-in). */
  onGoalUpdated?: (goal: Goal) => void;
  /** Completable goals with milestones: open hold-style milestone picker. */
  onOpenMilestonePicker?: (goal: Goal) => void;
};

const KIND_OPTIONS: { value: GoalKind; label: string }[] = [
  { value: "continuous", label: GOAL_KIND_CONTINUOUS_LABEL },
  { value: "chore", label: GOAL_KIND_CHORE_LABEL },
  { value: "one_time", label: GOAL_KIND_ONE_TIME_LABEL },
];

const FREQ_OPTIONS: { value: FrequencyKind; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "monthly", label: "Every month" },
  { value: "every_n_months", label: "Every X months" },
  { value: "times_per_day", label: "X times per day" },
  { value: "times_per_week", label: "X times per week" },
  { value: "times_per_month", label: "X times per month" },
];

type ChoreScheduleMode = "standard" | "on_weekday" | "on_month_day";

const EDIT_TAB_STATS = "stats";
const EDIT_TAB_EDIT = "edit";

function GoalOptionRadios<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(details) => {
        const next = details.value;
        if (next) onChange(next as T);
      }}
      disabled={disabled}
    >
      <HStack gap="4" flexWrap="wrap" align="flex-start">
        {options.map((o) => (
          <RadioGroup.Item key={o.value} value={o.value}>
            <RadioGroup.ItemHiddenInput />
            <HStack gap="2" align="center">
              <RadioGroup.ItemIndicator />
              <RadioGroup.ItemText>{o.label}</RadioGroup.ItemText>
            </HStack>
          </RadioGroup.Item>
        ))}
      </HStack>
    </RadioGroup.Root>
  );
}

export function GoalFormModal({
  open,
  onOpenChange,
  goal,
  mode,
  accessToken,
  onSaved,
  onRefresh,
  onGoalUpdated,
  onOpenMilestonePicker,
}: GoalFormModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<GoalKind>("continuous");
  const [frequencyKind, setFrequencyKind] = useState<FrequencyKind>("daily");
  const [frequencyCount, setFrequencyCount] = useState(1);
  const [scheduleWeekday, setScheduleWeekday] = useState<number | null>(0);
  const [scheduleIntervalMonths, setScheduleIntervalMonths] = useState(2);
  const [scheduleMonthDay, setScheduleMonthDay] = useState<number | null>(1);
  const [choreScheduleMode, setChoreScheduleMode] = useState<ChoreScheduleMode>("standard");
  const [milestones, setMilestones] = useState<string[]>([]);
  const [newMilestone, setNewMilestone] = useState("");
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [statsNewMilestone, setStatsNewMilestone] = useState("");
  const [milestoneBusyId, setMilestoneBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modalGoal, setModalGoal] = useState<Goal | null>(null);
  const [editTab, setEditTab] = useState(EDIT_TAB_STATS);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const editSessionRef = useRef<{ open: boolean; goalId: string | null }>({
    open: false,
    goalId: null,
  });

  const displayGoal = mode === "edit" ? (modalGoal ?? goal) : goal;

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      setAddMilestoneOpen(false);
      setStatsNewMilestone("");
      setModalGoal(null);
      setSuccessMessage(null);
      editSessionRef.current = { open: false, goalId: null };
      return;
    }

    if (mode === "edit" && goal) {
      setModalGoal((prev) => mergeGoalIfNewer(prev, goal));
    }

    const goalId = mode === "edit" && goal ? goal.id : null;
    const isNewSession =
      !editSessionRef.current.open || editSessionRef.current.goalId !== goalId;
    editSessionRef.current = { open: true, goalId };

    setError(null);
    if (isNewSession && mode === "edit") {
      setEditTab(EDIT_TAB_STATS);
    }

    if (isNewSession) {
      setAddMilestoneOpen(false);
      setStatsNewMilestone("");
    }
    if (mode === "edit" && goal && isNewSession) {
      setTitle(goal.title);
      setDescription(goal.description);
      setKind(goal.kind);
      setFrequencyKind(goal.frequency_kind);
      setFrequencyCount(goal.frequency_count);
      setScheduleWeekday(goal.schedule_weekday);
      setScheduleIntervalMonths(goal.schedule_interval_months || 2);
      setScheduleMonthDay(goal.schedule_month_day);
      if (goal.kind === "chore") {
        if (goal.frequency_kind === "on_weekday") setChoreScheduleMode("on_weekday");
        else if (goal.frequency_kind === "on_month_day") setChoreScheduleMode("on_month_day");
        else setChoreScheduleMode("standard");
      } else {
        setChoreScheduleMode("standard");
      }
      setMilestones([]);
    } else if (mode === "add" && isNewSession) {
      setTitle("");
      setDescription("");
      setKind("continuous");
      setFrequencyKind("daily");
      setFrequencyCount(1);
      setScheduleWeekday(0);
      setScheduleIntervalMonths(2);
      setScheduleMonthDay(1);
      setChoreScheduleMode("standard");
      setMilestones([]);
    }
  }, [open, mode, goal]);

  const applyGoalUpdate = useCallback(
    (updated: Goal, success?: string) => {
      setModalGoal(updated);
      setError(null);
      if (success) setSuccessMessage(success);
      onGoalUpdated?.(updated);
    },
    [onGoalUpdated],
  );

  const buildOngoingPayload = useCallback(() => {
    const count = clampFrequencyCount(frequencyCount);
    const payload: {
      frequency_kind: FrequencyKind;
      frequency_count: number;
      schedule_weekday?: number | null;
      schedule_interval_weeks?: number;
      schedule_interval_months?: number;
      schedule_month_day?: number | null;
    } = {
      frequency_kind: frequencyKind,
      frequency_count: count,
    };
    if (kind === "chore" && choreScheduleMode === "on_weekday") {
      payload.frequency_kind = "on_weekday";
      payload.schedule_weekday = scheduleWeekday ?? 0;
      payload.schedule_interval_weeks = 1;
    } else if (kind === "chore" && choreScheduleMode === "on_month_day") {
      payload.frequency_kind = "on_month_day";
      payload.schedule_month_day = scheduleMonthDay ?? 1;
    } else if (frequencyKind === "every_n_months") {
      payload.frequency_kind = "every_n_months";
      payload.schedule_interval_months = scheduleIntervalMonths;
    }
    return payload;
  }, [
    choreScheduleMode,
    frequencyCount,
    frequencyKind,
    kind,
    scheduleIntervalMonths,
    scheduleMonthDay,
    scheduleWeekday,
  ]);

  const save = useCallback(async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "add") {
        const cps = milestones.map((m) => m.trim()).filter(Boolean);
        const ongoing =
          kind === "continuous" || kind === "chore" ? buildOngoingPayload() : {};
        await createGoal(
          {
            title: title.trim(),
            description: description.trim(),
            kind,
            ...ongoing,
            checkpoints: cps.map((t, i) => ({ title: t, sort_order: i })),
          },
          accessToken,
        );
      } else if (goal) {
        const updated = await patchGoal(
          goal.id,
          {
            title: title.trim(),
            description: description.trim(),
            kind,
            ...(kind === "continuous" || kind === "chore" ? buildOngoingPayload() : {}),
          },
          accessToken,
        );
        onGoalUpdated?.(updated);
      }
      onSaved();
      onOpenChange(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }, [
    accessToken,
    buildOngoingPayload,
    description,
    goal,
    kind,
    milestones,
    mode,
    onGoalUpdated,
    onOpenChange,
    onSaved,
    title,
  ]);

  const handlePauseToggle = async (paused: boolean) => {
    if (!displayGoal || displayGoal.status === "completed") return;
    const nextStatus: GoalStatus = paused ? "paused" : "active";
    if (displayGoal.status === nextStatus) return;
    setPauseBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await patchGoal(displayGoal.id, { status: nextStatus }, accessToken);
      applyGoalUpdate(updated, paused ? "Goal paused." : "Goal resumed.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setPauseBusy(false);
    }
  };

  const setStatus = async (status: GoalStatus) => {
    if (!displayGoal) return;
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await patchGoal(displayGoal.id, { status }, accessToken);
      applyGoalUpdate(updated, status === "completed" ? "Goal marked complete." : undefined);
      if (status === "completed") {
        setEditTab(EDIT_TAB_STATS);
      } else {
        onOpenChange(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleUndo = async () => {
    if (!displayGoal) return;
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await undoGoal(displayGoal.id, accessToken);
      applyGoalUpdate(updated, "Last action undone.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Undo failed.");
    } finally {
      setBusy(false);
    }
  };

  /** Stats tab: ongoing = check in for today; completable = milestone picker or archive goal. */
  const handleStatsCompleteClick = () => {
    if (!displayGoal) return;
    if (displayGoal.kind === "continuous" || displayGoal.kind === "chore") {
      void handleCheckIn();
      return;
    }
    if (displayGoal.checkpoints.length > 0 && onOpenMilestonePicker) {
      onOpenMilestonePicker(displayGoal);
      return;
    }
    void setStatus("completed");
  };

  const handleCheckIn = async () => {
    if (!displayGoal) return;
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await checkInGoal(displayGoal.id, accessToken);
      applyGoalUpdate(updated, "Checked in for today.");
      onRefresh?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const refreshGoalAfterCheckpoint = async (goalId: string, success: string) => {
    const updated = await fetchGoal(goalId, accessToken);
    applyGoalUpdate(updated, success);
  };

  const handleMilestoneToggle = async (checkpointId: string, completed: boolean) => {
    if (!displayGoal || displayGoal.status !== "active") return;
    setMilestoneBusyId(checkpointId);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = completed
        ? await checkInGoal(displayGoal.id, accessToken, checkpointId)
        : await patchCheckpoint(
            displayGoal.id,
            checkpointId,
            { completed_at: null },
            accessToken,
          );
      applyGoalUpdate(
        updated,
        completed ? "Checkpoint completed." : "Checkpoint unchecked.",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update checkpoint.");
    } finally {
      setMilestoneBusyId(null);
    }
  };

  const saveStatsMilestone = async () => {
    if (!displayGoal || !statsNewMilestone.trim()) return;
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await createCheckpoint(displayGoal.id, statsNewMilestone.trim(), accessToken);
      await refreshGoalAfterCheckpoint(displayGoal.id, "Checkpoint added.");
      setStatsNewMilestone("");
      setAddMilestoneOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  const addMilestoneRow = async () => {
    if (mode === "add") {
      setMilestones((m) => [...m, ""]);
      return;
    }
    if (!displayGoal || !newMilestone.trim()) return;
    setBusy(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await createCheckpoint(displayGoal.id, newMilestone.trim(), accessToken);
      setNewMilestone("");
      await refreshGoalAfterCheckpoint(displayGoal.id, "Checkpoint added.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  const editFormFields = (
    <>
      <Field.Root>
        <Field.Label>Title</Field.Label>
        <Input
          value={title}
          maxLength={GOAL_TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>Description (optional)</Field.Label>
        <Textarea
          value={description}
          maxLength={GOAL_DESCRIPTION_MAX}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field.Root>
      <Field.Root>
        <Field.Label>Goal type</Field.Label>
        <GoalOptionRadios
          value={kind}
          options={KIND_OPTIONS}
          onChange={setKind}
          disabled={mode === "edit"}
        />
      </Field.Root>
      {kind === "continuous" || kind === "chore" ? (
        <Stack gap="3">
          {kind === "continuous" ? (
            <>
              <Field.Root>
                <Field.Label>Frequency</Field.Label>
                <GoalOptionRadios
                  value={frequencyKind}
                  options={FREQ_OPTIONS}
                  onChange={setFrequencyKind}
                />
              </Field.Root>
              {isTimesPerFrequency(frequencyKind) ? (
                <Field.Root width="full" maxW="11rem">
                  <Field.Label>Count</Field.Label>
                  <GoalFrequencyCountInput
                    value={frequencyCount}
                    onChange={setFrequencyCount}
                  />
                </Field.Root>
              ) : null}
              {frequencyKind === "every_n_months" ? (
                <GoalIntervalMonthsInput
                  value={scheduleIntervalMonths}
                  onChange={setScheduleIntervalMonths}
                />
              ) : null}
            </>
          ) : (
            <>
              <Field.Root>
                <Field.Label>Frequency</Field.Label>
                <GoalOptionRadios
                  value={choreScheduleMode === "standard" ? frequencyKind : choreScheduleMode}
                  options={[
                    ...FREQ_OPTIONS,
                    { value: "on_weekday" as FrequencyKind, label: "Specific day each week" },
                    { value: "on_month_day" as FrequencyKind, label: "Monthly on a date" },
                  ]}
                  onChange={(next) => {
                    if (next === "on_weekday") {
                      setChoreScheduleMode("on_weekday");
                      setFrequencyKind("on_weekday");
                      setScheduleWeekday((v) => v ?? 0);
                      return;
                    }
                    if (next === "on_month_day") {
                      setChoreScheduleMode("on_month_day");
                      setFrequencyKind("on_month_day");
                      setScheduleMonthDay((v) => v ?? 1);
                      return;
                    }
                    setChoreScheduleMode("standard");
                    setFrequencyKind(next);
                  }}
                />
              </Field.Root>
              {choreScheduleMode === "standard" && isTimesPerFrequency(frequencyKind) ? (
                <Field.Root width="full" maxW="11rem">
                  <Field.Label>Count</Field.Label>
                  <GoalFrequencyCountInput
                    value={frequencyCount}
                    onChange={setFrequencyCount}
                  />
                </Field.Root>
              ) : null}
              {choreScheduleMode === "standard" && frequencyKind === "every_n_months" ? (
                <GoalIntervalMonthsInput
                  value={scheduleIntervalMonths}
                  onChange={setScheduleIntervalMonths}
                />
              ) : null}
              {choreScheduleMode === "on_weekday" ? (
                <Field.Root>
                  <Field.Label>Day of week (Mon–Sun)</Field.Label>
                  <GoalWeekdayPicker
                    value={scheduleWeekday}
                    onChange={setScheduleWeekday}
                  />
                </Field.Root>
              ) : null}
              {choreScheduleMode === "on_month_day" ? (
                <GoalMonthDayPicker
                  value={scheduleMonthDay}
                  onChange={setScheduleMonthDay}
                />
              ) : null}
            </>
          )}
        </Stack>
      ) : mode === "add" ? (
        <Stack gap="2">
          <Text fontWeight="medium" color={GOALS_THEME.textOnLight}>
            Checkpoints (optional)
          </Text>
          <PondButton
            size="sm"
            colorPalette="sky"
            alignSelf="flex-start"
            onClick={() => setMilestones((x) => [...x, ""])}
          >
            Add Checkpoint
          </PondButton>
          {milestones.map((m, i) => (
            <Input
              key={i}
              placeholder="Checkpoint name"
              maxLength={CHECKPOINT_TITLE_MAX}
              value={m}
              onChange={(e) => {
                const next = [...milestones];
                next[i] = e.target.value;
                setMilestones(next);
              }}
            />
          ))}
        </Stack>
      ) : displayGoal ? (
        <Stack gap="2">
          <Text fontWeight="medium" color={GOALS_THEME.textOnLight}>
            Checkpoints
          </Text>
          <PondButton
            size="sm"
            colorPalette="sky"
            alignSelf="flex-start"
            disabled={busy || !newMilestone.trim()}
            onClick={() => void addMilestoneRow()}
          >
            Add Checkpoint
          </PondButton>
          <Input
            placeholder="Checkpoint name"
            maxLength={CHECKPOINT_TITLE_MAX}
            value={newMilestone}
            onChange={(e) => setNewMilestone(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newMilestone.trim()) void addMilestoneRow();
            }}
          />
          {displayGoal.checkpoints.map((cp) => (
            <HStack key={cp.id} justify="space-between">
              <Text fontSize="sm">
                {cp.completed_at ? "✅" : "⬜"} {cp.title}
              </Text>
              {!cp.completed_at ? (
                <PondButton
                  size="xs"
                  variant="ghost"
                  onClick={() =>
                    void deleteCheckpoint(displayGoal.id, cp.id, accessToken).then(onSaved)
                  }
                >
                  Remove
                </PondButton>
              ) : null}
            </HStack>
          ))}
        </Stack>
      ) : null}

      {mode === "edit" && displayGoal && displayGoal.status !== "completed" ? (
        <Switch.Root
          checked={displayGoal.status === "paused"}
          onCheckedChange={(d) => void handlePauseToggle(!!d.checked)}
          disabled={pauseBusy}
          colorPalette="teal"
        >
          <Switch.HiddenInput />
          <HStack gap="3" align="center">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Label fontWeight="medium" color={GOALS_THEME.textOnLight}>
              Pause goal
            </Switch.Label>
          </HStack>
        </Switch.Root>
      ) : null}
    </>
  );

  const goalLocked = displayGoal != null && isCompletedGoalLocked(displayGoal);
  const goalStatsOnly = displayGoal != null && isGoalModalStatsOnly(displayGoal);

  const milestoneChecklistProps =
    displayGoal?.kind === "one_time" && displayGoal.checkpoints.length > 0
      ? !goalLocked && displayGoal.status === "active"
        ? {
            milestoneBusyCheckpointId: milestoneBusyId,
            onMilestoneToggle: (id: string, done: boolean) =>
              void handleMilestoneToggle(id, done),
          }
        : { milestoneBusyCheckpointId: null as string | null }
      : {};

  const statsActions =
    mode === "edit" && displayGoal ? (
      displayGoal.status === "completed" ? (
        displayGoal.can_undo ? (
          <Stack gap="2">
            <PondButton colorPalette="nautical" loading={busy} onClick={() => void handleUndo()}>
              Undo last action (10 min)
            </PondButton>
          </Stack>
        ) : null
      ) : (
        <Stack gap="2">
          {displayGoal.kind === "one_time" && displayGoal.status === "active" ? (
            addMilestoneOpen ? (
              <Stack gap="2">
                <Field.Root>
                  <Field.Label>Checkpoint name</Field.Label>
                  <Input
                    value={statsNewMilestone}
                    maxLength={CHECKPOINT_TITLE_MAX}
                    onChange={(e) => setStatsNewMilestone(e.target.value)}
                    placeholder="e.g. Finish draft"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && statsNewMilestone.trim()) {
                        void saveStatsMilestone();
                      }
                    }}
                  />
                </Field.Root>
                <HStack gap="2">
                  <PondButton
                    colorPalette="lilypad"
                    loading={busy}
                    disabled={!statsNewMilestone.trim()}
                    onClick={() => void saveStatsMilestone()}
                  >
                    Save checkpoint
                  </PondButton>
                  <PondButton
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setAddMilestoneOpen(false);
                      setStatsNewMilestone("");
                    }}
                  >
                    Cancel
                  </PondButton>
                </HStack>
              </Stack>
            ) : (
              <Box
                as="button"
                width="full"
                borderRadius="xl"
                px="4"
                py="2.5"
                fontSize="md"
                textAlign="center"
                cursor={busy ? "not-allowed" : "pointer"}
                opacity={busy ? 0.6 : 1}
                pointerEvents={busy ? "none" : "auto"}
                {...GOAL_ADD_MILESTONE_BUTTON_PROPS}
                onClick={() => setAddMilestoneOpen(true)}
              >
                Add checkpoint
              </Box>
            )
          ) : null}
          {showMarkGoalCompleteButton(displayGoal) ? (
            <Box
              as="button"
              className="goals-mark-complete-btn"
              width="full"
              borderRadius="xl"
              px="4"
              py="2.5"
              fontSize="md"
              textAlign="center"
              cursor={busy ? "not-allowed" : "pointer"}
              opacity={busy ? 0.6 : 1}
              pointerEvents={busy ? "none" : "auto"}
              onClick={() => void handleStatsCompleteClick()}
            >
              {goalStatsGoldButtonLabel(displayGoal)}
            </Box>
          ) : null}
          {displayGoal.can_undo ? (
            <PondButton colorPalette="nautical" loading={busy} onClick={() => void handleUndo()}>
              Undo last action (10 min)
            </PondButton>
          ) : null}
        </Stack>
      )
    ) : null;

  const statsModalLayoutProps = displayGoal
    ? {
        goal: displayGoal,
        ...milestoneChecklistProps,
        onBadgeHoldComplete: () => void handleStatsCompleteClick(),
        badgeHoldDisabled: goalHoldProgressDisabled(displayGoal, {
          locked: goalLocked,
          busy,
        }),
        actions: statsActions,
      }
    : null;

  const editActions =
    mode === "edit" && displayGoal ? (
      <Stack gap="2" pt="2" borderTopWidth="1px" borderColor="border">
        <PondButton
          ref={confirmDeleteButtonRef}
          colorPalette="nautical"
          loading={busy}
          onClick={(e) => {
            e.stopPropagation();
            if (!confirmDelete) {
              setConfirmDelete(true);
              return;
            }
            if (!displayGoal) return;
            void (async () => {
              setBusy(true);
              setError(null);
              try {
                await deleteGoal(displayGoal.id, accessToken);
                setConfirmDelete(false);
                onSaved();
                onOpenChange(false);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : "Delete failed.");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {confirmDelete ? "Confirm delete" : "Delete goal"}
        </PondButton>
      </Stack>
    ) : null;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "add" ? "Add goal" : displayGoal?.title ?? "Goal"}
      size="lg"
      rootProps={{ preventScroll: false }}
      bodyProps={{
        onPointerDownCapture: (event) => {
          if (!confirmDelete) return;
          const target = event.target as Node | null;
          if (!target) return;
          if (confirmDeleteButtonRef.current?.contains(target)) return;
          setConfirmDelete(false);
        },
      }}
    >
      <Stack gap="4">
        {mode === "edit" && displayGoal ? (
          goalStatsOnly ? (
            <GoalStatsModalLayout
              {...statsModalLayoutProps!}
              header={
                goalLocked ? (
                  <Text fontSize="sm" color={GOALS_THEME.textMuted}>
                    This goal is completed and locked. It can no longer be edited or undone.
                  </Text>
                ) : displayGoal.can_undo ? (
                  <Text fontSize="sm" color={GOALS_THEME.textMuted}>
                    This goal is completed. Only “Undo last action” is available for 10 minutes
                    after your most recent change.
                  </Text>
                ) : null
              }
            />
          ) : (
            <Tabs.Root
              value={editTab}
              onValueChange={(d) => setEditTab(d.value ?? EDIT_TAB_STATS)}
              variant="plain"
              w="100%"
            >
              <Tabs.List {...CLOSET_MODAL_TAB_LIST_PROPS}>
                <Tabs.Trigger value={EDIT_TAB_STATS} {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Goal stats
                </Tabs.Trigger>
                <Tabs.Trigger value={EDIT_TAB_EDIT} {...APP_SHELL_TAB_TRIGGER_PROPS}>
                  Edit goal
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value={EDIT_TAB_STATS} pt="3">
                {statsModalLayoutProps ? <GoalStatsModalLayout {...statsModalLayoutProps} /> : null}
              </Tabs.Content>
              <Tabs.Content value={EDIT_TAB_EDIT} pt="3">
                <Stack gap="4">
                  {editFormFields}
                  <HStack justify="flex-end" gap="2" flexWrap="wrap">
                    <PondButton colorPalette="lilypad" loading={busy} onClick={() => void save()}>
                      Save
                    </PondButton>
                  </HStack>
                  {editActions}
                </Stack>
              </Tabs.Content>
            </Tabs.Root>
          )
        ) : (
          <>
            {editFormFields}
            <HStack justify="flex-end" gap="2" flexWrap="wrap">
              <PondButton colorPalette="lilypad" loading={busy} onClick={() => void save()}>
                Save
              </PondButton>
            </HStack>
          </>
        )}

        {successMessage ? (
          <Text
            color={GOALS_THEME.pineGreen}
            fontSize="sm"
            fontWeight="medium"
            role="status"
          >
            {successMessage}
          </Text>
        ) : null}
        {error ? (
          <Text color="red.600" fontSize="sm" role="alert">
            {error}
          </Text>
        ) : null}
      </Stack>
    </AppModal>
  );
}
