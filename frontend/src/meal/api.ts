import type {
  GroceryList,
  Meal,
  MealPlanInstance,
  MealPlanTemplate,
  DisconnectPending,
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

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { detail?: string };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
  } catch {
    // ignore
  }
  return text || `Request failed (${response.status})`;
}

export async function fetchMeals(accessToken: string | null): Promise<Meal[]> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal[]>;
}

export async function fetchMeal(accessToken: string | null, id: number): Promise<Meal> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/${id}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal>;
}

export async function createMeal(
  accessToken: string | null,
  body: {
    title?: string;
    blurb?: string;
    directions?: string;
    ingredients?: { raw_line: string; amount?: string; unit?: string; name?: string }[];
  },
): Promise<Meal> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal>;
}

export async function patchMeal(
  accessToken: string | null,
  id: number,
  body: {
    title?: string;
    blurb?: string;
    directions?: string;
    ingredients?: { raw_line: string; amount?: string; unit?: string; name?: string }[];
  },
): Promise<Meal> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/${id}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal>;
}

export async function deleteMeal(accessToken: string | null, id: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function fetchTemplate(
  accessToken: string | null,
  id: number,
): Promise<MealPlanTemplate> {
  const response = await fetch(`${apiBase()}/api/v1/meal/templates/${id}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanTemplate>;
}

export async function fetchTemplates(accessToken: string | null): Promise<MealPlanTemplate[]> {
  const response = await fetch(`${apiBase()}/api/v1/meal/templates/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanTemplate[]>;
}

export async function createTemplate(
  accessToken: string | null,
  body: { name: string; description?: string; slots_per_day?: number },
): Promise<MealPlanTemplate> {
  const response = await fetch(`${apiBase()}/api/v1/meal/templates/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanTemplate>;
}

export async function patchTemplate(
  accessToken: string | null,
  id: number,
  body: { name?: string; description?: string; slots_per_day?: number },
): Promise<MealPlanTemplate> {
  const response = await fetch(`${apiBase()}/api/v1/meal/templates/${id}/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanTemplate>;
}

export async function deleteTemplate(accessToken: string | null, id: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/templates/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function patchTemplateGrid(
  accessToken: string | null,
  id: number,
  slots: { day_index: number; slot_index: number; meal_ids: number[] }[],
): Promise<MealPlanTemplate> {
  const response = await fetch(`${apiBase()}/api/v1/meal/templates/${id}/grid/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ slots }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanTemplate>;
}

export async function fetchInstances(accessToken: string | null): Promise<MealPlanInstance[]> {
  const response = await fetch(`${apiBase()}/api/v1/meal/instances/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanInstance[]>;
}

export async function createInstance(
  accessToken: string | null,
  body: { template_id: number; week_start: string },
): Promise<MealPlanInstance> {
  const response = await fetch(`${apiBase()}/api/v1/meal/instances/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanInstance>;
}

export async function fetchInstance(
  accessToken: string | null,
  id: number,
): Promise<MealPlanInstance> {
  const response = await fetch(`${apiBase()}/api/v1/meal/instances/${id}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanInstance>;
}

export async function patchInstanceGrid(
  accessToken: string | null,
  id: number,
  slots: { day_index: number; slot_index: number; meal_ids: number[] }[],
): Promise<MealPlanInstance> {
  const response = await fetch(`${apiBase()}/api/v1/meal/instances/${id}/grid/`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ slots }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealPlanInstance>;
}

export async function deleteInstance(accessToken: string | null, id: number): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/instances/${id}/`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function generateGrocery(
  accessToken: string | null,
  instanceId: number,
): Promise<GroceryList> {
  const response = await fetch(
    `${apiBase()}/api/v1/meal/instances/${instanceId}/grocery/generate/`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<GroceryList>;
}

export async function fetchGrocery(accessToken: string | null, id: number): Promise<GroceryList> {
  const response = await fetch(`${apiBase()}/api/v1/meal/grocery/${id}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<GroceryList>;
}

export async function requestDisconnect(accessToken: string | null): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/partner/disconnect/request/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function cancelDisconnect(accessToken: string | null): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/partner/disconnect/cancel/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function confirmDisconnect(accessToken: string | null): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/partner/disconnect/confirm/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}

export async function fetchDisconnectPending(
  accessToken: string | null,
): Promise<DisconnectPending> {
  const response = await fetch(`${apiBase()}/api/v1/meal/partner/disconnect/pending/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<DisconnectPending>;
}
