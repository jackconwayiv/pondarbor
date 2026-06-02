import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "../auth/AppSessionContext";
import { fetchPantrySuggestions } from "./api";
import type { PantryHint } from "./types";

export function usePantryHints() {
  const { sessionUser, getApiAccessToken } = useAppSession();
  const [hints, setHints] = useState<PantryHint[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const pantryEnabled = sessionUser?.profile.meal_pantry_enabled ?? false;

  const refresh = useCallback(async () => {
    if (!pantryEnabled) {
      setHints([]);
      return;
    }
    setLoadErr(null);
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      const r = await fetchPantrySuggestions(t);
      setHints(r.hints ?? []);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load recommendations.");
    } finally {
      setBusy(false);
    }
  }, [getApiAccessToken, pantryEnabled]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    void refresh();
  }, [sessionUser?.user.is_approved, refresh, pantryEnabled]);

  return { hints, busy, loadErr, refresh, pantryEnabled };
}
