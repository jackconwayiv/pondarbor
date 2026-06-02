import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "../auth/AppSessionContext";
import { fetchPantryInventory } from "./api";
import type { PantryInventoryRow } from "./types";

export function usePantryInventory() {
  const { sessionUser, getApiAccessToken } = useAppSession();
  const [pantryRows, setPantryRows] = useState<PantryInventoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const pantryEnabled = sessionUser?.profile.meal_pantry_enabled ?? false;

  const refresh = useCallback(async () => {
    if (!pantryEnabled) {
      setPantryRows([]);
      return;
    }
    setLoadErr(null);
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      setPantryRows(await fetchPantryInventory(t));
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load pantry inventory.");
    } finally {
      setBusy(false);
    }
  }, [getApiAccessToken, pantryEnabled]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void refresh();
  }, [sessionUser?.user.is_approved, refresh, pantryEnabled]);

  return { pantryRows, setPantryRows, busy, setBusy, loadErr, refresh, pantryEnabled };
}
