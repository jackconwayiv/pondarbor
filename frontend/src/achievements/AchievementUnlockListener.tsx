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

    const unlockedNow = list.filter((a) => !prev.has(a.slug));
    if (unlockedNow.length > 0) {
      // Chakra toaster can call flushSync internally; defer to next task to avoid
      // running during React's lifecycle/effect commit.
      window.setTimeout(() => {
        for (const a of unlockedNow) {
          achievementToaster.create({
            type: "success",
            closable: true,
            title: `Achievement Unlocked: ${a.title}`,
            description: a.description,
          });
        }
      }, 0);
    }

    prevSlugsRef.current = nextSlugs;
  }, [isAuthenticated, sessionUser?.achievements]);

  return null;
}
