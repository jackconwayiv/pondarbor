import { useCallback, useEffect, useState } from "react";
import { useAppSession } from "../auth/AppSessionContext";
import { fetchPantryRecipes } from "./api";
import type { PantryRecipeMatch } from "./types";

export function usePantryRecipeMatches(active: boolean) {
  const { getApiAccessToken } = useAppSession();
  const [canMake, setCanMake] = useState<PantryRecipeMatch[]>([]);
  const [almostMake, setAlmostMake] = useState<PantryRecipeMatch[]>([]);
  const [pantryEnabled, setPantryEnabled] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoadErr(null);
    setBusy(true);
    try {
      const t = await getApiAccessToken();
      const data = await fetchPantryRecipes(t);
      setPantryEnabled(data.enabled);
      setCanMake(data.can_make);
      setAlmostMake(data.almost_make);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Could not load pantry recipes.");
    } finally {
      setBusy(false);
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  return { canMake, almostMake, pantryEnabled, loadErr, busy, refresh };
}
