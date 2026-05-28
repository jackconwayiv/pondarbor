import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";

import type { SessionUser } from "../auth/AppSessionContext";
import { useAppSession } from "../auth/AppSessionContext";
import {
  achievementInboxId,
  deriveUnreadAchievementNotices,
} from "../achievements/achievementInboxNotice";
import { fetchClosetActionSummary } from "../closet/api";
import { fetchFriendsList } from "../friends/api";
import {
  fetchStaffPendingSummary,
  markAchievementInboxRead,
  fetchUpcomingBirthdays,
  type StaffPendingSummary,
  type UpcomingBirthday,
} from "../users/api";

/** Trust shelled inbox snapshot from POST /users/bootstrap/ or sessionStorage within this window. */
const INBOX_SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;
/** Minimum gap between full inbox network refreshes when revisiting home. */
const HOME_INDEX_REFRESH_MIN_INTERVAL_MS = 45_000;

/** QFF shell routes (`QffLayout`) — skip inbox network refresh/polling during immersive play. */
function isQffShellPath(pathname: string): boolean {
  return pathname === "/qff" || pathname.startsWith("/qff/");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function birthdayMessage(birthday: UpcomingBirthday): string {
  const monthName =
    MONTH_NAMES[birthday.birth_month - 1] ?? String(birthday.birth_month);
  return `${birthday.display_name}'s birthday is ${monthName} ${birthday.birth_day}!`;
}

function accountStatusMessage(
  accountStatus: string | undefined,
): string | null {
  if (!accountStatus || accountStatus === "approved") return null;
  if (accountStatus === "pending") return "Your account is awaiting approval.";
  if (accountStatus === "rejected")
    return "Your account was rejected. Please contact support.";
  if (accountStatus === "suspended")
    return "Your account is suspended. Please contact support.";
  return "Your account is not currently approved.";
}

function readStorageKey(userId: number): string {
  return `pondarbor.homeInbox.readIds.${userId}`;
}

function loadReadSet(userId: number): Set<string> {
  try {
    const raw = localStorage.getItem(readStorageKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((x): x is string => typeof x === "string"),
    );
  } catch {
    return new Set();
  }
}

function persistReadSet(userId: number, ids: Set<string>) {
  try {
    localStorage.setItem(
      readStorageKey(userId),
      JSON.stringify([...ids]),
    );
  } catch {
    /* ignore */
  }
}

export type HomePrompt = { id: string; text: string; to: string };
export type HomeNoticeItem = { id: string; text: string };

type InboxDataSnapshot = {
  upcomingBirthdays: UpcomingBirthday[];
  staffPendingSummary: StaffPendingSummary | null;
  pendingFriendCount: number;
  closetOutstandingActions: number;
};

function deriveHomeInbox(
  sessionUser: SessionUser,
  d: InboxDataSnapshot,
): { homePrompts: HomePrompt[]; homeNoticeItems: HomeNoticeItem[] } {
  const prompts: HomePrompt[] = [];
  const notices: HomeNoticeItem[] = [];

  const statusMsg = accountStatusMessage(sessionUser.user?.account_status);
  if (statusMsg) {
    notices.push({ id: "account-status", text: statusMsg });
  }

  if (sessionUser.user?.is_staff && d.staffPendingSummary) {
    const s = d.staffPendingSummary;
    if (s.pending_members > 0) {
      prompts.push({
        id: "staff-pending-members",
        to: "/staff",
        text:
          s.pending_members === 1
            ? "1 member is awaiting approval."
            : `${s.pending_members} members are awaiting approval.`,
      });
    }
    if (s.pending_whatif_questions > 0) {
      prompts.push({
        id: "staff-pending-whatif",
        to: "/staff",
        text:
          s.pending_whatif_questions === 1
            ? "1 WhatIf question is awaiting review."
            : `${s.pending_whatif_questions} WhatIf questions are awaiting review.`,
      });
    }
    const pendingZodiac = s.pending_zodiac_charts ?? 0;
    if (pendingZodiac > 0) {
      prompts.push({
        id: "staff-pending-zodiac",
        to: "/staff/zodiac",
        text:
          pendingZodiac === 1
            ? "1 birth chart is awaiting review."
            : `${pendingZodiac} birth charts are awaiting review.`,
      });
    }
    if (
      s.contact_messages_count > 0 &&
      s.latest_contact_message_id != null
    ) {
      const n = s.contact_messages_count;
      prompts.push({
        id: `staff-contact-${s.latest_contact_message_id}`,
        to: "/staff?tab=contact",
        text:
          n === 1
            ? "You have 1 new contact message."
            : `You have ${n} new contact messages.`,
      });
    }
  }

  if (sessionUser.user?.is_approved && d.pendingFriendCount > 0) {
    prompts.push({
      id: "pending-friends",
      to: "/profile?tab=friends",
      text:
        d.pendingFriendCount === 1
          ? "You have 1 pending friend request."
          : `You have ${d.pendingFriendCount} pending friend requests.`,
    });
  }

  if (sessionUser.user?.is_approved && d.closetOutstandingActions > 0) {
    prompts.push({
      id: "closet-actions",
      to: "/closet?tab=items",
      text:
        d.closetOutstandingActions === 1
          ? "You have 1 outstanding action for items in your community closet."
          : `You have ${d.closetOutstandingActions} outstanding actions for items in your community closet.`,
    });
  }

  if (
    sessionUser.user?.is_approved &&
    sessionUser.profile.meal_partner_incoming_pending
  ) {
    prompts.push({
      id: "meal-partner-incoming",
      to: "/meal/settings",
      text: "You have a Meal Maestro partner request. Open Meal Settings to accept or decline.",
    });
  }

  if (sessionUser.user?.is_approved && d.upcomingBirthdays.length > 0) {
    for (const birthday of d.upcomingBirthdays) {
      notices.push({
        id: `birthday-${birthday.display_name}-${birthday.birth_month}-${birthday.birth_day}`,
        text: birthdayMessage(birthday),
      });
    }
  }

  return { homePrompts: prompts, homeNoticeItems: notices };
}

type InboxContextValue = {
  upcomingBirthdays: UpcomingBirthday[];
  staffPendingSummary: StaffPendingSummary | null;
  pendingFriendCount: number;
  closetOutstandingActions: number;
  inboxStatus: "idle" | "loading" | "error";
  inboxError: string | null;
  /** True after the first `refreshInbox` attempt for this account finishes (success or error). */
  inboxInitialSyncComplete: boolean;
  homePrompts: HomePrompt[];
  homeNoticeItems: HomeNoticeItem[];
  unreadCount: number;
  refreshInbox: () => Promise<string[] | null>;
  markInboxViewed: (itemIds?: string[]) => void;
  markAchievementNoticesRead: (slugs: string[]) => Promise<void>;
};

const HomeInboxContext = createContext<InboxContextValue | null>(null);

export function HomeInboxProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    sessionUser,
    getApiAccessToken,
    bootstrapInboxSnapshot,
    bootstrapInboxFetchedAt,
  } = useAppSession();
  const location = useLocation();

  const [upcomingBirthdays, setUpcomingBirthdays] = useState<
    UpcomingBirthday[]
  >([]);
  const [staffPendingSummary, setStaffPendingSummary] =
    useState<StaffPendingSummary | null>(null);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [closetOutstandingActions, setClosetOutstandingActions] = useState(0);
  const [inboxStatus, setInboxStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [inboxInitialSyncComplete, setInboxInitialSyncComplete] =
    useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [achievementReadSlugs, setAchievementReadSlugs] = useState<Set<string>>(
    () => new Set(),
  );

  /** Updated when inbox data is loaded from network or fresh bootstrap snapshot. */
  const lastSuccessfulInboxRefreshAt = useRef(0);
  const inFlight = useRef<Promise<string[] | null> | null>(null);
  /** One initial fetch per logged-in user so API-backed prompts exist before 90s poll / home visit. */
  const initialInboxRefreshUserId = useRef<number | null>(null);

  const userId = sessionUser?.user?.id;

  useEffect(() => {
    setInboxInitialSyncComplete(false);
    if (userId == null) {
      setReadIds(new Set());
      setAchievementReadSlugs(new Set());
      return;
    }
    setReadIds(loadReadSet(userId));
  }, [userId]);

  useEffect(() => {
    if (userId == null) return;
    const slugs = sessionUser?.profile?.achievement_inbox_read_slugs ?? [];
    setAchievementReadSlugs(new Set(slugs));
  }, [userId, sessionUser?.profile?.achievement_inbox_read_slugs]);

  const refreshInbox = useCallback(async (): Promise<string[] | null> => {
    if (!isAuthenticated || !sessionUser) {
      return null;
    }

    if (inFlight.current) {
      return inFlight.current;
    }

    const run = (async (): Promise<string[] | null> => {
      setInboxError(null);
      setInboxStatus("loading");
      const su = sessionUser;
      const approved = su.user?.is_approved;
      const isStaff = su.user?.is_staff;

      let token: string;
      try {
        token = await getApiAccessToken();
      } catch {
        setInboxError("Could not load activity.");
        setInboxStatus("error");
        setInboxInitialSyncComplete(true);
        return null;
      }

      const loadBirthdays =
        approved &&
        (async () => {
          try {
            return await fetchUpcomingBirthdays(token);
          } catch {
            return [] as UpcomingBirthday[];
          }
        });

      const loadStaff =
        isStaff &&
        (async () => {
          try {
            return await fetchStaffPendingSummary(token);
          } catch {
            return null;
          }
        });

      const loadFriends =
        approved &&
        (async () => {
          try {
            const payload = await fetchFriendsList(token);
            return payload.pending_count;
          } catch {
            return 0;
          }
        });

      const loadCloset =
        approved &&
        (async () => {
          try {
            const summary = await fetchClosetActionSummary(token);
            return summary.outstanding_actions_count;
          } catch {
            return 0;
          }
        });

      try {
        const [b, s, f, c] = await Promise.all([
          loadBirthdays ? loadBirthdays() : Promise.resolve([] as UpcomingBirthday[]),
          loadStaff ? loadStaff() : Promise.resolve(null as StaffPendingSummary | null),
          loadFriends ? loadFriends() : Promise.resolve(0),
          loadCloset ? loadCloset() : Promise.resolve(0),
        ]);
        if (!isAuthenticated) return null;
        setUpcomingBirthdays(b);
        setStaffPendingSummary(s);
        setPendingFriendCount(f);
        setClosetOutstandingActions(c);
        setInboxStatus("idle");
        setInboxInitialSyncComplete(true);
        lastSuccessfulInboxRefreshAt.current = Date.now();
        const snap: InboxDataSnapshot = {
          upcomingBirthdays: b,
          staffPendingSummary: s,
          pendingFriendCount: f,
          closetOutstandingActions: c,
        };
        const derived = deriveHomeInbox(su, snap);
        return [
          ...derived.homePrompts.map((p) => p.id),
          ...derived.homeNoticeItems.map((n) => n.id),
        ];
      } catch (err) {
        setInboxError(
          err instanceof Error ? err.message : "Could not load activity.",
        );
        setInboxStatus("error");
        setInboxInitialSyncComplete(true);
        return null;
      }
    })();

    inFlight.current = run;
    try {
      return await run;
    } finally {
      inFlight.current = null;
    }
  }, [isAuthenticated, sessionUser, getApiAccessToken]);

  useEffect(() => {
    if (!isAuthenticated || sessionUser?.user?.id == null) {
      initialInboxRefreshUserId.current = null;
      return;
    }
    const id = sessionUser.user.id;
    const snapshotFresh =
      bootstrapInboxSnapshot &&
      bootstrapInboxFetchedAt != null &&
      Date.now() - bootstrapInboxFetchedAt < INBOX_SNAPSHOT_MAX_AGE_MS;

    if (isQffShellPath(location.pathname)) {
      if (snapshotFresh && bootstrapInboxSnapshot) {
        setUpcomingBirthdays(bootstrapInboxSnapshot.upcomingBirthdays);
        setStaffPendingSummary(bootstrapInboxSnapshot.staffPendingSummary);
        setPendingFriendCount(bootstrapInboxSnapshot.pendingFriendCount);
        setClosetOutstandingActions(
          bootstrapInboxSnapshot.closetOutstandingActions,
        );
        setInboxStatus("idle");
        setInboxError(null);
        setInboxInitialSyncComplete(true);
        lastSuccessfulInboxRefreshAt.current = bootstrapInboxFetchedAt;
        initialInboxRefreshUserId.current = id;
        return;
      }
      if (initialInboxRefreshUserId.current !== id) {
        setUpcomingBirthdays([]);
        setStaffPendingSummary(null);
        setPendingFriendCount(0);
        setClosetOutstandingActions(0);
        setInboxStatus("idle");
        setInboxError(null);
        setInboxInitialSyncComplete(true);
      }
      return;
    }

    if (initialInboxRefreshUserId.current === id) {
      return;
    }

    if (snapshotFresh && bootstrapInboxSnapshot) {
      setUpcomingBirthdays(bootstrapInboxSnapshot.upcomingBirthdays);
      setStaffPendingSummary(bootstrapInboxSnapshot.staffPendingSummary);
      setPendingFriendCount(bootstrapInboxSnapshot.pendingFriendCount);
      setClosetOutstandingActions(
        bootstrapInboxSnapshot.closetOutstandingActions,
      );
      setInboxStatus("idle");
      setInboxInitialSyncComplete(true);
      lastSuccessfulInboxRefreshAt.current = bootstrapInboxFetchedAt;
      initialInboxRefreshUserId.current = id;
      return;
    }

    initialInboxRefreshUserId.current = id;
    void refreshInbox();
  }, [
    isAuthenticated,
    sessionUser,
    refreshInbox,
    bootstrapInboxSnapshot,
    bootstrapInboxFetchedAt,
    location.pathname,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!inboxInitialSyncComplete) return;
    if (location.pathname !== "/") return;
    const now = Date.now();
    if (
      now - lastSuccessfulInboxRefreshAt.current <
      HOME_INDEX_REFRESH_MIN_INTERVAL_MS
    )
      return;
    void refreshInbox();
  }, [
    isAuthenticated,
    inboxInitialSyncComplete,
    location.pathname,
    refreshInbox,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isQffShellPath(location.pathname)) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void refreshInbox();
    };
    const id = window.setInterval(tick, 90_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, refreshInbox, location.pathname]);

  const { homePrompts, homeNoticeItems } = useMemo(() => {
    if (!isAuthenticated || !sessionUser) {
      return { homePrompts: [] as HomePrompt[], homeNoticeItems: [] as HomeNoticeItem[] };
    }
    const derived = deriveHomeInbox(sessionUser, {
      upcomingBirthdays,
      staffPendingSummary,
      pendingFriendCount,
      closetOutstandingActions,
    });
    const achievementReadIds = new Set<string>();
    for (const slug of achievementReadSlugs) {
      achievementReadIds.add(achievementInboxId(slug));
    }
    const combinedReadIds = new Set<string>(readIds);
    for (const id of achievementReadIds) combinedReadIds.add(id);

    const achievementNotices = deriveUnreadAchievementNotices(
      sessionUser.achievements ?? [],
      combinedReadIds,
    );
    return {
      homePrompts: derived.homePrompts,
      homeNoticeItems: [...achievementNotices, ...derived.homeNoticeItems],
    };
  }, [
    isAuthenticated,
    sessionUser,
    upcomingBirthdays,
    staffPendingSummary,
    pendingFriendCount,
    closetOutstandingActions,
    readIds,
    achievementReadSlugs,
  ]);

  const unreadCount = useMemo(() => {
    if (userId == null) return 0;
    const ids = [
      ...homePrompts.map((p) => p.id),
      ...homeNoticeItems.map((n) => n.id),
    ];
    const achievementReadIds = new Set<string>();
    for (const slug of achievementReadSlugs) {
      achievementReadIds.add(achievementInboxId(slug));
    }
    const effectiveRead = new Set<string>(readIds);
    for (const id of achievementReadIds) effectiveRead.add(id);
    return ids.filter((id) => !effectiveRead.has(id)).length;
  }, [userId, homePrompts, homeNoticeItems, readIds, achievementReadSlugs]);

  const markInboxViewed = useCallback(
    (itemIds?: string[]) => {
      if (userId == null) return;
      const toMark =
        itemIds ?? [
          ...homePrompts.map((p) => p.id),
          ...homeNoticeItems.map((n) => n.id),
        ];
      setReadIds((prev) => {
        const next = new Set(prev);
        for (const id of toMark) next.add(id);
        persistReadSet(userId, next);
        return next;
      });
    },
    [userId, homePrompts, homeNoticeItems],
  );

  const markAchievementNoticesRead = useCallback(
    async (slugs: string[]) => {
      if (!isAuthenticated || !sessionUser) return;
      const unique = [...new Set(slugs.map((s) => s.trim()).filter(Boolean))];
      if (unique.length === 0) return;

      // Optimistic local update so the bell count clears immediately.
      setAchievementReadSlugs((prev) => {
        const next = new Set(prev);
        for (const s of unique) next.add(s);
        return next;
      });

      const token = await getApiAccessToken();
      await markAchievementInboxRead(token, unique);
    },
    [isAuthenticated, sessionUser, getApiAccessToken],
  );

  const value = useMemo(
    () => ({
      upcomingBirthdays,
      staffPendingSummary,
      pendingFriendCount,
      closetOutstandingActions,
      inboxStatus,
      inboxError,
      inboxInitialSyncComplete,
      homePrompts,
      homeNoticeItems,
      unreadCount,
      refreshInbox,
      markInboxViewed,
      markAchievementNoticesRead,
    }),
    [
      upcomingBirthdays,
      staffPendingSummary,
      pendingFriendCount,
      closetOutstandingActions,
      inboxStatus,
      inboxError,
      inboxInitialSyncComplete,
      homePrompts,
      homeNoticeItems,
      unreadCount,
      refreshInbox,
      markInboxViewed,
      markAchievementNoticesRead,
    ],
  );

  return (
    <HomeInboxContext.Provider value={value}>
      {children}
    </HomeInboxContext.Provider>
  );
}

export function useHomeInbox(): InboxContextValue {
  const ctx = useContext(HomeInboxContext);
  if (!ctx) {
    throw new Error("useHomeInbox must be used within HomeInboxProvider");
  }
  return ctx;
}
