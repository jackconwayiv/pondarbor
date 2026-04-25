import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import type { CalendarOwnerRow } from "./types";

const PARAM = "users";

/**
 * Encode `orderedCheckedUserIds` into the `?users=` query param so the filter
 * persists across navigation between the month and day views.
 *
 * Special values:
 *   - missing or `users=all` → every approved user is checked (default).
 *   - `users=none` (or empty list) → no one is checked.
 *   - `users=1,3,2` → those user ids are checked, in that order (the order
 *     determines the per-user color).
 */
export function useCheckedUsers(approvedUsers: CalendarOwnerRow[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get(PARAM);

  const { orderedCheckedUserIds, isDefaultAll } = useMemo(() => {
    if (raw === null || raw === "all") {
      return {
        orderedCheckedUserIds: approvedUsers.map((u) => u.id),
        isDefaultAll: true,
      };
    }
    if (raw === "" || raw === "none") {
      return { orderedCheckedUserIds: [], isDefaultAll: false };
    }
    const ids = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => Number(p))
      .filter((n) => Number.isFinite(n));
    // Drop ids that aren't currently approved so the URL can't pin a
    // permission-revoked user.
    const approvedIds = new Set(approvedUsers.map((u) => u.id));
    return {
      orderedCheckedUserIds: ids.filter((id) => approvedIds.has(id)),
      isDefaultAll: false,
    };
  }, [raw, approvedUsers]);

  const setCheckedUserIds = useCallback(
    (next: number[]) => {
      const params = new URLSearchParams(searchParams);
      // Re-encode as "all" when the entire approved list is checked, to keep
      // the URL stable as new users get approved.
      const approvedIds = approvedUsers.map((u) => u.id);
      const isAll =
        approvedUsers.length > 0 &&
        next.length === approvedIds.length &&
        approvedIds.every((id) => next.includes(id));
      if (isAll) {
        params.delete(PARAM);
      } else if (next.length === 0) {
        params.set(PARAM, "none");
      } else {
        params.set(PARAM, next.join(","));
      }
      setSearchParams(params, { replace: true });
    },
    [approvedUsers, searchParams, setSearchParams],
  );

  return { orderedCheckedUserIds, setCheckedUserIds, isDefaultAll };
}

/** Build a `?users=...` suffix for cross-route links. */
export function buildUsersQueryFragment(
  orderedCheckedUserIds: number[],
  approvedUsers: CalendarOwnerRow[],
): string {
  const approvedIds = approvedUsers.map((u) => u.id);
  const isAll =
    approvedUsers.length > 0 &&
    orderedCheckedUserIds.length === approvedIds.length &&
    approvedIds.every((id) => orderedCheckedUserIds.includes(id));
  if (isAll) return "";
  if (orderedCheckedUserIds.length === 0) return `?${PARAM}=none`;
  return `?${PARAM}=${orderedCheckedUserIds.join(",")}`;
}
