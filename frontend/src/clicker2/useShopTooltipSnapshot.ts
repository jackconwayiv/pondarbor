import { useCallback, useState } from "react";

/** Capture tooltip payload when the surface opens; clear when it closes. */
export function useShopTooltipSnapshot<T>(capture: () => T) {
  const [snapshot, setSnapshot] = useState<T | null>(null);

  const onOpenChange = useCallback(
    (details: { open: boolean }) => {
      if (details.open) {
        setSnapshot(capture());
      } else {
        setSnapshot(null);
      }
    },
    [capture],
  );

  return { snapshot, onOpenChange };
}
