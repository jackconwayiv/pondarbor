import {
  Avatar,
  Box,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink, Navigate, useNavigate, useParams } from "react-router";
import { AchievementSummaryCard } from "../achievements/AchievementSummaryCard";
import {
  fetchPublicAchievementsByUser,
  fetchPublicAchievementsByUserId,
  postAchievementPeersForSubjectFriends,
} from "../achievements/api";
import { sortAchievementsNewestFirst } from "../achievements/sortAchievements";
import type { AchievementPeerAvatarRow, AchievementSummary } from "../achievements/types";
import {
  resolveAvatarUrlForUser,
  useAppSession,
} from "../auth/AppSessionContext";
import { fetchFriendItemsByOwner } from "../closet/api";
import { FriendClosetListCard } from "../closet/FriendClosetListCard";
import type { ClosetItem } from "../closet/types";
import { fetchFriendRecommendationsByOwner } from "../recommendations/api";
import FriendRecommendationListCard from "../recommendations/FriendRecommendationListCard";
import type { FriendRecommendationRow } from "../recommendations/types";
import { ApprovedFriendsListBlock } from "../friends/ApprovedFriendsListBlock";
import {
  acceptFriend,
  fetchFriendsList,
  fetchUserFriendsList,
  ignoreFriend,
  requestFriendByUserId,
  unfriend,
  type FriendUser,
} from "../friends/api";
import { friendProfilePath } from "./profilePaths";
import NotFoundPage from "../NotFoundPage";
import PondButton from "../PondButton";
import RouteLoadingFallback from "../RouteLoadingFallback";

const PeoplePage = lazy(() => import("../people/PeoplePage"));
import {
  fetchPublicQuotesByUser,
  fetchPublicQuotesByUserId,
} from "../quotes/api";
import { quoteOwnerDisplayLabel } from "../quotes/ownerDisplay";
import QuoteCardBase from "../quotes/QuoteCardBase";
import type { Quote } from "../quotes/types";
import {
  PanelBlockSkeleton,
  PanelListRowSkeleton,
  PanelMessageSlot,
} from "../components/panelStatus";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  MAPPED_LIST_CARD_OUTER_PROPS,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import {
  fetchPublicUserSummaryByEmail,
  fetchPublicUserSummaryById,
  currentlyReadingLine,
  friendDisplayName,
  friendProfileHeading,
  type PublicUserSummary,
} from "./publicUser";
import { friendHasVisibleFamilyTree } from "../people/familyTreeVisibility";
import {
  FriendProfileBigThreeRow,
  FriendProfileBirthdayInline,
} from "./FriendProfileBirthBigThreeStrip";

const PAGE_SIZE = 10;

/** Re-use bundled profile data when revisiting the same friend within a tab session. */
const FRIEND_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

type FriendProfileBundleCache = {
  quotes: Quote[];
  achievements: AchievementSummary[];
  theirFriends: FriendUser[];
  closetItems: ClosetItem[];
  friendRecommendations: FriendRecommendationRow[];
  summary: PublicUserSummary;
  fetchedAt: number;
};

const friendProfileBundleCache = new Map<string, FriendProfileBundleCache>();

function friendProfileCacheKey(
  lookup:
    | { kind: "id"; id: number }
    | { kind: "email"; email: string }
    | { kind: "invalid" },
): string | null {
  if (lookup.kind === "id") return `id:${lookup.id}`;
  if (lookup.kind === "email") return `email:${lookup.email.toLowerCase()}`;
  return null;
}

const ENTRY_CARD_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
} as const;

/** Match read-only quote card rows in Quotes. */
function FriendProfileQuoteCard({ quote }: { quote: Quote }) {
  const { sessionUser, auth0User } = useAppSession();
  const ownerAvatarUrl = resolveAvatarUrlForUser(
    quote.owner.avatar_url,
    quote.owner.id,
    sessionUser,
    auth0User,
  );
  return (
    <Box
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="xl"
      {...MAPPED_LIST_CARD_OUTER_PROPS}
    >
      <QuoteCardBase
        quote={quote}
        ownerText={quoteOwnerDisplayLabel(quote.owner)}
        ownerProfileUserId={quote.owner.id}
        ownerAvatarUrl={ownerAvatarUrl}
      />
    </Box>
  );
}

export default function FriendProfilePage() {
  const { userId, email } = useParams<{ userId?: string; email?: string }>();
  const navigate = useNavigate();
  const {
    isAuthenticated,
    isLoading: sessionLoading,
    sessionUser,
    auth0User,
    getApiAccessToken,
  } = useAppSession();

  const [myApprovedFriendIds, setMyApprovedFriendIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [myIncomingPendingIds, setMyIncomingPendingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [myOutgoingPendingIds, setMyOutgoingPendingIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [acceptFriendBusyUserId, setAcceptFriendBusyUserId] = useState<
    number | null
  >(null);

  const lookup = useMemo(() => {
    if (userId !== undefined && userId !== "") {
      const id = Number.parseInt(userId, 10);
      if (!Number.isFinite(id) || id < 1) {
        return { kind: "invalid" as const };
      }
      return { kind: "id" as const, id };
    }
    if (email) {
      return { kind: "email" as const, email: decodeURIComponent(email) };
    }
    return { kind: "invalid" as const };
  }, [userId, email]);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [achievements, setAchievements] = useState<AchievementSummary[]>([]);
  const [achievementPeersBySlug, setAchievementPeersBySlug] = useState<
    Record<string, AchievementPeerAvatarRow[]>
  >({});
  const [theirFriends, setTheirFriends] = useState<FriendUser[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [friendRecommendations, setFriendRecommendations] = useState<FriendRecommendationRow[]>(
    [],
  );
  const [summary, setSummary] = useState<PublicUserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmUnfriend, setConfirmUnfriend] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [profileTab, setProfileTab] = useState<
    "friends" | "achievements" | "quotes" | "closet" | "recommendations" | "people"
  >("achievements");
  const [reloadKey, setReloadKey] = useState(0);
  const unfriendBoxRef = useRef<HTMLDivElement | null>(null);
  const ownUserId = sessionUser?.user?.id ?? null;

  const profileSubjectUserId =
    summary?.id ?? (lookup.kind === "id" ? lookup.id : null);

  const resolvedProfileAvatarUrl = useMemo(() => {
    if (!summary || profileSubjectUserId == null) return "";
    return resolveAvatarUrlForUser(
      summary.avatar_url,
      profileSubjectUserId,
      sessionUser,
      auth0User,
    );
  }, [summary, profileSubjectUserId, sessionUser, auth0User]);

  const syncViewerFriendsListFromApi = useCallback(async () => {
    try {
      const t = await getApiAccessToken();
      const d = await fetchFriendsList(t);
      setMyApprovedFriendIds(new Set(d.approved_friends.map((f) => f.id)));
      setMyIncomingPendingIds(new Set(d.incoming_pending.map((f) => f.id)));
      setMyOutgoingPendingIds(new Set(d.outgoing_pending.map((f) => f.id)));
    } catch {
      setMyApprovedFriendIds(new Set());
      setMyIncomingPendingIds(new Set());
      setMyOutgoingPendingIds(new Set());
    }
  }, [getApiAccessToken]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) {
      setMyApprovedFriendIds(new Set());
      setMyIncomingPendingIds(new Set());
      setMyOutgoingPendingIds(new Set());
      return;
    }
    void syncViewerFriendsListFromApi();
  }, [sessionUser?.user.is_approved, syncViewerFriendsListFromApi]);

  useEffect(() => {
    if (lookup.kind === "invalid") {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const run = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      const cacheKey = friendProfileCacheKey(lookup);
      if (cacheKey && reloadKey === 0) {
        const hit = friendProfileBundleCache.get(cacheKey);
        if (
          hit &&
          Date.now() - hit.fetchedAt < FRIEND_PROFILE_CACHE_TTL_MS
        ) {
          setQuotes(hit.quotes);
          setAchievements(hit.achievements);
          setTheirFriends(hit.theirFriends);
          setClosetItems(hit.closetItems);
          setFriendRecommendations(hit.friendRecommendations);
          setSummary(hit.summary);
          setError(null);
          setNotFound(false);
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      setNotFound(false);
      try {
        let accessToken: string | null = null;
        try {
          accessToken = await getApiAccessToken();
        } catch {
          accessToken = null;
        }
        const [quoteData, achData, summaryData] = await Promise.all([
          lookup.kind === "id"
            ? fetchPublicQuotesByUserId(lookup.id, accessToken)
            : fetchPublicQuotesByUser(lookup.email, accessToken),
          (lookup.kind === "id"
            ? fetchPublicAchievementsByUserId(lookup.id, accessToken)
            : fetchPublicAchievementsByUser(lookup.email, accessToken)
          ).catch(() => [] as AchievementSummary[]),
          lookup.kind === "id"
            ? fetchPublicUserSummaryById(lookup.id, accessToken)
            : fetchPublicUserSummaryByEmail(lookup.email, accessToken),
        ]);
        const profileSubjectId =
          lookup.kind === "id" ? lookup.id : (summaryData.id ?? null);
        const closetRows =
          summaryData.can_view_full_profile && profileSubjectId !== null
            ? await fetchFriendItemsByOwner(
                accessToken,
                profileSubjectId,
              ).catch(() => [] as ClosetItem[])
            : [];
        const recommendationRows =
          summaryData.can_view_full_profile && profileSubjectId !== null
            ? await fetchFriendRecommendationsByOwner(
                accessToken,
                profileSubjectId,
              ).catch(() => [] as FriendRecommendationRow[])
            : [];
        let friendsRows: FriendUser[] = [];
        if (
          summaryData.can_view_full_profile &&
          profileSubjectId !== null &&
          accessToken
        ) {
          try {
            friendsRows = await fetchUserFriendsList(
              profileSubjectId,
              accessToken,
            );
          } catch {
            friendsRows = [];
          }
        }
        const sorted = [...quoteData].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const achSorted = sortAchievementsNewestFirst(achData);
        setQuotes(sorted);
        setAchievements(achSorted);
        setTheirFriends(friendsRows);
        setClosetItems(closetRows);
        setFriendRecommendations(recommendationRows);
        setSummary(summaryData);
        if (cacheKey) {
          friendProfileBundleCache.set(cacheKey, {
            quotes: sorted,
            achievements: achSorted,
            theirFriends: friendsRows,
            closetItems: closetRows,
            friendRecommendations: recommendationRows,
            summary: summaryData,
            fetchedAt: Date.now(),
          });
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load friend profile";
        if (message.includes("(404)")) {
          setNotFound(true);
          setError(null);
        } else {
          setError(message);
        }
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [lookup, isAuthenticated, getApiAccessToken, reloadKey]);

  useEffect(() => {
    if (!actionSuccess) return;
    const timer = window.setTimeout(() => setActionSuccess(null), 3000);
    return () => window.clearTimeout(timer);
  }, [actionSuccess]);

  useEffect(() => {
    if (!confirmUnfriend) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (unfriendBoxRef.current?.contains(target)) return;
      setConfirmUnfriend(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [confirmUnfriend]);

  const total = quotes.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const endIndex = Math.min(total, startIndex + PAGE_SIZE);
  const visibleQuotes = quotes.slice(startIndex, endIndex);
  const canViewFullProfile = Boolean(summary?.can_view_full_profile);
  const hasAchievements = achievements.length > 0;
  const hasQuotes = quotes.length > 0;
  const hasClosetTab =
    Boolean(summary?.can_view_full_profile) && closetItems.length > 0;
  const hasRecommendationsTab =
    Boolean(summary?.can_view_full_profile) && friendRecommendations.length > 0;
  const hasFamilyTreeTab = friendHasVisibleFamilyTree({
    canViewFullProfile,
    peopleCount: summary?.people_count,
  });
  const currentlyReadingText = currentlyReadingLine(summary?.currently_reading);
  const friendshipStatus = summary?.friendship_status ?? "none";
  const canManageFriendshipById = lookup.kind === "id";
  const leftmostVisibleTab = useMemo<
    "friends" | "achievements" | "quotes" | "closet" | "recommendations" | "people" | null
  >(() => {
    if (hasAchievements) return "achievements";
    if (canViewFullProfile) return "friends";
    if (hasQuotes) return "quotes";
    if (hasRecommendationsTab) return "recommendations";
    if (hasClosetTab) return "closet";
    if (hasFamilyTreeTab) return "people";
    return null;
  }, [
    canViewFullProfile,
    hasAchievements,
    hasQuotes,
    hasRecommendationsTab,
    hasClosetTab,
    hasFamilyTreeTab,
  ]);

  useEffect(() => {
    if (!leftmostVisibleTab) return;
    const tabVisible =
      (profileTab === "friends" && canViewFullProfile) ||
      (profileTab === "achievements" && hasAchievements) ||
      (profileTab === "quotes" && hasQuotes) ||
      (profileTab === "closet" && hasClosetTab) ||
      (profileTab === "recommendations" && hasRecommendationsTab) ||
      (profileTab === "people" && hasFamilyTreeTab);
    if (!tabVisible) {
      setProfileTab(leftmostVisibleTab);
    }
  }, [
    profileTab,
    canViewFullProfile,
    hasAchievements,
    hasQuotes,
    hasClosetTab,
    hasRecommendationsTab,
    hasFamilyTreeTab,
    leftmostVisibleTab,
  ]);

  const friendAchievementPeersSlugKey = useMemo(
    () =>
      [...new Set(achievements.map((x) => x.slug))]
        .sort()
        .join("\0"),
    [achievements],
  );

  useEffect(() => {
    if (!summary?.can_view_full_profile || profileSubjectUserId == null) {
      setAchievementPeersBySlug({});
      return;
    }
    if (!sessionUser || !sessionUser.user.is_approved || achievements.length === 0) {
      setAchievementPeersBySlug({});
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const token = await getApiAccessToken();
        const slugs = [...new Set(achievements.map((a) => a.slug))].sort();
        const data = await postAchievementPeersForSubjectFriends(
          profileSubjectUserId,
          slugs,
          token,
        );
        const merged: Record<string, AchievementPeerAvatarRow[]> = { ...data };
        const myId = sessionUser.user.id;
        const display =
          (sessionUser.profile.display_name ?? "").trim() ||
          sessionUser.user.email.split("@")[0] ||
          "You";
        for (const slug of slugs) {
          const own = sessionUser.achievements?.some((x) => x.slug === slug);
          if (!own) continue;
          const cur = merged[slug] ?? [];
          if (cur.some((p) => p.id === myId)) continue;
          merged[slug] = [
            {
              id: myId,
              nickname: display,
              avatar_url: sessionUser.profile.avatar_url ?? "",
            },
            ...cur,
          ];
        }
        if (!cancelled) setAchievementPeersBySlug(merged);
      } catch {
        if (!cancelled) setAchievementPeersBySlug({});
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    summary?.can_view_full_profile,
    profileSubjectUserId,
    friendAchievementPeersSlugKey,
    getApiAccessToken,
    sessionUser?.user.is_approved,
    sessionUser?.user.id,
    sessionUser?.user.email,
    sessionUser?.profile.display_name,
    sessionUser?.profile.avatar_url,
    sessionUser?.achievements,
  ]);

  const profileReturnTo = useMemo(() => {
    if (lookup.kind === "id") return `/friend/${lookup.id}`;
    if (lookup.kind === "email") {
      return `/users/${encodeURIComponent(lookup.email)}/public-quotes`;
    }
    return "/profile?tab=friends";
  }, [lookup]);

  if (sessionLoading) {
    return (
      <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
        <Box
          flex="1"
          bg="bg"
          px={0}
          py={{ base: "2", md: "2" }}
        >
          <Box {...APP_SHELL_TRAY_PROPS}>
            <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
              <Box {...ENTRY_CARD_PROPS}>
                <PanelBlockSkeleton lines={3} showTitleLine />
              </Box>
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (
    (lookup.kind === "id" && ownUserId !== null && lookup.id === ownUserId) ||
    summary?.friendship_status === "self"
  ) {
    return <Navigate to="/profile" replace />;
  }
  if (notFound) {
    return <NotFoundPage />;
  }

  const quotePaginationToolbar =
    total > PAGE_SIZE ? (
      <Box
        bg="bg"
        borderWidth="1px"
        borderColor="border"
        borderRadius="xl"
        p={{ base: "2", md: "2" }}
      >
        <Stack gap="2">
          <Text fontSize={APP_TEXT_SIZES.helper}>
            Showing {startIndex + 1}-{endIndex} of {total}
          </Text>
          <Stack direction="row" align="center" flexWrap="wrap" gap="3">
            <PondButton
              type="button"
              size="sm"
              colorPalette="nautical"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              ←
            </PondButton>
            <Text fontSize={APP_TEXT_SIZES.helper}>
              Page {safePage + 1} / {totalPages}
            </Text>
            <PondButton
              type="button"
              size="sm"
              colorPalette="nautical"
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={safePage >= totalPages - 1}
            >
              →
            </PondButton>
          </Stack>
        </Stack>
      </Box>
    ) : null;

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...ENTRY_CARD_PROPS}>
              {!summary?.can_view_full_profile ? (
                <>
                  <Heading
                    as="h1"
                    size={{ base: "lg", md: "xl" }}
                    mb="2"
                  >
                    {summary ? friendProfileHeading(summary) : "Friend Profile"}
                  </Heading>
                  <Text
                    fontSize={APP_TEXT_SIZES.body}
                    lineHeight="tall"
                    color="fg"
                  >
                    Connect as friends to see this user's profile or respond to
                    their friend request below.
                  </Text>
                </>
              ) : summary ? (
                <>
                  <HStack
                    justify="space-between"
                    align="flex-start"
                    w="100%"
                    flexWrap="wrap"
                    gap="3"
                    mb="4"
                  >
                    <Stack gap="2" flex="1" minW="0">
                      <Heading
                        as="h1"
                        size={{ base: "lg", md: "xl" }}
                      >
                        Friend Profile
                      </Heading>
                    </Stack>
                    {canManageFriendshipById && friendshipStatus === "friends" ? (
                      <Box ref={unfriendBoxRef} flexShrink={0}>
                        <PondButton
                          colorPalette="nautical"
                          onClick={() => {
                            if (!confirmUnfriend) {
                              setConfirmUnfriend(true);
                              return;
                            }
                            void (async () => {
                              setActionBusy(true);
                              setActionError(null);
                              try {
                                const token = await getApiAccessToken();
                                await unfriend(token, lookup.id);
                                setActionSuccess(null);
                                setConfirmUnfriend(false);
                                setReloadKey((value) => value + 1);
                              } catch (err: unknown) {
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to unfriend.",
                                );
                              } finally {
                                setActionBusy(false);
                              }
                            })();
                          }}
                          loading={actionBusy}
                        >
                          {confirmUnfriend ? "Confirm" : "Unfriend"}
                        </PondButton>
                      </Box>
                    ) : canManageFriendshipById &&
                      friendshipStatus === "incoming_pending" ? (
                      <HStack flexWrap="wrap" gap="2" flexShrink={0}>
                        <PondButton
                          colorPalette="lilypad"
                          loading={actionBusy}
                          disabled={actionBusy}
                          onClick={() => {
                            if (lookup.kind !== "id") return;
                            void (async () => {
                              setActionBusy(true);
                              setActionError(null);
                              try {
                                const token = await getApiAccessToken();
                                await acceptFriend(token, lookup.id);
                                setActionSuccess("Friend request accepted.");
                                setReloadKey((value) => value + 1);
                              } catch (err: unknown) {
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to accept friend request.",
                                );
                              } finally {
                                setActionBusy(false);
                              }
                            })();
                          }}
                        >
                          Accept Friend Request
                        </PondButton>
                        <PondButton
                          colorPalette="nautical"
                          loading={actionBusy}
                          disabled={actionBusy}
                          onClick={() => {
                            if (lookup.kind !== "id") return;
                            void (async () => {
                              setActionBusy(true);
                              setActionError(null);
                              try {
                                const token = await getApiAccessToken();
                                await ignoreFriend(token, lookup.id);
                                setActionSuccess("Friend request rejected.");
                                setReloadKey((value) => value + 1);
                              } catch (err: unknown) {
                                setActionError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to reject friend request.",
                                );
                              } finally {
                                setActionBusy(false);
                              }
                            })();
                          }}
                        >
                          Reject Friend Request
                        </PondButton>
                      </HStack>
                    ) : canManageFriendshipById &&
                      friendshipStatus === "none" ? (
                      <PondButton
                        colorPalette="lilypad"
                        loading={actionBusy}
                        disabled={actionBusy}
                        onClick={() => {
                          if (lookup.kind !== "id") return;
                          void (async () => {
                            setActionBusy(true);
                            setActionError(null);
                            try {
                              const token = await getApiAccessToken();
                              await requestFriendByUserId(token, lookup.id);
                              setActionSuccess("Friend request sent.");
                              setReloadKey((value) => value + 1);
                            } catch (err: unknown) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to send friend request.",
                              );
                            } finally {
                              setActionBusy(false);
                            }
                          })();
                        }}
                      >
                        Request Friend
                      </PondButton>
                    ) : canManageFriendshipById &&
                      friendshipStatus === "outgoing_pending" ? (
                      <Text
                        fontSize={APP_TEXT_SIZES.body}
                        fontWeight="medium"
                        color="fg"
                        flexShrink={0}
                      >
                        Friend request pending.
                      </Text>
                    ) : null}
                  </HStack>
                  <Stack gap="3" w="100%">
                    <HStack gap="4" align="flex-start" w="100%">
                      <Avatar.Root size="md" flexShrink={0}>
                        <Avatar.Fallback name={summary.nickname} />
                        <Avatar.Image src={resolvedProfileAvatarUrl || undefined} />
                      </Avatar.Root>
                      <Stack gap="0" flex="1" minW="0">
                        <Text
                          fontWeight="semibold"
                          fontSize={APP_TEXT_SIZES.body}
                        >
                          {summary.nickname}
                        </Text>
                        {summary.is_friend && summary.email ? (
                          <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                            {summary.email}
                          </Text>
                        ) : null}
                      </Stack>
                      <FriendProfileBirthdayInline
                        birthDate={summary.birth_date}
                        sunSign={summary.sun_sign}
                      />
                    </HStack>
                    {profileSubjectUserId != null ? (
                      <FriendProfileBigThreeRow
                        userId={profileSubjectUserId}
                        sunSign={summary.sun_sign}
                        moonSign={summary.moon_sign}
                        risingSign={summary.rising_sign}
                        mercurySign={summary.mercury_sign}
                        venusSign={summary.venus_sign}
                        marsSign={summary.mars_sign}
                      />
                    ) : null}
                  </Stack>
                </>
              ) : null}
            </Box>

            {isLoading || error ? (
              <Box {...ENTRY_CARD_PROPS}>
                {isLoading ? (
                  <Stack gap="2">
                    <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                      Loading...
                    </Text>
                    <PanelListRowSkeleton rows={2} />
                  </Stack>
                ) : (
                  <PanelMessageSlot error={error} />
                )}
              </Box>
            ) : null}

            {!isLoading &&
            !error &&
            summary &&
            !summary.can_view_full_profile ? (
              <Box {...ENTRY_CARD_PROPS}>
                <Stack gap="3" align="flex-start">
                  <HStack gap="4" align="flex-start">
                    <Avatar.Root size="lg">
                      <Avatar.Fallback name={summary.nickname} />
                      <Avatar.Image src={resolvedProfileAvatarUrl || undefined} />
                    </Avatar.Root>
                    <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body}>
                      {summary.nickname}
                    </Text>
                  </HStack>
                  {summary.friendship_status === "incoming_pending" ? (
                    <HStack flexWrap="wrap" gap="2">
                      <PondButton
                        colorPalette="teal"
                        loading={actionBusy}
                        disabled={actionBusy || lookup.kind !== "id"}
                        onClick={() => {
                          if (lookup.kind !== "id") return;
                          void (async () => {
                            setActionBusy(true);
                            setActionError(null);
                            try {
                              const token = await getApiAccessToken();
                              await acceptFriend(token, lookup.id);
                              setActionSuccess(null);
                              setReloadKey((value) => value + 1);
                            } catch (err: unknown) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to accept friend request.",
                              );
                            } finally {
                              setActionBusy(false);
                            }
                          })();
                        }}
                      >
                        Accept Friend Request
                      </PondButton>
                      <PondButton
                        colorPalette="nautical"
                        loading={actionBusy}
                        disabled={actionBusy || lookup.kind !== "id"}
                        onClick={() => {
                          if (lookup.kind !== "id") return;
                          void (async () => {
                            setActionBusy(true);
                            setActionError(null);
                            try {
                              const token = await getApiAccessToken();
                              await ignoreFriend(token, lookup.id);
                              setActionSuccess(null);
                              setReloadKey((value) => value + 1);
                            } catch (err: unknown) {
                              setActionError(
                                err instanceof Error
                                  ? err.message
                                  : "Failed to reject friend request.",
                              );
                            } finally {
                              setActionBusy(false);
                            }
                          })();
                        }}
                      >
                        Reject Friend Request
                      </PondButton>
                    </HStack>
                  ) : summary.friendship_status === "outgoing_pending" ? (
                    <Text
                      fontSize={APP_TEXT_SIZES.body}
                      fontWeight="medium"
                      color="fg"
                    >
                      Friend request pending.
                    </Text>
                  ) : (
                    <PondButton
                      colorPalette="teal"
                      loading={actionBusy}
                      disabled={actionBusy || lookup.kind !== "id"}
                      onClick={() => {
                        if (lookup.kind !== "id") return;
                        void (async () => {
                          setActionBusy(true);
                          setActionError(null);
                          try {
                            const token = await getApiAccessToken();
                            await requestFriendByUserId(token, lookup.id);
                            setActionSuccess("Friend request sent.");
                            setSummary((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    friendship_status: "outgoing_pending",
                                  }
                                : prev,
                            );
                          } catch (err: unknown) {
                            setActionError(
                              err instanceof Error
                                ? err.message
                                : "Failed to send friend request.",
                            );
                          } finally {
                            setActionBusy(false);
                          }
                        })();
                      }}
                    >
                      Request Friend
                    </PondButton>
                  )}
                  <PanelMessageSlot
                    error={actionError}
                    success={actionSuccess}
                    reserve
                    minH="2.75rem"
                  />
                </Stack>
              </Box>
            ) : null}
          </Stack>

          {!isLoading && !error && summary?.can_view_full_profile ? (
            <>
              {((actionError && actionError.trim() !== "") ||
                (actionSuccess && actionSuccess.trim() !== "")) ? (
                <Box px={{ base: "2", md: "2" }} pb="2" w="100%">
                  <PanelMessageSlot
                    error={actionError}
                    success={actionSuccess}
                  />
                </Box>
              ) : null}
              {currentlyReadingText && profileSubjectUserId != null ? (
                <Box
                  px={{ base: "2", md: "2" }}
                  pt="2"
                  pb="0"
                  w="100%"
                  role="button"
                  tabIndex={0}
                  cursor="pointer"
                  color="fg.muted"
                  fontSize={APP_TEXT_SIZES.meta}
                  lineHeight="short"
                  onClick={() =>
                    navigate(`/books?users=${profileSubjectUserId}`)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/books?users=${profileSubjectUserId}`);
                    }
                  }}
                >
                  {currentlyReadingText}
                </Box>
              ) : null}
              <Tabs.Root
                value={profileTab}
                display="flex"
                flexDirection="column"
                flex="1"
                minH="0"
                w="100%"
                onValueChange={(details) =>
                  setProfileTab(
                    details.value as
                      | "friends"
                      | "achievements"
                      | "quotes"
                      | "closet"
                      | "recommendations"
                      | "people",
                  )
                }
                variant="plain"
              >
                <Tabs.List {...APP_SHELL_TAB_LIST_PROPS}>
                  {hasAchievements ? (
                    <Tabs.Trigger
                      value="achievements"
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      Achievements
                    </Tabs.Trigger>
                  ) : null}
                  <Tabs.Trigger
                    value="friends"
                    {...APP_SHELL_TAB_TRIGGER_PROPS}
                  >
                    Friends
                  </Tabs.Trigger>
                  {hasFamilyTreeTab ? (
                    <Tabs.Trigger
                      value="people"
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      Family Tree
                    </Tabs.Trigger>
                  ) : null}
                  {hasQuotes ? (
                    <Tabs.Trigger
                      value="quotes"
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      Quotes
                    </Tabs.Trigger>
                  ) : null}
                  {hasRecommendationsTab ? (
                    <Tabs.Trigger
                      value="recommendations"
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      Recommenda
                    </Tabs.Trigger>
                  ) : null}
                  {hasClosetTab ? (
                    <Tabs.Trigger
                      value="closet"
                      {...APP_SHELL_TAB_TRIGGER_PROPS}
                    >
                      Closet Items
                    </Tabs.Trigger>
                  ) : null}
                </Tabs.List>
                {hasAchievements ? (
                    <Tabs.Content value="achievements" p={{ base: "2", md: "2" }}>
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        {achievements.map((a) => (
                          <RouterLink
                            key={a.slug}
                            to={`/achievements?slug=${encodeURIComponent(a.slug)}`}
                            state={
                              profileSubjectUserId != null
                                ? {
                                    achievementReturnTo:
                                      friendProfilePath(profileSubjectUserId),
                                  }
                                : undefined
                            }
                            aria-label={`View who has earned ${a.title}`}
                            style={{
                              textDecoration: "none",
                              color: "inherit",
                              display: "block",
                            }}
                          >
                            <Box _hover={{ "& > *": { borderColor: "teal.solid" } }}>
                            <AchievementSummaryCard
                              achievement={a}
                              peerAvatars={(achievementPeersBySlug[a.slug] ?? []).map(
                                (p) => ({
                                  userId: p.id,
                                  name: p.nickname,
                                  src: resolveAvatarUrlForUser(
                                    p.avatar_url,
                                    p.id,
                                    sessionUser,
                                    auth0User,
                                  ),
                                }),
                              )}
                            />
                            </Box>
                          </RouterLink>
                        ))}
                      </Stack>
                    </Tabs.Content>
                  ) : null}
                {hasFamilyTreeTab && profileSubjectUserId != null ? (
                  <Tabs.Content value="people" p={{ base: "2", md: "2" }}>
                    <Suspense fallback={<RouteLoadingFallback />}>
                      <PeoplePage
                        embed
                        readOnly
                        ownerUserId={profileSubjectUserId}
                        ownerDisplayName={
                          summary ? friendDisplayName(summary) : undefined
                        }
                      />
                    </Suspense>
                  </Tabs.Content>
                ) : null}
                <Tabs.Content value="friends" p={{ base: "2", md: "2" }}>
                    <ApprovedFriendsListBlock
                      friends={theirFriends}
                      showCountInTitle
                      withCardShell={false}
                      showRequestFriendActions={summary?.friendship_status === "friends"}
                      viewerId={ownUserId ?? undefined}
                      viewerApprovedFriendIds={myApprovedFriendIds}
                      viewerIncomingPendingIds={myIncomingPendingIds}
                      viewerOutgoingPendingIds={myOutgoingPendingIds}
                      acceptFriendBusyUserId={acceptFriendBusyUserId}
                      onRequestFriend={async (uid) => {
                        const t = await getApiAccessToken();
                        await requestFriendByUserId(t, uid);
                        setActionSuccess("Friend request sent.");
                        setMyOutgoingPendingIds((prev) => {
                          const next = new Set(prev);
                          next.add(uid);
                          return next;
                        });
                      }}
                      onAcceptFriendRequest={async (uid) => {
                        setAcceptFriendBusyUserId(uid);
                        setActionError(null);
                        try {
                          const t = await getApiAccessToken();
                          await acceptFriend(t, uid);
                          setActionSuccess("Friend request accepted.");
                          setMyIncomingPendingIds((prev) => {
                            const next = new Set(prev);
                            next.delete(uid);
                            return next;
                          });
                          setMyApprovedFriendIds((prev) => {
                            const next = new Set(prev);
                            next.add(uid);
                            return next;
                          });
                        } catch (err: unknown) {
                          setActionError(
                            err instanceof Error
                              ? err.message
                              : "Could not accept request.",
                          );
                        } finally {
                          setAcceptFriendBusyUserId(null);
                        }
                      }}
                    />
                  </Tabs.Content>
                {hasQuotes ? (
                    <Tabs.Content value="quotes" p={{ base: "2", md: "2" }}>
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        {total > PAGE_SIZE && visibleQuotes.length === PAGE_SIZE
                          ? quotePaginationToolbar
                          : null}
                        {visibleQuotes.map((quote) => (
                          <FriendProfileQuoteCard
                            key={quote.id}
                            quote={quote}
                          />
                        ))}
                        {total > PAGE_SIZE ? quotePaginationToolbar : null}
                      </Stack>
                    </Tabs.Content>
                  ) : null}
                {hasRecommendationsTab ? (
                    <Tabs.Content value="recommendations" p={{ base: "2", md: "2" }}>
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Open a recommendation for details and to add your own review.
                        </Text>
                        <SimpleGrid
                          columns={{ base: 1, md: 2 }}
                          gap={MAPPED_LIST_STACK_GAP}
                          w="100%"
                        >
                          {friendRecommendations.map((row) => (
                            <FriendRecommendationListCard
                              key={`friend-rec-${row.id}`}
                              row={row}
                              recommendationsReturnTo={profileReturnTo}
                            />
                          ))}
                        </SimpleGrid>
                      </Stack>
                    </Tabs.Content>
                  ) : null}
                {hasClosetTab ? (
                    <Tabs.Content value="closet" p={{ base: "2", md: "2" }}>
                      <Stack gap={MAPPED_LIST_STACK_GAP}>
                        <Text fontSize={APP_TEXT_SIZES.helper}>
                          Open an item for details, borrowing, and returns.
                        </Text>
                        <SimpleGrid
                          columns={{ base: 1, md: 3 }}
                          gap={MAPPED_LIST_STACK_GAP}
                          w="100%"
                        >
                          {closetItems.map((item) => (
                            <FriendClosetListCard
                              key={`friend-closet-${item.id}`}
                              item={item}
                              closetReturnTo={profileReturnTo}
                            />
                          ))}
                        </SimpleGrid>
                      </Stack>
                    </Tabs.Content>
                  ) : null}
              </Tabs.Root>
            </>
          ) : null}
        </Box>
      </Box>
    </Stack>
  );
}
