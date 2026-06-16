import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import type { ClosetItemModalNav } from "../closet/ClosetItemModalFooter";
import { parseEntryIdParam } from "./entryModalNav";
import type { RecommendationEntry } from "./types";

export function useRecommendationEntryModal(orderedEntries: RecommendationEntry[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const entryParam = searchParams.get("entry");
  const selectedEntryId = parseEntryIdParam(entryParam);
  const entryQueryInvalid = Boolean(entryParam && entryParam !== "" && selectedEntryId == null);

  const currentIndex = useMemo(
    () =>
      selectedEntryId == null
        ? -1
        : orderedEntries.findIndex((e) => e.id === selectedEntryId),
    [orderedEntries, selectedEntryId],
  );

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < orderedEntries.length - 1;

  const closeExpanded = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("entry");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const setSelectedEntryId = useCallback(
    (id: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("entry", String(id));
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSelectedEntryId(orderedEntries[currentIndex - 1]!.id);
    }
  }, [currentIndex, orderedEntries, setSelectedEntryId]);

  const goNext = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < orderedEntries.length - 1) {
      setSelectedEntryId(orderedEntries[currentIndex + 1]!.id);
    }
  }, [currentIndex, orderedEntries, setSelectedEntryId]);

  const entryModalNav: ClosetItemModalNav = useMemo(
    () => ({
      hasPrev,
      hasNext,
      onPrev: goPrev,
      onNext: goNext,
      onClose: closeExpanded,
    }),
    [hasPrev, hasNext, goPrev, goNext, closeExpanded],
  );

  return {
    selectedEntryId,
    entryQueryInvalid,
    entryModalNav,
    closeExpanded,
    currentIndex,
  };
}
