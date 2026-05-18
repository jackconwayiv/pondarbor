import { useEffect, useState } from "react";
import { useLocation } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  fetchMyWhatIfSessions,
  fetchWhatIfHandState,
  listStoredWhatIfPlayerCodes,
  loadPlayerToken,
} from "./api";
import type { WhatIfMySessionRow } from "./types";
import { isWhatIfInProgressStatus } from "./whatifSessionStatus";

export type WhatIfResumeTarget = {
  short_code: string;
  player_secret: string;
  updated_at: string;
};

function isInsideWhatIfRoomRoute(pathname: string): boolean {
  return (
    /^\/whatif\/hand\/[^/]+$/i.test(pathname) ||
    /^\/whatif\/play\/[^/]+$/i.test(pathname) ||
    /^\/whatif\/lobby\/[^/]+$/i.test(pathname)
  );
}

function mergeCandidate(
  map: Map<string, { player_secret: string; updated_at: string }>,
  code: string,
  secret: string,
  updated_at?: string,
): void {
  const normalized = code.toUpperCase();
  const trimmed = secret.trim();
  if (trimmed.length === 0) return;
  const existing = map.get(normalized);
  const ts = updated_at ?? existing?.updated_at ?? "";
  if (!existing || (updated_at && ts >= (existing.updated_at || ""))) {
    map.set(normalized, {
      player_secret: trimmed,
      updated_at: updated_at ?? existing?.updated_at ?? "",
    });
  }
}

function seedFromMineRows(
  map: Map<string, { player_secret: string; updated_at: string }>,
  rows: WhatIfMySessionRow[],
): void {
  for (const row of rows) {
    const secret = row.player_secret?.trim();
    if (!secret) continue;
    mergeCandidate(map, row.short_code, secret, row.updated_at);
  }
}

export function useWhatIfResumeTargets(): {
  targets: WhatIfResumeTarget[];
  loading: boolean;
} {
  const location = useLocation();
  const { isAuthenticated, getApiAccessToken, sessionUser } = useAppSession();
  const isApprovedUser = !!sessionUser?.user?.is_approved;
  const insideRoom = isInsideWhatIfRoomRoute(location.pathname);

  const [targets, setTargets] = useState<WhatIfResumeTarget[]>([]);
  const [loading, setLoading] = useState(!insideRoom);

  useEffect(() => {
    if (insideRoom) {
      setTargets([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      const map = new Map<string, { player_secret: string; updated_at: string }>();

      for (const code of listStoredWhatIfPlayerCodes()) {
        const secret = loadPlayerToken(code);
        if (secret) mergeCandidate(map, code, secret);
      }

      if (isAuthenticated && isApprovedUser) {
        try {
          const token = await getApiAccessToken();
          const mine = await fetchMyWhatIfSessions(token);
          if (cancelled) return;
          seedFromMineRows(map, mine.in_progress);
        } catch {
          /* keep storage-only candidates */
        }
      }

      const validated: WhatIfResumeTarget[] = [];
      for (const [code, candidate] of map) {
        if (cancelled) return;
        try {
          const state = await fetchWhatIfHandState(code, candidate.player_secret);
          if (!state || !isWhatIfInProgressStatus(state.status)) continue;
          validated.push({
            short_code: code,
            player_secret: candidate.player_secret,
            updated_at: state.updated_at ?? candidate.updated_at ?? "",
          });
        } catch {
          /* invalid or expired token */
        }
      }

      validated.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );

      if (!cancelled) {
        setTargets(validated);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    insideRoom,
    isAuthenticated,
    isApprovedUser,
    getApiAccessToken,
    location.pathname,
  ]);

  return { targets, loading };
}
