import { useState } from "react";
import { useMealData } from "./MealDataContext";

export function usePantryInventory() {
  const { pantryRows, pantryEnabled, refreshPantry, upsertPantryRow } = useMealData();
  const [busy, setBusy] = useState(false);

  return {
    pantryRows,
    busy,
    setBusy,
    loadErr: null as string | null,
    refresh: refreshPantry,
    pantryEnabled,
    upsertPantryRow,
  };
}
