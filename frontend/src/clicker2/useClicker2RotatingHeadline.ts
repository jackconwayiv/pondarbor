import { useEffect, useMemo, useRef, useState } from "react";

import {
  activeHeadlineForDenizen,
  buildHeadlineRotationCandidates,
  HEADLINE_ROTATION_MS,
  pickNextHeadlineRotation,
  type HeadlineRotationSelection,
} from "./headlines";

function currentSelectionForDenizen(
  owned: Record<string, number>,
  denizenId: string,
): HeadlineRotationSelection | null {
  const headline = activeHeadlineForDenizen(owned, denizenId);
  if (!headline) return null;
  return { denizenId, headlineId: headline.id };
}

export function useClicker2RotatingHeadline(
  owned: Record<string, number>,
): string {
  const [selectedDenizenId, setSelectedDenizenId] = useState<string | null>(
    null,
  );
  const previousRotationRef = useRef<HeadlineRotationSelection | null>(null);
  const selectedDenizenIdRef = useRef<string | null>(null);
  selectedDenizenIdRef.current = selectedDenizenId;

  useEffect(() => {
    const candidates = buildHeadlineRotationCandidates(owned);
    if (candidates.length === 0) {
      setSelectedDenizenId(null);
      previousRotationRef.current = null;
      return;
    }

    const currentId = selectedDenizenIdRef.current;
    if (
      currentId === null ||
      activeHeadlineForDenizen(owned, currentId) === undefined
    ) {
      const next = pickNextHeadlineRotation(owned, previousRotationRef.current);
      if (next) {
        previousRotationRef.current = next;
        setSelectedDenizenId(next.denizenId);
      }
    }
  }, [owned]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSelectedDenizenId((currentId) => {
        const previous =
          currentId !== null
            ? currentSelectionForDenizen(owned, currentId)
            : previousRotationRef.current;
        const next = pickNextHeadlineRotation(owned, previous);
        if (next) {
          previousRotationRef.current = next;
          return next.denizenId;
        }
        return currentId;
      });
    }, HEADLINE_ROTATION_MS);

    return () => window.clearInterval(id);
  }, [owned]);

  return useMemo(() => {
    if (!selectedDenizenId) return "";
    return activeHeadlineForDenizen(owned, selectedDenizenId)?.text ?? "";
  }, [owned, selectedDenizenId]);
}
