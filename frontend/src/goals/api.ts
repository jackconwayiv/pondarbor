import type {
  Checkpoint,
  Goal,
  GoalCreatePayload,
  GoalKind,
  GoalPatchPayload,
  GoalsDashboard,
  GoalStatus,
} from "./types";

function apiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function authHeaders(accessToken: string | null): Record<string, string> {
  if (!accessToken) {
    throw new Error("Missing API access token. Refresh your session and try again.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
}

function drfErrorToMessage(bodyText: string): string | null {
  try {
    const data = JSON.parse(bodyText) as Record<string, unknown>;
    const pick = (v: unknown): string | null => {
      if (typeof v === "string") return v;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string") return v[0];
      return null;
    };
    return pick(data.detail) ?? pick(data.non_field_errors) ?? pick(data.title);
  } catch {
    return null;
  }
}

export async function deleteAllGoals(accessToken: string | null): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/goals/reset/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ confirm: "delete_all" }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to delete goals (${response.status})`);
  }
}

export type FetchGoalsDashboardOptions = {
  status?: GoalStatus;
  kind?: GoalKind;
  choresDueOnly?: boolean;
};

export async function fetchGoalsDashboard(
  accessToken: string | null,
  options: FetchGoalsDashboardOptions = {},
): Promise<GoalsDashboard> {
  const status = options.status ?? "active";
  const q = new URLSearchParams({ status });
  if (options.kind) q.set("kind", options.kind);
  if (options.kind === "chore" && options.choresDueOnly === false) {
    q.set("chores_due_only", "false");
  }
  const response = await fetch(`${apiBase()}/api/v1/goals/dashboard/?${q}`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Failed to load goals (${response.status})`);
  }
  return (await response.json()) as GoalsDashboard;
}

export async function createGoal(
  payload: GoalCreatePayload,
  accessToken: string | null,
): Promise<Goal> {
  const response = await fetch(`${apiBase()}/api/v1/goals/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to create goal (${response.status})`);
  }
  return (await response.json()) as Goal;
}

export async function fetchGoal(goalId: string, accessToken: string | null): Promise<Goal> {
  const response = await fetch(`${apiBase()}/api/v1/goals/${goalId}/`, {
    method: "GET",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) {
    throw new Error(`Failed to load goal (${response.status})`);
  }
  return (await response.json()) as Goal;
}

export async function patchGoal(
  goalId: string,
  payload: GoalPatchPayload,
  accessToken: string | null,
): Promise<Goal> {
  const response = await fetch(`${apiBase()}/api/v1/goals/${goalId}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to update goal (${response.status})`);
  }
  return (await response.json()) as Goal;
}

export async function deleteGoal(goalId: string, accessToken: string | null): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/goals/${goalId}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete goal (${response.status})`);
  }
}

export async function checkInGoal(
  goalId: string,
  accessToken: string | null,
  checkpointId?: string,
): Promise<Goal> {
  const body = checkpointId ? { checkpoint_id: checkpointId } : {};
  const response = await fetch(`${apiBase()}/api/v1/goals/${goalId}/check-ins/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to check in (${response.status})`);
  }
  return (await response.json()) as Goal;
}

export async function undoGoal(goalId: string, accessToken: string | null): Promise<Goal> {
  const response = await fetch(`${apiBase()}/api/v1/goals/${goalId}/undo/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to undo (${response.status})`);
  }
  return (await response.json()) as Goal;
}

export async function createCheckpoint(
  goalId: string,
  title: string,
  accessToken: string | null,
): Promise<Checkpoint> {
  const response = await fetch(`${apiBase()}/api/v1/goals/${goalId}/checkpoints/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to add checkpoint (${response.status})`);
  }
  return (await response.json()) as Checkpoint;
}

export async function patchCheckpoint(
  goalId: string,
  checkpointId: string,
  payload: { completed_at?: string | null; title?: string },
  accessToken: string | null,
): Promise<Goal> {
  const response = await fetch(
    `${apiBase()}/api/v1/goals/${goalId}/checkpoints/${checkpointId}/`,
    {
      method: "PATCH",
      headers: authHeaders(accessToken),
      credentials: "omit",
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(drfErrorToMessage(text) ?? `Failed to update checkpoint (${response.status})`);
  }
  return (await response.json()) as Goal;
}

export async function deleteCheckpoint(
  goalId: string,
  checkpointId: string,
  accessToken: string | null,
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/api/v1/goals/${goalId}/checkpoints/${checkpointId}/`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to delete checkpoint (${response.status})`);
  }
}
