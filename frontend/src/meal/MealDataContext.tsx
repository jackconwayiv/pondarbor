import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { SessionUser } from "../auth/AppSessionContext";
import {
  fetchDisconnectPending,
  fetchInstances,
  fetchMealBootstrap,
  fetchMealCategoryOptions,
  fetchMeals,
  fetchPantryInventory,
  fetchSharedMeals,
} from "./api";
import {
  removeInstanceFromList,
  removeMealFromList,
  removePantryRowFromList,
  upsertCategoryOption,
  upsertInstanceInList,
  upsertMealInList,
  upsertPantryRowInList,
} from "./mealDataMutations";
import type {
  DisconnectPending,
  Meal,
  MealBootstrapResponse,
  MealCategoryBrief,
  MealCategoryOptionsByAxis,
  MealPlanInstance,
  PantryInventoryRow,
  SharedMeal,
} from "./types";

const USE_MEAL_BOOTSTRAP = true;

const EMPTY_CATEGORY_OPTIONS: MealCategoryOptionsByAxis = {
  meal_type: [],
  cuisine: [],
  time: [],
};

async function loadMealBootstrapFallback(
  token: string,
  pantryEnabled: boolean,
): Promise<MealBootstrapResponse> {
  const [
    meals,
    shared_meals,
    instances,
    meal_type,
    cuisine,
    time,
    pantry_inventory,
    disconnect_pending,
  ] = await Promise.all([
    fetchMeals(token),
    fetchSharedMeals(token),
    fetchInstances(token),
    fetchMealCategoryOptions(token, "meal_type"),
    fetchMealCategoryOptions(token, "cuisine"),
    fetchMealCategoryOptions(token, "time"),
    pantryEnabled ? fetchPantryInventory(token) : Promise.resolve(null),
    fetchDisconnectPending(token),
  ]);
  return {
    meals,
    shared_meals,
    instances,
    category_options: { meal_type, cuisine, time },
    tags: [],
    pantry_inventory,
    disconnect_pending,
  };
}

async function loadMealBootstrap(
  token: string,
  pantryEnabled: boolean,
): Promise<MealBootstrapResponse> {
  if (!USE_MEAL_BOOTSTRAP) {
    return loadMealBootstrapFallback(token, pantryEnabled);
  }
  try {
    return await fetchMealBootstrap(token);
  } catch {
    return loadMealBootstrapFallback(token, pantryEnabled);
  }
}

export type MealDataContextValue = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  meals: Meal[];
  sharedMeals: SharedMeal[];
  instances: MealPlanInstance[];
  categoryOptions: MealCategoryOptionsByAxis;
  tags: string[];
  pantryRows: PantryInventoryRow[];
  pantryEnabled: boolean;
  disconnectPending: DisconnectPending;
  instancesRef: { current: MealPlanInstance[] };
  setInstances: (next: MealPlanInstance[]) => void;
  patchInstance: (instance: MealPlanInstance) => void;
  removeInstance: (instanceId: number) => void;
  upsertMeal: (meal: Meal) => void;
  removeMeal: (mealId: number) => void;
  upsertPantryRow: (row: PantryInventoryRow) => void;
  removePantryRow: (rowId: number) => void;
  setTags: (tags: string[]) => void;
  addCategoryOption: (opt: MealCategoryBrief) => void;
  setDisconnectPending: (pending: DisconnectPending) => void;
  refreshAll: () => Promise<void>;
  refreshMeals: () => Promise<void>;
  refreshInstances: () => Promise<MealPlanInstance[]>;
  refreshPantry: () => Promise<void>;
  refreshSharedMeals: () => Promise<void>;
  onGridCommitted: () => void;
};

const MealDataContext = createContext<MealDataContextValue | null>(null);

export function useMealData(): MealDataContextValue {
  const ctx = useContext(MealDataContext);
  if (!ctx) {
    throw new Error("useMealData must be used within MealDataProvider");
  }
  return ctx;
}

type MealDataProviderProps = {
  sessionUser: SessionUser | null;
  getApiAccessToken: () => Promise<string | null>;
  children: ReactNode;
};

export function MealDataProvider({
  sessionUser,
  getApiAccessToken,
  children,
}: MealDataProviderProps) {
  const pantryEnabled = sessionUser?.profile.meal_pantry_enabled ?? false;
  const approved = sessionUser?.user.is_approved ?? false;

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [sharedMeals, setSharedMeals] = useState<SharedMeal[]>([]);
  const [instances, setInstancesState] = useState<MealPlanInstance[]>([]);
  const instancesRef = useRef<MealPlanInstance[]>([]);
  instancesRef.current = instances;
  const [categoryOptions, setCategoryOptions] =
    useState<MealCategoryOptionsByAxis>(EMPTY_CATEGORY_OPTIONS);
  const [tags, setTagsState] = useState<string[]>([]);
  const [pantryRows, setPantryRows] = useState<PantryInventoryRow[]>([]);
  const [disconnectPending, setDisconnectPendingState] = useState<DisconnectPending>(null);

  const applyBootstrap = useCallback((boot: MealBootstrapResponse) => {
    setMeals(boot.meals);
    setSharedMeals(boot.shared_meals);
    setInstancesState(boot.instances);
    setCategoryOptions(boot.category_options);
    setTagsState(boot.tags);
    setPantryRows(boot.pantry_inventory ?? []);
    setDisconnectPendingState(boot.disconnect_pending);
    setReady(true);
    setError(null);
  }, []);

  const load = useCallback(async () => {
    if (!approved) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getApiAccessToken();
      if (!token) throw new Error("Missing API access token.");
      const boot = await loadMealBootstrap(token, pantryEnabled);
      applyBootstrap(boot);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load meal data.");
      setReady(false);
    } finally {
      setLoading(false);
    }
  }, [approved, applyBootstrap, getApiAccessToken, pantryEnabled]);

  useEffect(() => {
    if (!approved) {
      setReady(false);
      setMeals([]);
      setSharedMeals([]);
      setInstancesState([]);
      setCategoryOptions(EMPTY_CATEGORY_OPTIONS);
      setTagsState([]);
      setPantryRows([]);
      setDisconnectPendingState(null);
      return;
    }
    void load();
  }, [approved, load]);

  const setInstances = useCallback((next: MealPlanInstance[]) => {
    instancesRef.current = next;
    setInstancesState(next);
  }, []);

  const patchInstance = useCallback(
    (instance: MealPlanInstance) => {
      setInstances(upsertInstanceInList(instancesRef.current, instance));
    },
    [setInstances],
  );

  const removeInstance = useCallback(
    (instanceId: number) => {
      setInstances(removeInstanceFromList(instancesRef.current, instanceId));
    },
    [setInstances],
  );

  const upsertMeal = useCallback((meal: Meal) => {
    setMeals((prev) => upsertMealInList(prev, meal));
    setSharedMeals((prev) => prev.filter((s) => s.id !== meal.id));
  }, []);

  const removeMeal = useCallback((mealId: number) => {
    setMeals((prev) => removeMealFromList(prev, mealId));
  }, []);

  const upsertPantryRow = useCallback((row: PantryInventoryRow) => {
    setPantryRows((prev) => upsertPantryRowInList(prev, row));
  }, []);

  const removePantryRow = useCallback((rowId: number) => {
    setPantryRows((prev) => removePantryRowFromList(prev, rowId));
  }, []);

  const setTags = useCallback((next: string[]) => {
    setTagsState(next);
  }, []);

  const addCategoryOption = useCallback((opt: MealCategoryBrief) => {
    setCategoryOptions((prev) => upsertCategoryOption(prev, opt));
  }, []);

  const setDisconnectPending = useCallback((pending: DisconnectPending) => {
    setDisconnectPendingState(pending);
  }, []);

  const refreshAll = useCallback(async () => {
    await load();
  }, [load]);

  const refreshMeals = useCallback(async () => {
    const token = await getApiAccessToken();
    setMeals(await fetchMeals(token));
  }, [getApiAccessToken]);

  const refreshInstances = useCallback(async () => {
    const token = await getApiAccessToken();
    const next = await fetchInstances(token);
    setInstances(next);
    return next;
  }, [getApiAccessToken, setInstances]);

  const refreshPantry = useCallback(async () => {
    if (!pantryEnabled) {
      setPantryRows([]);
      return;
    }
    const token = await getApiAccessToken();
    setPantryRows(await fetchPantryInventory(token));
  }, [getApiAccessToken, pantryEnabled]);

  const refreshSharedMeals = useCallback(async () => {
    const token = await getApiAccessToken();
    setSharedMeals(await fetchSharedMeals(token));
  }, [getApiAccessToken]);

  const onGridCommitted = useCallback(() => {
    void refreshMeals().catch(() => {});
  }, [refreshMeals]);

  const value = useMemo(
    (): MealDataContextValue => ({
      ready,
      loading,
      error,
      retry: load,
      meals,
      sharedMeals,
      instances,
      categoryOptions,
      tags,
      pantryRows,
      pantryEnabled,
      disconnectPending,
      instancesRef,
      setInstances,
      patchInstance,
      removeInstance,
      upsertMeal,
      removeMeal,
      upsertPantryRow,
      removePantryRow,
      setTags,
      addCategoryOption,
      setDisconnectPending,
      refreshAll,
      refreshMeals,
      refreshInstances,
      refreshPantry,
      refreshSharedMeals,
      onGridCommitted,
    }),
    [
      ready,
      loading,
      error,
      load,
      meals,
      sharedMeals,
      instances,
      categoryOptions,
      tags,
      pantryRows,
      pantryEnabled,
      disconnectPending,
      setInstances,
      patchInstance,
      removeInstance,
      upsertMeal,
      removeMeal,
      upsertPantryRow,
      removePantryRow,
      setTags,
      addCategoryOption,
      setDisconnectPending,
      refreshAll,
      refreshMeals,
      refreshInstances,
      refreshPantry,
      refreshSharedMeals,
      onGridCommitted,
    ],
  );

  return <MealDataContext.Provider value={value}>{children}</MealDataContext.Provider>;
}
