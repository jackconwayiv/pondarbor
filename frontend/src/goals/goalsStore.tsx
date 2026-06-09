import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  checkInGoal,
  createGoal,
  deleteAllGoals,
  deleteGoal,
  fetchGoalsWorkspace,
  patchGoal,
} from "./api";
import {
  buildCompletedTabGoals,
  dueTodayActiveGoals,
  partitionDueTodayGoals,
  sortManagerGoals,
} from "./goalTabPartition";
import { GOALS_GRID_PAGE_SIZE, sortGoalsForGrid } from "./goalGridSort";
import { mergeGoalIfNewer } from "./goalMerge";
import {
  optimisticCheckIn,
  optimisticMarkComplete,
  optimisticStripeAfterCheckIn,
} from "./optimisticGoalUpdate";
import type {
  Goal,
  GoalCreatePayload,
  GoalKind,
  GoalPatchPayload,
  GoalsWorkspace,
} from "./types";

type GoalsStoreContextValue = {
  workspace: GoalsWorkspace | null;
  loading: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  reloadWorkspace: () => Promise<GoalsWorkspace>;
  derived: GoalsDerived | null;
  goalsByKind: (kind: GoalKind) => Goal[];
  updateGoalInWorkspace: (goal: Goal) => void;
  runCheckIn: (goalId: string, checkpointId?: string) => Promise<Goal>;
  runMarkComplete: (goalId: string) => Promise<void>;
  runPatchGoal: (goalId: string, payload: GoalPatchPayload) => Promise<Goal>;
  runCreateGoal: (payload: GoalCreatePayload) => Promise<Goal>;
  runDeleteGoal: (goalId: string) => Promise<void>;
  runDeleteAllGoals: () => Promise<void>;
};

export type GoalsDerived = {
  partition: ReturnType<typeof partitionDueTodayGoals>;
  activeTabGoals: Goal[];
  completedTabGoals: Goal[];
  projectsTabGoals: Goal[];
  goalsTabGoals: Goal[];
  pausedTabGoals: Goal[];
  dueTodayCount: number;
  showCompletedTab: boolean;
  showProjectsTab: boolean;
  showGoalsTab: boolean;
};

const GoalsStoreContext = createContext<GoalsStoreContextValue | null>(null);

function cloneWorkspace(ws: GoalsWorkspace): GoalsWorkspace {
  return structuredClone(ws);
}

function deriveWorkspace(ws: GoalsWorkspace): GoalsDerived {
  const partition = partitionDueTodayGoals(ws.goals, GOALS_GRID_PAGE_SIZE);
  const completedTabGoals = buildCompletedTabGoals(
    ws.goals,
    partition.tabs.completed_overflow,
  );
  const dueTodayCount = dueTodayActiveGoals(ws.goals).length;
  return {
    partition,
    activeTabGoals: sortGoalsForGrid(partition.tabs.active),
    completedTabGoals,
    projectsTabGoals: sortGoalsForGrid(partition.tabs.projects),
    goalsTabGoals: sortGoalsForGrid(partition.tabs.goals),
    pausedTabGoals: sortGoalsForGrid(ws.goals.filter((g) => g.status === "paused")),
    dueTodayCount,
    showCompletedTab:
      ws.status_counts.completed > 0 || partition.tabs.completed_overflow.length > 0,
    showProjectsTab: partition.split.projects && partition.tabs.projects.length > 0,
    showGoalsTab: partition.split.goals && partition.tabs.goals.length > 0,
  };
}

type GoalsStoreProviderProps = {
  children: ReactNode;
  getAccessToken: () => Promise<string | null>;
  enabled: boolean;
};

export function GoalsStoreProvider({
  children,
  getAccessToken,
  enabled,
}: GoalsStoreProviderProps) {
  const [workspace, setWorkspace] = useState<GoalsWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadWorkspace = useCallback(async () => {
    const token = await getAccessToken();
    const ws = await fetchGoalsWorkspace(token);
    setWorkspace(ws);
    return ws;
  }, [getAccessToken]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void reloadWorkspace()
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Failed to load goals.");
      })
      .finally(() => setLoading(false));
  }, [enabled, reloadWorkspace]);

  const derived = useMemo(
    () => (workspace ? deriveWorkspace(workspace) : null),
    [workspace],
  );

  const goalsByKind = useCallback(
    (kind: GoalKind) => {
      if (!workspace) return [];
      return sortManagerGoals(workspace.goals.filter((g) => g.kind === kind));
    },
    [workspace],
  );

  const updateGoalInWorkspace = useCallback((goal: Goal) => {
    setWorkspace((ws) => {
      if (!ws) return ws;
      const idx = ws.goals.findIndex((g) => g.id === goal.id);
      if (idx < 0) return { ...ws, goals: [...ws.goals, goal] };
      const goals = [...ws.goals];
      goals[idx] = mergeGoalIfNewer(goals[idx]!, goal);
      return { ...ws, goals };
    });
  }, []);

  const runMutation = useCallback(
    async (
      applyOptimistic: (ws: GoalsWorkspace) => GoalsWorkspace,
      api: () => Promise<void>,
    ) => {
      if (!workspace) throw new Error("Goals not loaded.");
      const snapshot = cloneWorkspace(workspace);
      setWorkspace(applyOptimistic(workspace));
      try {
        await api();
        await reloadWorkspace();
      } catch (e) {
        setWorkspace(snapshot);
        throw e;
      }
    },
    [reloadWorkspace, workspace],
  );

  const runCheckIn = useCallback(
    async (goalId: string, checkpointId?: string) => {
      if (!workspace) throw new Error("Goals not loaded.");
      const prior = workspace.goals.find((g) => g.id === goalId);
      if (!prior) throw new Error("Goal not found.");
      const snapshot = cloneWorkspace(workspace);
      const optimistic = optimisticCheckIn(prior, checkpointId);
      setWorkspace({
        ...workspace,
        goals: workspace.goals.map((g) => (g.id === goalId ? optimistic : g)),
        stripe: optimisticStripeAfterCheckIn(workspace.stripe, prior),
      });
      try {
        const token = await getAccessToken();
        await checkInGoal(goalId, token, checkpointId);
        await reloadWorkspace();
        return optimistic;
      } catch (e) {
        setWorkspace(snapshot);
        throw e;
      }
    },
    [getAccessToken, reloadWorkspace, workspace],
  );

  const runMarkComplete = useCallback(
    async (goalId: string) => {
      if (!workspace) throw new Error("Goals not loaded.");
      const prior = workspace.goals.find((g) => g.id === goalId);
      if (!prior) throw new Error("Goal not found.");
      await runMutation(
        (ws) => ({
          ...ws,
          goals: ws.goals.map((g) =>
            g.id === goalId ? optimisticMarkComplete(g) : g,
          ),
        }),
        async () => {
          const token = await getAccessToken();
          await patchGoal(goalId, { status: "completed" }, token);
        },
      );
    },
    [getAccessToken, runMutation, workspace],
  );

  const runPatchGoal = useCallback(
    async (goalId: string, payload: GoalPatchPayload) => {
      let updated: Goal | null = null;
      await runMutation(
        (ws) => ({
          ...ws,
          goals: ws.goals.map((g) =>
            g.id === goalId ? { ...g, ...payload, updated_at: new Date().toISOString() } : g,
          ),
        }),
        async () => {
          const token = await getAccessToken();
          updated = await patchGoal(goalId, payload, token);
        },
      );
      if (!updated) throw new Error("Update failed.");
      return updated;
    },
    [getAccessToken, runMutation],
  );

  const runCreateGoal = useCallback(
    async (payload: GoalCreatePayload) => {
      let created: Goal | null = null;
      await runMutation(
        (ws) => ws,
        async () => {
          const token = await getAccessToken();
          created = await createGoal(payload, token);
        },
      );
      if (!created) throw new Error("Create failed.");
      return created;
    },
    [getAccessToken, runMutation],
  );

  const runDeleteGoal = useCallback(
    async (goalId: string) => {
      await runMutation(
        (ws) => ({ ...ws, goals: ws.goals.filter((g) => g.id !== goalId) }),
        async () => {
          const token = await getAccessToken();
          await deleteGoal(goalId, token);
        },
      );
    },
    [getAccessToken, runMutation],
  );

  const runDeleteAllGoals = useCallback(async () => {
    await runMutation(
      (ws) => ({
        ...ws,
        goals: [],
        status_counts: { active: 0, completed: 0, paused: 0 },
        kind_counts: { continuous: 0, chore: 0, one_time: 0 },
        kind_totals: { continuous: 0, chore: 0, one_time: 0 },
      }),
      async () => {
        const token = await getAccessToken();
        await deleteAllGoals(token);
      },
    );
  }, [getAccessToken, runMutation]);

  const value: GoalsStoreContextValue = {
    workspace,
    loading,
    error,
    setError,
    reloadWorkspace,
    derived,
    goalsByKind,
    updateGoalInWorkspace,
    runCheckIn,
    runMarkComplete,
    runPatchGoal,
    runCreateGoal,
    runDeleteGoal,
    runDeleteAllGoals,
  };

  return (
    <GoalsStoreContext.Provider value={value}>{children}</GoalsStoreContext.Provider>
  );
}

export function useGoalsStore(): GoalsStoreContextValue {
  const ctx = useContext(GoalsStoreContext);
  if (!ctx) throw new Error("useGoalsStore must be used within GoalsStoreProvider");
  return ctx;
}
