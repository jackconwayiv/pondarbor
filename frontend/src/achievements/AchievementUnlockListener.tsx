import { useEffect, useRef } from "react";

import { useAppSession } from "../auth/AppSessionContext";
import { achievementToaster } from "./achievementToaster";

/**
 * Compares successive `sessionUser.achievements` payloads and shows a toast for each newly appearing slug.
 * Skips the first snapshot after login so existing badges do not all notify at once.
 */
export function AchievementUnlockListener() {
  const { sessionUser, isAuthenticated } = useAppSession();
  const prevSlugsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      prevSlugsRef.current = null;
      return;
    }

    const list = sessionUser?.achievements;
    if (!list) {
      return;
    }

    const nextSlugs = new Set(list.map((a) => a.slug));
    const prev = prevSlugsRef.current;

    if (prev === null) {
      prevSlugsRef.current = nextSlugs;
      return;
    }

    for (const a of list) {
      if (!prev.has(a.slug)) {
        achievementToaster.create({
          type: "success",
          closable: true,
          title: `Achievement Unlocked: ${a.title}`,
          description: a.description,
        });
      }
    }

    prevSlugsRef.current = nextSlugs;
  }, [isAuthenticated, sessionUser?.achievements]);

  return null;
}
