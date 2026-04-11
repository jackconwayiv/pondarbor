import type {
  GroceryList,
  Meal,
  MealPlanInstance,
  MealPlanTemplate,
  DisconnectPending,
  MealCategoryBrief,
  SharedMeal,
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

function authHeadersBearerOnly(accessToken: string | null): Record<string, string> {
  if (!accessToken) {
    throw new Error("Missing API access token. Refresh your session and try again.");
  }
  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function parseApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
    const parts: string[] = [];
    for (const v of Object.values(parsed)) {
      if (typeof v === "string" && v.trim()) {
        parts.push(v);
      } else if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string" && item.trim()) parts.push(item);
        }
      }
    }
    if (parts.length) return parts.join(" ");
  } catch {
    // ignore
  }
  return text || `Request failed (${response.status})`;
}

export type MealListQuery = {
  q?: string;
  /** Comma-separated; AND semantics on the server. */
  tags?: string;
  meal_type_id?: number;
  cuisine_id?: number;
  time_id?: number;
  sort?: "updated_at" | "title" | "upcoming_slot_count";
};

function appendMealListQuery(url: string, q?: MealListQuery): string {
  if (!q) return url;
  const sp = new URLSearchParams();
  if (q.q?.trim()) sp.set("q", q.q.trim());
  if (q.tags?.trim()) sp.set("tags", q.tags.trim());
  if (q.meal_type_id != null) sp.set("meal_type_id", String(q.meal_type_id));
  if (q.cuisine_id != null) sp.set("cuisine_id", String(q.cuisine_id));
  if (q.time_id != null) sp.set("time_id", String(q.time_id));
  if (q.sort) sp.set("sort", q.sort);
  const qs = sp.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function fetchMeals(
  accessToken: string | null,
  query?: MealListQuery,
): Promise<Meal[]> {
  const response = await fetch(appendMealListQuery(`${apiBase()}/api/v1/meal/meals/`, query), {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal[]>;
}

export async function fetchSharedMeals(
  accessToken: string | null,
  q?: string,
): Promise<SharedMeal[]> {
  let url = `${apiBase()}/api/v1/meal/meals/shared/`;
  if (q?.trim()) {
    url += `?q=${encodeURIComponent(q.trim())}`;
  }
  const response = await fetch(url, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<SharedMeal[]>;
}

export async function copyFriendMeal(
  accessToken: string | null,
  mealId: number,
): Promise<Meal> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/${mealId}/copy/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({}),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal>;
}

export async function fetchMealTagVocab(accessToken: string | null): Promise<string[]> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/tags/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  const data = (await response.json()) as { tags: string[] };
  return data.tags;
}

export async function fetchMealCategoryOptions(
  accessToken: string | null,
  axis: "meal_type" | "cuisine" | "time",
): Promise<MealCategoryBrief[]> {
  const response = await fetch(
    `${apiBase()}/api/v1/meal/meals/category-options/?axis=${encodeURIComponent(axis)}`,
    {
      headers: authHeaders(accessToken),
      credentials: "omit",
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealCategoryBrief[]>;
}

export async function createMealCategoryOption(
  accessToken: string | null,
  body: { axis: "meal_type" | "cuisine" | "time"; name: string },
): Promise<MealCategoryBrief> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/category-options/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealCategoryBrief>;
}

export async function fetchMeal(accessToken: string | null, id: number): Promise<Meal> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/${id}/`, {
    headers: authHeaders(accessToken),
    credentials: "omit",
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal>;
}

export async function importMealFromUrl(
  accessToken: string | null,
  url: string,
): Promise<Meal> {
  const response = await fetch(`${apiBase()}/api/v1/meal/meals/import/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<Meal>;
}

export type PaprikaImportResponse = {
  meals: Meal[];
  imported_count: number;
  errors: { index: number; error: string }[];
};

export async function importPaprikaRecipes(
  accessToken: string | null,
  file: File,
): Promise<PaprikaImportResponse> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${apiBase()}/api/v1/meal/paprika/import/`, {
    method: "POST",
    headers: authHeadersBearerOnly(accessToken),
    credentials: "omit",
    body,
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<PaprikaImportResponse>;
}

export type MealImagePresignResponse = {
  key: string;
  upload_url: string;
  expires_in_seconds: number;
  max_bytes: number;
  allowed_mime_types: string[];
};

export async function requestMealImagePresign(
  accessToken: string | null,
  contentType: "image/jpeg" | "image/png" | "image/webp",
): Promise<MealImagePresignResponse> {
  const response = await fetch(`${apiBase()}/api/v1/meal/uploads/presign/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ content_type: contentType }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
  return response.json() as Promise<MealImagePresignResponse>;
}

export async function createMeal(
  accessToken: string | null,
  body: {
    title?: string;
    blurb?: string;
    directions?: string;
    source_url?: string;
    image_key?: string;
    ingredients?: { raw_line: string; amount?: string; unit?: string; name?: string }[];
    tag_names?: string[];
    meal_type_id?: number | null;
    cuisine_id?: number | null;
    time_id?: number | null;
    is_published_to_friends?: boolean;
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
    source_url?: string;
    image_key?: string;
    ingredients?: { raw_line: string; amount?: string; unit?: string; name?: string }[];
    tag_names?: string[];
    meal_type_id?: number | null;
    cuisine_id?: number | null;
    time_id?: number | null;
    is_published_to_friends?: boolean;
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
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as DisconnectPending;
}

export async function declineIncomingPartnerRequest(
  accessToken: string | null,
  requesterId: number,
): Promise<void> {
  const response = await fetch(`${apiBase()}/api/v1/meal/partner/request/decline/`, {
    method: "POST",
    headers: authHeaders(accessToken),
    credentials: "omit",
    body: JSON.stringify({ requester_id: requesterId }),
  });
  if (!response.ok) throw new Error(await parseApiError(response));
}
