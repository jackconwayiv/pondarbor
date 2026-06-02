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
import {
  checkInGoal,
  deleteAllGoals,
  fetchGoal,
  fetchGoalsDashboard,
  patchGoal,
} from "./api";
import { GoalsSettingsPanel } from "./GoalsSettingsPanel";
import { GoalCard } from "./GoalCard";
import { GoalFormModal } from "./GoalFormModal";
import { GoalMilestonePickerModal } from "./GoalMilestonePickerModal";
import { mergeGoalIfNewer } from "./goalMerge";
import { GOALS_THEME } from "./theme";
import { GoalsProgressStripe } from "./GoalsProgressStripe";
import type { Goal, GoalStatus, GoalsDashboard } from "./types";

import "./goalsAddGoalButton.css";

const STATUS_TABS: { value: GoalStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "completed", label: "Finished" },
  { value: "paused", label: "Paused" },
];

type PageTab = GoalStatus | "settings";

const SETTINGS_TAB: { value: "settings"; label: string } = {
  value: "settings",
  label: "Settings",
};

export default function GoalsPage() {
  const {
    isAuthenticated,
    isLoading,
    sessionUser,
    getApiAccessToken,
    patchMyProfile,
    refreshSession,
    error: sessionError,
  } = useAppSession();

  const [pageTab, setPageTab] = useState<PageTab>("active");
  const [dashboard, setDashboard] = useState<GoalsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [milestoneGoal, setMilestoneGoal] = useState<Goal | null>(null);
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const editDetailSeq = useRef(0);
  const load = useCallback(
    async (options?: { quiet?: boolean; status?: GoalStatus }) => {
      if (!sessionUser?.user.is_approved) return;
      if (!options?.quiet) setLoading(true);
      setError(null);
      try {
        const t = await getApiAccessToken();
        setToken(t);
        const listStatus =
          options?.status ?? (pageTab === "settings" ? "active" : pageTab);
        const data = await fetchGoalsDashboard(t, listStatus);
        setDashboard(data);
        setEditGoal((current) => {
          if (!current) return current;
          const fromList = data.goals.find((g) => g.id === current.id);
          if (!fromList) return current;
          return mergeGoalIfNewer(current, fromList);
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load goals.");
      } finally {
        if (!options?.quiet) setLoading(false);
      }
    },
    [getApiAccessToken, pageTab, sessionUser?.user.is_approved],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const showNotice = useCallback((message: string) => {
    setError(null);
    setNotice(message);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user.is_approved) {
      setLoading(false);
      return;
    }
    void load();
  }, [isAuthenticated, load, sessionUser?.user.is_approved]);

  const statusCounts = useMemo(
    () =>
      dashboard?.status_counts ?? {
        active: 0,
        completed: 0,
        paused: 0,
      },
    [dashboard],
  );

  const totalGoals = useMemo(
    () => statusCounts.active + statusCounts.completed + statusCounts.paused,
    [statusCounts],
  );

  const pageTabs = useMemo(() => {
    const status = STATUS_TABS.filter((tab) => statusCounts[tab.value] > 0);
    if (totalGoals === 0) return status;
    return [...status, SETTINGS_TAB];
  }, [statusCounts, totalGoals]);

  const listStatus: GoalStatus = pageTab === "settings" ? "active" : pageTab;

  useEffect(() => {
    if (loading) return;
    if (pageTab === "settings" && totalGoals === 0) {
      setPageTab("active");
      return;
    }
    const hasTab = pageTabs.some((tab) => tab.value === pageTab);
    if (!hasTab && pageTabs.length > 0) {
      setPageTab(pageTabs[0]!.value);
      return;
    }
    if (pageTab === "settings") return;
    if (statusCounts[pageTab] === 0) {
      const fallback = STATUS_TABS.find((tab) => statusCounts[tab.value] > 0);
      if (fallback) setPageTab(fallback.value);
    }
  }, [loading, pageTab, pageTabs, statusCounts, totalGoals]);

  const handleDeleteAllGoals = useCallback(async () => {
    const t = await getApiAccessToken();
    await deleteAllGoals(t);
    setFormOpen(false);
    setEditGoal(null);
    setMilestoneOpen(false);
    setPageTab("active");
    showNotice("All goals deleted.");
    await load({ quiet: true });
  }, [getApiAccessToken, load, showNotice]);

  const handleWeekStartsOnChange = useCallback(
    (value: number) => {
      void patchMyProfile({ meal_week_starts_on: value })
        .then(() => load({ quiet: true }))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Failed to update week start.");
        });
    },
    [load, patchMyProfile],
  );

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

  const openAdd = () => {
    setFormMode("add");
    setEditGoal(null);
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setFormMode("edit");
    const fresh = dashboard?.goals.find((g) => g.id === goal.id) ?? goal;
    setEditGoal(fresh);
    setFormOpen(true);
    const seq = ++editDetailSeq.current;
    void (async () => {
      try {
        const t = await getApiAccessToken();
        const latest = await fetchGoal(goal.id, t);
        if (seq !== editDetailSeq.current) return;
        mergeGoalIntoDashboard(latest);
        setEditGoal((current) => mergeGoalIfNewer(current, latest));
      } catch {
        // Keep dashboard snapshot if detail fetch fails.
      }
    })();
  };

  const mergeGoalIntoDashboard = useCallback((updated: Goal) => {
    setDashboard((d) => {
      if (!d) return d;
      const prior = d.goals.find((g) => g.id === updated.id);
      const hasGoal = prior != null;
      const onCurrentTab = updated.status === d.status;
      let goals: Goal[];
      if (hasGoal) {
        goals = onCurrentTab
          ? d.goals.map((g) => (g.id === updated.id ? updated : g))
          : d.goals.filter((g) => g.id !== updated.id);
      } else if (onCurrentTab) {
        goals = [...d.goals, updated];
      } else {
        goals = d.goals;
      }
      let status_counts = d.status_counts;
      if (prior && prior.status !== updated.status) {
        status_counts = { ...d.status_counts };
        status_counts[prior.status] = Math.max(0, status_counts[prior.status] - 1);
        status_counts[updated.status] = status_counts[updated.status] + 1;
      }
      return { ...d, goals, status_counts };
    });
    setEditGoal((current) =>
      current?.id === updated.id ? mergeGoalIfNewer(current, updated) : current,
    );
  }, []);

  const handleGoalUpdated = useCallback(
    (updated: Goal) => {
      mergeGoalIntoDashboard(updated);
      if (updated.status === "completed") {
        setPageTab("completed");
      } else if (updated.status === "paused") {
        setPageTab("paused");
      } else if (updated.status === "active") {
        setPageTab("active");
      }
      void load({ quiet: true, status: updated.status });
    },
    [load, mergeGoalIntoDashboard],
  );

  const openMilestonePicker = useCallback((goal: Goal) => {
    setMilestoneGoal(goal);
    setMilestoneOpen(true);
  }, []);

  const handleCheckInResult = useCallback(
    async (goalId: string, checkpointId?: string): Promise<Goal> => {
      const t = await getApiAccessToken();
      const updated = await checkInGoal(goalId, t, checkpointId);
      mergeGoalIntoDashboard(updated);
      showNotice(checkpointId ? "Checkpoint logged." : "Checked in for today.");
      await load({ quiet: true });
      return updated;
    },
    [getApiAccessToken, load, mergeGoalIntoDashboard, showNotice],
  );

  const handleMarkComplete = useCallback(
    async (goalId: string) => {
      const t = await getApiAccessToken();
      const updated = await patchGoal(goalId, { status: "completed" }, t);
      handleGoalUpdated(updated);
      showNotice("Goal marked complete.");
      await load({ quiet: true });
    },
    [getApiAccessToken, handleGoalUpdated, load, showNotice],
  );

  const onHoldComplete = (goal: Goal) => {
    if (goal.kind === "continuous") {
      void handleCheckInResult(goal.id).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Check-in failed.");
      });
      return;
    }
    if (goal.checkpoints.length === 0) {
      void handleMarkComplete(goal.id).catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to mark goal complete.");
      });
      return;
    }
    setMilestoneGoal(goal);
    setMilestoneOpen(true);
  };

  const goals = dashboard?.goals ?? [];
  const stripe = dashboard?.stripe ?? {
    today_actual: 0,
    today_target: 0,
    week_actual: 0,
    week_target: 0,
    month_actual: 0,
    month_target: 0,
  };

  const showActiveHelper =
    !loading && pageTab === "active" && statusCounts.active > 0;

  const goalsPanel = (
    <>
      {showActiveHelper ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg" lineHeight="tall" py="2">
          Click a goal to edit it, or hold it to mark it completed.
        </Text>
      ) : null}
      {notice ? (
        <Text role="status" color={GOALS_THEME.pineGreen} fontWeight="medium">
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text role="alert" color="nautical.solid" fontWeight="medium">
          {error}
        </Text>
      ) : null}
      <Stack gap={MAPPED_LIST_STACK_GAP} pt="0" w="100%" flex="1" minH="0">
        {loading && goals.length === 0 ? (
          <Text color="fg.muted" fontSize={APP_TEXT_SIZES.body}>
            Loading your badges…
          </Text>
        ) : null}
        {goals.length > 0 ? (
          <SimpleGrid columns={{ base: 3, md: 3 }} gap={{ base: 2, md: 3 }} width="full">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                compact={listStatus === "active"}
                onTap={() => openEdit(goal)}
                onHoldComplete={() => onHoldComplete(goal)}
              />
            ))}
          </SimpleGrid>
        ) : null}
      </Stack>
    </>
  );

  return (
    <>
      <Stack
        flex="1"
        gap="0"
        {...APP_PANEL_PAGE_MIN_HEIGHT_PROPS}
        {...fullBleedStackProps}
      >
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
                      {loading && !dashboard ? (
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
                    className="goals-add-goal-btn"
                    flexShrink={0}
                    onClick={openAdd}
                    _hover={{
                      bg: "transparent",
                      borderColor: "#c9a227",
                      borderWidth: "1px",
                      color: "#1b3a2f",
                    }}
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
                      key={tab.value}
                      value={tab.value}
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      {tab.label}
                    </Tabs.Trigger>
                  ))}
                </Tabs.List>
                {STATUS_TABS.filter((tab) => statusCounts[tab.value] > 0).map((tab) => (
                  <Tabs.Content
                    key={tab.value}
                    value={tab.value}
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

      <GoalFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        goal={editGoal}
        mode={formMode}
        accessToken={token}
        onSaved={() => void load()}
        onRefresh={() => void load({ quiet: true })}
        onGoalUpdated={handleGoalUpdated}
        onOpenMilestonePicker={openMilestonePicker}
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
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed to log checkpoint.");
            }
          })();
        }}
        onCompleteGoal={() => {
          void (async () => {
            try {
              await handleMarkComplete(milestoneGoal!.id);
              setMilestoneOpen(false);
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed to mark goal complete.");
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
