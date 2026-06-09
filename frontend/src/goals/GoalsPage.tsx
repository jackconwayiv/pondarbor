import { Box, Heading, HStack, SimpleGrid, Stack, Tabs, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router";

import { GOALS_APP } from "../appNavConfig";
import PondButton from "../PondButton";
import { useAppSession } from "../auth/AppSessionContext";
import { PanelSessionReconnect, SessionLoadingCard } from "../components/panelStatus";
import { APP_PANEL_PAGE_MIN_HEIGHT_PROPS, fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { fetchGoal } from "./api";
import { goalHoldProgressDisabled } from "./goalCardLabels";
import { GoalsSettingsPanel } from "./GoalsSettingsPanel";
import { GoalCard } from "./GoalCard";
import { GoalFormModal } from "./GoalFormModal";
import { GoalMilestonePickerModal } from "./GoalMilestonePickerModal";
import { GoalsManagerModal } from "./GoalsManagerModal";
import { GoalsStoreProvider, useGoalsStore, type GoalsDerived } from "./goalsStore";
import {
  clampGoalsPageIndex,
  goalsGridPageCount,
  GOALS_GRID_PAGE_SIZE,
  paginateGoals,
} from "./goalGridSort";
import { mergeGoalIfNewer } from "./goalMerge";
import { GOAL_SHIMMER_ADVANCE_MS, goalGoldShimmerAnimate, goldIndexInSortedList } from "./goalShimmer";
import { sortGoalsForGrid } from "./goalGridSort";
import { GOALS_THEME } from "./theme";
import { GoalsProgressStripe } from "./GoalsProgressStripe";
import type { Goal } from "./types";

import "./goalsAddGoalButton.css";

type PageTab = "active" | "completed" | "projects" | "goals" | "paused" | "settings";

const GOALS_HELPER_TEXT =
  "Click a goal to edit it, or hold it to mark it completed.";
const CHORES_HELPER_TEXT =
  "Click a chore to edit it, or hold it to mark it completed.";
const PROJECTS_HELPER_TEXT =
  "Click a project to edit it, or hold it to mark progress.";

const GOALS_GRID_TOP_SLOT_TEXT_PROPS = {
  fontSize: APP_TEXT_SIZES.body,
  lineHeight: "tall",
} as const;

const GOALS_GRID_TOP_SLOT_PROPS = {
  ...GOALS_GRID_TOP_SLOT_TEXT_PROPS,
  h: "1.625em",
  mb: "2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  w: "full",
  flexShrink: 0,
} as const;

const paginationArrowButtonProps = {
  as: "button" as const,
  type: "button" as const,
  bg: "transparent",
  border: "none",
  p: "0",
  m: "0",
  fontSize: "inherit",
  lineHeight: "inherit",
  fontFamily: "inherit",
  fontWeight: "medium",
  cursor: "pointer",
};

function goalsForTab(tab: PageTab, derived: GoalsDerived): Goal[] {
  switch (tab) {
    case "active":
      return derived.activeTabGoals;
    case "completed":
      return derived.completedTabGoals;
    case "projects":
      return derived.projectsTabGoals;
    case "goals":
      return derived.goalsTabGoals;
    case "paused":
      return derived.pausedTabGoals;
    default:
      return [];
  }
}

function helperTextForTab(tab: PageTab, goals: Goal[]): string {
  if (tab === "projects") return PROJECTS_HELPER_TEXT;
  if (tab === "goals") return GOALS_HELPER_TEXT;
  if (tab === "active" && goals.some((g) => g.kind === "chore")) return CHORES_HELPER_TEXT;
  return GOALS_HELPER_TEXT;
}

function isCompactTab(tab: PageTab): boolean {
  return tab === "active" || tab === "projects" || tab === "goals";
}

function labelForActiveTab(goals: Goal[]): string {
  const kinds = new Set(goals.map((g) => g.kind));
  if (kinds.size !== 1) return "Active";
  const kind = [...kinds][0];
  if (kind === "chore") return "Chores";
  if (kind === "continuous") return "Goals";
  if (kind === "one_time") return "Projects";
  return "Active";
}

function GoalsPageContent() {
  const { sessionUser, getApiAccessToken, patchMyProfile } = useAppSession();
  const {
    workspace,
    loading,
    error,
    setError,
    derived,
    reloadWorkspace,
    updateGoalInWorkspace,
    runCheckIn,
    runMarkComplete,
    runDeleteAllGoals,
  } = useGoalsStore();

  const [pageTab, setPageTab] = useState<PageTab>("active");
  const [pageIndexByTab, setPageIndexByTab] = useState<Partial<Record<PageTab, number>>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [milestoneGoal, setMilestoneGoal] = useState<Goal | null>(null);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [goalsManagerOpen, setGoalsManagerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [shimmerCursor, setShimmerCursor] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const editDetailSeq = useRef(0);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showNotice = useCallback((message: string) => {
    setError(null);
    setNotice(message);
  }, [setError]);

  useEffect(() => {
    void getApiAccessToken().then(setToken);
  }, [getApiAccessToken]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setShimmerCursor((c) => c + 1);
    }, GOAL_SHIMMER_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const statusCounts = workspace?.status_counts ?? { active: 0, completed: 0, paused: 0 };
  const totalGoals = useMemo(
    () => statusCounts.active + statusCounts.completed + statusCounts.paused,
    [statusCounts],
  );

  const pageTabs = useMemo(() => {
    if (!derived || totalGoals === 0) return [] as { id: PageTab; label: string }[];
    const tabs: { id: PageTab; label: string }[] = [
      { id: "active", label: labelForActiveTab(derived.activeTabGoals) },
    ];
    if (derived.showProjectsTab) tabs.push({ id: "projects", label: "Projects" });
    if (derived.showGoalsTab) tabs.push({ id: "goals", label: "Goals" });
    if (statusCounts.paused > 0) tabs.push({ id: "paused", label: "Paused" });
    if (derived.showCompletedTab) tabs.push({ id: "completed", label: "Done" });
    tabs.push({ id: "settings", label: "Settings" });
    return tabs;
  }, [derived, statusCounts.paused, totalGoals]);

  useEffect(() => {
    if (loading) return;
    if (pageTab === "settings" && totalGoals === 0) {
      setPageTab("active");
      return;
    }
    if (pageTabs.length > 0 && !pageTabs.some((t) => t.id === pageTab)) {
      setPageTab(pageTabs[0]!.id);
    }
  }, [loading, pageTab, pageTabs, totalGoals]);

  useEffect(() => {
    setPageIndexByTab((prev) => ({ ...prev, [pageTab]: 0 }));
  }, [pageTab]);

  const tabGoals = useMemo(() => {
    if (!derived || pageTab === "settings") return [];
    return goalsForTab(pageTab, derived);
  }, [derived, pageTab]);

  const pageCount = goalsGridPageCount(tabGoals.length);
  const pageIndex = pageIndexByTab[pageTab] ?? 0;
  const clampedPageIndex = clampGoalsPageIndex(pageIndex, tabGoals.length);

  useEffect(() => {
    if (clampedPageIndex !== pageIndex) {
      setPageIndexByTab((prev) => ({ ...prev, [pageTab]: clampedPageIndex }));
    }
  }, [clampedPageIndex, pageIndex, pageTab]);

  const pageGoals = useMemo(
    () => paginateGoals(tabGoals, clampedPageIndex),
    [tabGoals, clampedPageIndex],
  );

  const showPagination = tabGoals.length > GOALS_GRID_PAGE_SIZE;
  const kindHelperText = helperTextForTab(pageTab, tabGoals);
  const showKindHelper =
    !loading && pageTab !== "settings" && tabGoals.length > 0 && !showPagination && !notice;

  const addButtonBlue = totalGoals >= 3;
  const stripe = workspace?.stripe ?? {
    today_actual: 0,
    today_target: 0,
    week_actual: 0,
    week_target: 0,
    month_actual: 0,
    month_target: 0,
  };

  const openAdd = () => {
    setFormMode("add");
    setEditGoal(null);
    setFormOpen(true);
  };

  const openEdit = useCallback(
    (goal: Goal) => {
      setFormMode("edit");
      const fresh = workspace?.goals.find((g) => g.id === goal.id) ?? goal;
      setEditGoal(fresh);
      setFormOpen(true);
      const seq = ++editDetailSeq.current;
      void (async () => {
        try {
          const t = await getApiAccessToken();
          const latest = await fetchGoal(goal.id, t);
          if (seq !== editDetailSeq.current) return;
          updateGoalInWorkspace(latest);
          setEditGoal((current) => (current ? mergeGoalIfNewer(current, latest) : latest));
        } catch {
          // Keep list snapshot if detail fetch fails.
        }
      })();
    },
    [getApiAccessToken, updateGoalInWorkspace, workspace?.goals],
  );

  const handleGoalUpdated = useCallback(
    (updated: Goal) => {
      updateGoalInWorkspace(updated);
      if (updated.status === "completed") {
        setPageTab("completed");
      } else if (updated.status === "paused") {
        setPageTab("paused");
      }
    },
    [updateGoalInWorkspace],
  );

  const handleCheckInResult = useCallback(
    async (goalId: string, checkpointId?: string): Promise<Goal> => {
      showNotice(checkpointId ? "Checkpoint logged." : "Checked in for today.");
      const sorted = sortGoalsForGrid(workspace?.goals ?? []);
      const goldIndex = goldIndexInSortedList(goalId, sorted);
      if (goldIndex >= 0) setShimmerCursor(goldIndex);
      try {
        return await runCheckIn(goalId, checkpointId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Check-in failed.");
        throw e;
      }
    },
    [runCheckIn, setError, showNotice, workspace?.goals],
  );

  const handleMarkComplete = useCallback(
    async (goalId: string) => {
      showNotice("Goal marked complete.");
      setPageTab("completed");
      setPageIndexByTab((prev) => ({ ...prev, completed: 0 }));
      try {
        await runMarkComplete(goalId);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to mark goal complete.");
        throw e;
      }
    },
    [runMarkComplete, setError, showNotice],
  );

  const onHoldComplete = (goal: Goal) => {
    if (goal.kind === "continuous" || goal.kind === "chore") {
      void handleCheckInResult(goal.id).catch(() => undefined);
      return;
    }
    if (goal.checkpoints.length === 0) {
      void handleMarkComplete(goal.id).catch(() => undefined);
      return;
    }
    setMilestoneGoal(goal);
    setMilestoneOpen(true);
  };

  const handleDeleteAllGoals = useCallback(async () => {
    await runDeleteAllGoals();
    setFormOpen(false);
    setEditGoal(null);
    setMilestoneOpen(false);
    setGoalsManagerOpen(false);
    setPageTab("active");
    showNotice("All goals deleted.");
  }, [runDeleteAllGoals, showNotice]);

  const handleWeekStartsOnChange = useCallback(
    (value: number) => {
      void patchMyProfile({ meal_week_starts_on: value })
        .then(() => reloadWorkspace())
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to update week start.");
        });
    },
    [patchMyProfile, reloadWorkspace, setError],
  );

  const goalsPanelTopSlot = (() => {
    if (notice) {
      return (
        <Text
          role="status"
          {...GOALS_GRID_TOP_SLOT_TEXT_PROPS}
          color={GOALS_THEME.pineGreen}
          fontWeight="medium"
          textAlign="center"
          width="full"
          lineClamp={1}
        >
          {notice}
        </Text>
      );
    }
    if (showPagination) {
      return (
        <HStack gap="8" width="full" justify="center" fontWeight="medium">
          <Box
            {...paginationArrowButtonProps}
            aria-label="Previous page"
            aria-disabled={clampedPageIndex <= 0}
            color={clampedPageIndex <= 0 ? "fg.muted" : "fg"}
            pointerEvents={clampedPageIndex <= 0 ? "none" : "auto"}
            opacity={clampedPageIndex <= 0 ? 0.45 : 1}
            onClick={() =>
              setPageIndexByTab((prev) => ({
                ...prev,
                [pageTab]: Math.max(0, clampedPageIndex - 1),
              }))
            }
          >
            ←
          </Box>
          <Box
            {...paginationArrowButtonProps}
            aria-label="Next page"
            aria-disabled={clampedPageIndex >= pageCount - 1}
            color={clampedPageIndex >= pageCount - 1 ? "fg.muted" : "fg"}
            pointerEvents={clampedPageIndex >= pageCount - 1 ? "none" : "auto"}
            opacity={clampedPageIndex >= pageCount - 1 ? 0.45 : 1}
            onClick={() =>
              setPageIndexByTab((prev) => ({
                ...prev,
                [pageTab]: Math.min(pageCount - 1, clampedPageIndex + 1),
              }))
            }
          >
            →
          </Box>
        </HStack>
      );
    }
    if (showKindHelper) {
      return (
        <Text
          {...GOALS_GRID_TOP_SLOT_TEXT_PROPS}
          color="fg"
          fontWeight="medium"
          textAlign="center"
          width="full"
          lineClamp={1}
          title={kindHelperText}
        >
          {kindHelperText}
        </Text>
      );
    }
    return (
      <Text
        {...GOALS_GRID_TOP_SLOT_TEXT_PROPS}
        fontWeight="medium"
        visibility="hidden"
        aria-hidden
        lineClamp={1}
      >
        {GOALS_HELPER_TEXT}
      </Text>
    );
  })();

  const goalsPanel = (
    <>
      <Box {...GOALS_GRID_TOP_SLOT_PROPS}>{goalsPanelTopSlot}</Box>
      {error ? (
        <Text role="alert" color="nautical.solid" fontWeight="medium">
          {error}
        </Text>
      ) : null}
      <Stack gap={MAPPED_LIST_STACK_GAP} pt="0" w="100%" flex="1" minH="0">
        {loading && !workspace ? (
          <Text color="fg.muted" fontSize={APP_TEXT_SIZES.body}>
            Loading your badges…
          </Text>
        ) : null}
        {tabGoals.length > 0 ? (
          <SimpleGrid columns={{ base: 3, md: 3 }} gap={{ base: 2, md: 3 }} width="full">
            {pageGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                compact={isCompactTab(pageTab)}
                holdDisabled={goalHoldProgressDisabled(goal)}
                goldShimmerAnimate={goalGoldShimmerAnimate(goal, tabGoals, shimmerCursor)}
                onTap={() => openEdit(goal)}
                onHoldComplete={() => onHoldComplete(goal)}
              />
            ))}
          </SimpleGrid>
        ) : !loading ? (
          <Text color="fg.muted" fontSize={APP_TEXT_SIZES.body}>
            Nothing here right now.
          </Text>
        ) : null}
      </Stack>
    </>
  );

  return (
    <>
      <Stack flex="1" gap="0" {...APP_PANEL_PAGE_MIN_HEIGHT_PROPS} {...fullBleedStackProps}>
        <Box
          flex="1"
          minH="full"
          display="flex"
          flexDirection="column"
          bg="bg"
          px={0}
          py={{ base: "2", md: "2" }}
        >
          <Box
            {...APP_SHELL_TRAY_PROPS}
            flex="1"
            minH="0"
            display="flex"
            flexDirection="column"
          >
            <Stack
              gap={{ base: "4", md: "4" }}
              px={{ base: "2", md: "2" }}
              pt={{ base: "2", md: "2" }}
              pb="2"
            >
              <Box {...PANEL_ENTRY_CARD_PROPS}>
                <HStack
                  justify="space-between"
                  align="start"
                  gap="3"
                  flexWrap="wrap"
                  mb={totalGoals > 0 ? "0" : "2"}
                >
                  <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="0">
                    <HStack
                      as="span"
                      display="inline-flex"
                      gap="2"
                      alignItems="center"
                      flexWrap="wrap"
                    >
                      <Text as="span" aria-hidden="true">
                        {GOALS_APP.emoji}
                      </Text>
                      <Text as="span">Goal-Getter</Text>
                      {loading && !workspace ? (
                        <Text
                          as="span"
                          fontSize={APP_TEXT_SIZES.helper}
                          color="fg.muted"
                          fontWeight="medium"
                          aria-live="polite"
                        >
                          Loading…
                        </Text>
                      ) : null}
                    </HStack>
                  </Heading>
                  <PondButton
                    type="button"
                    className={
                      addButtonBlue
                        ? "goals-add-goal-btn goals-add-goal-btn--blue"
                        : "goals-add-goal-btn"
                    }
                    flexShrink={0}
                    onClick={openAdd}
                    _hover={
                      addButtonBlue
                        ? {
                            bg: GOALS_THEME.patchCompletableBg,
                            borderColor: GOALS_THEME.patchCompletableBorder,
                            borderWidth: "1px",
                            color: GOALS_THEME.textOnLight,
                          }
                        : {
                            bg: "transparent",
                            borderColor: "#c9a227",
                            borderWidth: "1px",
                            color: "#1b3a2f",
                          }
                    }
                  >
                    + Add goal
                  </PondButton>
                </HStack>
                <Box mt="2">
                  <GoalsProgressStripe stripe={stripe} />
                </Box>
              </Box>
            </Stack>

            {pageTabs.length > 0 ? (
              <Tabs.Root
                value={pageTab}
                onValueChange={(d) => setPageTab((d.value ?? "active") as PageTab)}
                variant="plain"
                display="flex"
                flexDirection="column"
                flex="1"
                minH="0"
                w="100%"
              >
                <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
                  {pageTabs.map((tab) => (
                    <Tabs.Trigger
                      key={tab.id}
                      value={tab.id}
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      {tab.label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                {pageTabs
                  .filter((t) => t.id !== "settings")
                  .map((tab) => (
                    <Tabs.Content
                      key={tab.id}
                      value={tab.id}
                      p={{ base: "2", md: "2" }}
                      flex="1"
                      minH="0"
                    >
                      {goalsPanel}
                    </Tabs.Content>
                  ))}
                {totalGoals > 0 ? (
                  <Tabs.Content
                    value="settings"
                    p={{ base: "2", md: "2" }}
                    flex="1"
                    minH="0"
                  >
                    <GoalsSettingsPanel
                      weekStartsOn={sessionUser?.profile.meal_week_starts_on ?? 0}
                      onWeekStartsOnChange={handleWeekStartsOnChange}
                      onDeleteAllGoals={handleDeleteAllGoals}
                      onOpenGoalsManager={() => setGoalsManagerOpen(true)}
                      totalGoals={totalGoals}
                    />
                  </Tabs.Content>
                ) : null}
              </Tabs.Root>
            ) : (
              <Stack flex="1" px={{ base: "2", md: "2" }} pb="2" minH="0">
                {goalsPanel}
              </Stack>
            )}
          </Box>
        </Box>
      </Stack>

      <GoalsManagerModal
        open={goalsManagerOpen}
        onOpenChange={setGoalsManagerOpen}
        onEditGoal={openEdit}
      />

      <GoalFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editGoal}
        mode={formMode}
        accessToken={token}
        onSaved={() => void reloadWorkspace()}
        onRefresh={() => void reloadWorkspace()}
        onGoalUpdated={handleGoalUpdated}
        onOpenMilestonePicker={(goal) => {
          setMilestoneGoal(goal);
          setMilestoneOpen(true);
        }}
      />

      <GoalMilestonePickerModal
        open={milestoneOpen}
        onOpenChange={setMilestoneOpen}
        goal={milestoneGoal}
        onPickCheckpoint={(cpId) => {
          void (async () => {
            try {
              await handleCheckInResult(milestoneGoal!.id, cpId);
              setMilestoneOpen(false);
            } catch {
              // error shown via store
            }
          })();
        }}
        onCompleteGoal={() => {
          void (async () => {
            try {
              await handleMarkComplete(milestoneGoal!.id);
              setMilestoneOpen(false);
            } catch {
              // error shown via store
            }
          })();
        }}
        onOpenEdit={() => {
          setMilestoneOpen(false);
          if (milestoneGoal) openEdit(milestoneGoal);
        }}
      />
    </>
  );
}

export default function GoalsPage() {
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession, error: sessionError } =
    useAppSession();

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (isLoading && !sessionUser) {
    return <SessionLoadingCard />;
  }

  if (sessionError && !sessionUser) {
    return (
      <PanelSessionReconnect
        sessionError={sessionError}
        onRetry={() => void refreshSession()}
      />
    );
  }

  if (!sessionUser?.user.is_approved) {
    return <Navigate to="/" replace />;
  }

  return (
    <GoalsStoreProvider
      getAccessToken={getApiAccessToken}
      enabled={sessionUser.user.is_approved}
    >
      <GoalsPageContent />
    </GoalsStoreProvider>
  );
}
