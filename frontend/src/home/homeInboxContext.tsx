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

import { useAppSession } from "../auth/AppSessionContext";
import type { SessionUser } from "../auth/AppSessionContext";
import { fetchClosetActionSummary } from "../closet/api";
import { fetchFriendsList } from "../friends/api";
import {
  fetchStaffPendingSummary,
  fetchUpcomingBirthdays,
  type StaffPendingSummary,
  type UpcomingBirthday,
} from "../users/api";

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

  if (
    sessionUser.user?.is_staff &&
    d.staffPendingSummary &&
    (d.staffPendingSummary.pending_members > 0 ||
      d.staffPendingSummary.pending_whatif_questions > 0)
  ) {
    if (d.staffPendingSummary.pending_members > 0) {
      prompts.push({
        id: "staff-pending-members",
        to: "/staff",
        text:
          d.staffPendingSummary.pending_members === 1
            ? "1 member is awaiting approval."
            : `${d.staffPendingSummary.pending_members} members are awaiting approval.`,
      });
    }
    if (d.staffPendingSummary.pending_whatif_questions > 0) {
      prompts.push({
        id: "staff-pending-whatif",
        to: "/staff",
        text:
          d.staffPendingSummary.pending_whatif_questions === 1
            ? "1 WhatIf question is awaiting review."
            : `${d.staffPendingSummary.pending_whatif_questions} WhatIf questions are awaiting review.`,
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
      to: "/closet?tab=my",
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
};

const HomeInboxContext = createContext<InboxContextValue | null>(null);

export function HomeInboxProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    sessionUser,
    getApiAccessToken,
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

  const lastIndexRefreshAt = useRef(0);
  const inFlight = useRef<Promise<string[] | null> | null>(null);
  /** One initial fetch per logged-in user so API-backed prompts exist before 90s poll / home visit. */
  const initialInboxRefreshUserId = useRef<number | null>(null);

  const userId = sessionUser?.user?.id;

  useEffect(() => {
    setInboxInitialSyncComplete(false);
    if (userId == null) {
      setReadIds(new Set());
      return;
    }
    setReadIds(loadReadSet(userId));
  }, [userId]);

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

      const loadBirthdays =
        approved &&
        (async () => {
          try {
            const token = await getApiAccessToken();
            return await fetchUpcomingBirthdays(token);
          } catch {
            return [] as UpcomingBirthday[];
          }
        });

      const loadStaff =
        isStaff &&
        (async () => {
          try {
            const token = await getApiAccessToken();
            return await fetchStaffPendingSummary(token);
          } catch {
            return null;
          }
        });

      const loadFriends =
        approved &&
        (async () => {
          try {
            const token = await getApiAccessToken();
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
            const token = await getApiAccessToken();
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
    if (initialInboxRefreshUserId.current === id) {
      return;
    }
    initialInboxRefreshUserId.current = id;
    void refreshInbox();
  }, [isAuthenticated, sessionUser, refreshInbox]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (location.pathname !== "/") return;
    const now = Date.now();
    if (now - lastIndexRefreshAt.current < 45_000) return;
    lastIndexRefreshAt.current = now;
    void refreshInbox();
  }, [isAuthenticated, location.pathname, refreshInbox]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void refreshInbox();
    };
    const id = window.setInterval(tick, 90_000);
    return () => window.clearInterval(id);
  }, [isAuthenticated, refreshInbox]);

  const { homePrompts, homeNoticeItems } = useMemo(() => {
    if (!isAuthenticated || !sessionUser) {
      return { homePrompts: [] as HomePrompt[], homeNoticeItems: [] as HomeNoticeItem[] };
    }
    return deriveHomeInbox(sessionUser, {
      upcomingBirthdays,
      staffPendingSummary,
      pendingFriendCount,
      closetOutstandingActions,
    });
  }, [
    isAuthenticated,
    sessionUser,
    upcomingBirthdays,
    staffPendingSummary,
    pendingFriendCount,
    closetOutstandingActions,
  ]);

  const unreadCount = useMemo(() => {
    if (userId == null) return 0;
    const ids = [
      ...homePrompts.map((p) => p.id),
      ...homeNoticeItems.map((n) => n.id),
    ];
    return ids.filter((id) => !readIds.has(id)).length;
  }, [userId, homePrompts, homeNoticeItems, readIds]);

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
